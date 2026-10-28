package com.example.service;

import com.example.domain.TypeNotification;
import com.example.entity.ActionCapa;
import com.example.entity.Audit;
import com.example.entity.NonConformite;
import com.example.entity.Users;
import com.example.repository.ActionCapaRepository;
import com.example.repository.AuditRepository;
import com.example.repository.NonConformiteRepository;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Calendrier d'audits : planification des étapes CAPA dans la table audits. */
@Service
public class AuditCapaService {

    private static final java.time.format.DateTimeFormatter FORMAT_DATE =
            java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy");

    /** Audit d'une étape CAPA renvoyé au frontend. */
    public record EntreePlanning(Long id, Long etapeId, LocalDate date, String typeAudit, String statut) {}

    /** Planifie plusieurs étapes sur un même jour. typeAudit est INTERNE par défaut. */
    public record PlanificationRequest(
            @NotNull LocalDate date,
            @NotEmpty @Size(max = 30) List<@NotNull Long> etapeIds,
            @Pattern(regexp = "INTERNE|EXTERNE") String typeAudit
    ) {}

    private final AuditRepository auditRepository;
    private final ActionCapaRepository capaRepository;
    private final NonConformiteRepository ncRepository;
    private final JournalActionsService journal;
    private final NotificationService notifications;

    public AuditCapaService(AuditRepository auditRepository,
                            ActionCapaRepository capaRepository,
                            NonConformiteRepository ncRepository,
                            JournalActionsService journal,
                            NotificationService notifications) {
        this.auditRepository = auditRepository;
        this.capaRepository = capaRepository;
        this.ncRepository = ncRepository;
        this.journal = journal;
        this.notifications = notifications;
    }

    @Transactional(readOnly = true)
    public List<EntreePlanning> lister(Long ncId) {
        return auditRepository.findByNcId(ncId).stream().map(this::versDto).toList();
    }

    /**
     * Règles : le jour n'est pas avant aujourd'hui et pas après l'échéance de l'étape.
     * L'auditeur et le processus viennent de la non-conformité (l'auditeur doit être attribué).
     * Une étape déjà planifiée ce jour-là est ignorée. Tout ou rien en cas de refus.
     */
    @Transactional
    public List<EntreePlanning> planifier(PlanificationRequest req, Users acteur) {
        if (req.date().isBefore(LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Impossible de planifier un audit avant aujourd'hui");
        }
        String type = req.typeAudit() == null ? "INTERNE" : req.typeAudit();

        List<Long> ids = req.etapeIds().stream().distinct().toList();
        Map<Long, ActionCapa> actions = capaRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(ActionCapa::getId, Function.identity()));

        Map<Long, NonConformite> ncParId = new HashMap<>();
        Map<Long, List<ActionCapa>> etapesParNc = new HashMap<>();
        List<Audit> aCreer = new ArrayList<>();

        for (Long id : ids) {
            ActionCapa action = actions.get(id);
            if (action == null || action.getNcId() == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Étape CAPA introuvable : " + id);
            }
            if (req.date().isAfter(action.getDateEcheance())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "La date dépasse l'échéance de l'étape (" + action.getDateEcheance() + ")");
            }
            if ("VERIFIEE".equals(action.getStatutAction())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Cette étape CAPA est déjà validée");
            }

            NonConformite nc = ncParId.computeIfAbsent(action.getNcId(), ncId -> ncRepository.findById(ncId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Non-conformité introuvable")));
            if (nc.getAuditeurId() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Aucun auditeur n'est attribué à " + nc.getReference() + " : attribuez-en un avant de planifier");
            }
            if (auditRepository.existsByActionCapaIdAndDatePlanifiee(id, req.date())) continue;

            List<ActionCapa> etapes = etapesParNc.computeIfAbsent(nc.getId(), capaRepository::findByNcIdOrderByIdAsc);
            int numero = 1;
            for (int i = 0; i < etapes.size(); i++) {
                if (etapes.get(i).getId().equals(id)) { numero = i + 1; break; }
            }

            aCreer.add(Audit.builder()
                    .titre("Audit CAPA " + nc.getReference() + " - étape " + numero)
                    .processusId(nc.getProcessusId())
                    .typeAudit(type)
                    .auditeurId(nc.getAuditeurId())
                    .actionCapaId(id)
                    .datePlanifiee(req.date())
                    .statut("PLANIFIE")
                    .build());
        }

        List<Audit> crees = auditRepository.saveAll(aCreer);
        for (Audit audit : crees) {
            journal.enregistrerModification(acteur.getId(), "ADD_AUDIT_PLANNING", "AUDIT", audit.getId(),
                    null, Instantane.de(audit), null);
        }
        notifierAuditeurs(crees);
        return crees.stream().map(this::versDto).toList();
    }

    /** Retire un audit de CAPA ; seuls les audits encore PLANIFIE peuvent l'être. */
    @Transactional
    public void retirer(Long id, Users acteur) {
        Audit audit = auditRepository.findById(id)
                .filter(a -> a.getActionCapaId() != null)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Audit introuvable"));
        if (!"PLANIFIE".equals(audit.getStatut())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Un audit en cours ou terminé ne peut pas être retiré du calendrier");
        }
        journal.enregistrerModification(acteur.getId(), "DELETE_AUDIT_PLANNING", "AUDIT", audit.getId(),
                Instantane.de(audit), null, null);
        auditRepository.delete(audit);

        // L'auditeur ne doit pas se présenter à un audit qui n'existe plus : entiteId null -> son calendrier
        notifications.notifier(audit.getAuditeurId(), TypeNotification.AUDIT_RETIRE,
                "L'audit « " + audit.getTitre() + " » prévu le " + audit.getDatePlanifiee().format(FORMAT_DATE)
                        + " a été retiré du planning par " + NotificationService.nom(acteur) + ".",
                NotificationService.ENTITE_AUDIT, null);
    }

    /**
     * Prévient chaque auditeur des audits qui lui sont attribués. Un seul audit : lien direct vers lui ;
     * plusieurs audits planifiés d'un coup : une seule notification qui renvoie vers son calendrier.
     */
    private void notifierAuditeurs(List<Audit> crees) {
        Map<Long, List<Audit>> parAuditeur = crees.stream()
                .collect(Collectors.groupingBy(Audit::getAuditeurId));
        parAuditeur.forEach((auditeurId, audits) -> {
            if (audits.size() == 1) {
                Audit a = audits.get(0);
                notifications.notifier(auditeurId, TypeNotification.AUDIT_ATTRIBUE,
                        "Un audit vous a été attribué : « " + a.getTitre() + " » le "
                                + a.getDatePlanifiee().format(FORMAT_DATE) + ".",
                        NotificationService.ENTITE_AUDIT, a.getId());
            } else {
                notifications.notifier(auditeurId, TypeNotification.AUDIT_ATTRIBUE,
                        audits.size() + " audits vous ont été attribués, à partir du "
                                + audits.stream().map(Audit::getDatePlanifiee).min(LocalDate::compareTo).get()
                                .format(FORMAT_DATE) + ". Consultez votre calendrier.",
                        NotificationService.ENTITE_AUDIT, null);
            }
        });
    }

    private EntreePlanning versDto(Audit a) {
        return new EntreePlanning(a.getId(), a.getActionCapaId(), a.getDatePlanifiee(), a.getTypeAudit(), a.getStatut());
    }
}