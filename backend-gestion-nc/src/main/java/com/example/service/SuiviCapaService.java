package com.example.service;

import com.example.domain.StatutAction;
import com.example.domain.StatutNc;
import com.example.dto.audit.AuditDtos.*;
import com.example.entity.*;
import com.example.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Côté responsable qualité : suivi du travail des auditeurs sur chaque étape CAPA,
 * commentaires des constats, validation une par une des étapes, puis clôture de la NC.
 */
@Service
public class SuiviCapaService {

    private final NonConformiteRepository ncRepository;
    private final ActionCapaRepository capaRepository;
    private final AuditRepository auditRepository;
    private final ConstatAuditRepository constatRepository;
    private final CommentaireConstatRepository commentaireRepository;
    private final NcStatutHistoriqueRepository statutHistoriqueRepository;
    private final AuditAssembleur assembleur;
    private final CapaEvenementService evenements;
    private final JournalActionsService journal;

    public SuiviCapaService(NonConformiteRepository ncRepository,
                            ActionCapaRepository capaRepository,
                            AuditRepository auditRepository,
                            ConstatAuditRepository constatRepository,
                            CommentaireConstatRepository commentaireRepository,
                            NcStatutHistoriqueRepository statutHistoriqueRepository,
                            AuditAssembleur assembleur,
                            CapaEvenementService evenements,
                            JournalActionsService journal) {
        this.ncRepository = ncRepository;
        this.capaRepository = capaRepository;
        this.auditRepository = auditRepository;
        this.constatRepository = constatRepository;
        this.commentaireRepository = commentaireRepository;
        this.statutHistoriqueRepository = statutHistoriqueRepository;
        this.assembleur = assembleur;
        this.evenements = evenements;
        this.journal = journal;
    }

    // ------------------------------------------------------------------ lecture
    @Transactional(readOnly = true)
    public SuiviNc suivi(Long ncId) {
        return construire(trouverNc(ncId));
    }

    /** Toutes les étapes CAPA attribuées, pour la page « Actions correctives ». */
    @Transactional(readOnly = true)
    public List<CapaListItem> listerToutes() {
        List<ActionCapa> etapes = capaRepository.findAll(org.springframework.data.domain.Sort.by("id"));
        if (etapes.isEmpty()) return List.of();

        Map<Long, NonConformite> ncs = ncRepository.findAllById(etapes.stream()
                        .map(ActionCapa::getNcId).filter(Objects::nonNull).distinct().toList())
                .stream().collect(Collectors.toMap(NonConformite::getId, Function.identity()));

        Map<Long, Integer> numeros = new HashMap<>();
        for (Long ncId : ncs.keySet()) {
            List<ActionCapa> plan = capaRepository.findByNcIdOrderByIdAsc(ncId);
            for (int i = 0; i < plan.size(); i++) numeros.put(plan.get(i).getId(), i + 1);
        }

        return etapes.stream().map(e -> {
            NonConformite nc = ncs.get(e.getNcId());
            return new CapaListItem(
                    e.getId(), e.getNcId(), nc == null ? null : nc.getReference(),
                    nc == null ? null : nc.getTitre(), nc == null ? null : nc.getStatut(),
                    numeros.getOrDefault(e.getId(), 0), e.getTypeAction(), e.getDescription(),
                    assembleur.personne(e.getResponsableActionId()), e.getDateEcheance(),
                    e.getStatutAction(), e.getEfficace());
        }).toList();
    }

    // ------------------------------------------------------------------ commentaire d'un constat
    @Transactional
    public SuiviNc commenter(Long constatId, String texte, Users rq) {
        exigerResponsable(rq);

        ConstatAudit constat = constatRepository.findById(constatId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Constat introuvable"));
        Audit audit = auditRepository.findById(constat.getAuditId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Audit introuvable"));
        ActionCapa etape = audit.getActionCapaId() == null ? null
                : capaRepository.findById(audit.getActionCapaId()).orElse(null);
        if (etape == null || etape.getNcId() == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Ce constat n'est rattaché à aucune étape CAPA");
        }
        NonConformite nc = trouverNc(etape.getNcId());
        exigerNonCloturee(nc);

        CommentaireConstat c = new CommentaireConstat();
        c.setConstatId(constatId);
        c.setAuteurId(rq.getId());
        c.setCommentaire(texte.trim());
        commentaireRepository.save(c);

        journal.enregistrer(rq.getId(), "ADD_COMMENT", "CONSTAT_AUDIT", constatId,
                Map.of("auditId", audit.getId(), "ncId", nc.getId()));
        evenements.publier(nc.getId(), etape.getId(), audit.getId(), "COMMENTAIRE_AJOUTE",
                nom(rq) + " a commenté un constat de « " + audit.getTitre() + " »");
        return construire(nc);
    }

    // ------------------------------------------------------------------ classification d'une étape
    /** Passe l'étape à VERIFIEE (« validée ») avec sa qualification : traitement efficace ou non. */
    @Transactional
    public SuiviNc validerEtape(Long etapeId, ValidationRequest req, Users rq) {
        exigerResponsable(rq);

        ActionCapa etape = trouverEtape(etapeId);
        NonConformite nc = verrouillerNc(etape);
        exigerNonCloturee(nc);

        List<Audit> audits = auditRepository.findByActionCapaIdInOrderByDatePlanifieeAscIdAsc(List.of(etapeId));
        String motif = motifNonValidable(etape, audits);
        if (motif != null) throw new ResponseStatusException(HttpStatus.CONFLICT, motif);

        if (!req.efficace() && (req.commentaire() == null || req.commentaire().isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Un commentaire est obligatoire lorsque le traitement n'est pas efficace");
        }

        LocalDateTime maintenant = LocalDateTime.now();
        etape.setStatutAction(StatutAction.VERIFIEE.name());
        etape.setEfficace(req.efficace());
        etape.setCommentaireEfficacite(req.commentaire() == null || req.commentaire().isBlank()
                ? null : req.commentaire().trim());
        etape.setVerificateurId(rq.getId());
        etape.setDateVerification(maintenant);
        etape.setDateModification(maintenant);
        capaRepository.save(etape);

        journal.enregistrer(rq.getId(), "VALIDATE_CAPA", "ACTION_CAPA", etape.getId(),
                Map.of("ncId", nc.getId(), "efficace", req.efficace()));
        evenements.publier(nc.getId(), etape.getId(), null, "CAPA_VALIDEE",
                nom(rq) + " a validé une étape CAPA (" + (req.efficace() ? "efficace" : "non efficace") + ")");
        return construire(nc);
    }

    /** Revient sur une validation tant que la NC n'est pas clôturée. */
    @Transactional
    public SuiviNc annulerValidation(Long etapeId, Users rq) {
        exigerResponsable(rq);

        ActionCapa etape = trouverEtape(etapeId);
        NonConformite nc = verrouillerNc(etape);
        exigerNonCloturee(nc);
        if (!StatutAction.VERIFIEE.name().equals(etape.getStatutAction())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cette étape n'est pas validée");
        }

        etape.setStatutAction(StatutAction.TERMINEE.name());
        etape.setEfficace(null);
        etape.setCommentaireEfficacite(null);
        etape.setVerificateurId(null);
        etape.setDateVerification(null);
        etape.setDateModification(LocalDateTime.now());
        capaRepository.save(etape);

        journal.enregistrer(rq.getId(), "CANCEL_CAPA_VALIDATION", "ACTION_CAPA", etape.getId(),
                Map.of("ncId", nc.getId()));
        evenements.publier(nc.getId(), etape.getId(), null, "VALIDATION_ANNULEE",
                nom(rq) + " a annulé la validation d'une étape CAPA");
        return construire(nc);
    }

    // ------------------------------------------------------------------ clôture de la non-conformité
    @Transactional
    public SuiviNc cloturer(Long ncId, String commentaire, Users rq) {
        exigerResponsable(rq);

        NonConformite nc = ncRepository.findByIdForUpdate(ncId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Non-conformité introuvable"));
        exigerNonCloturee(nc);

        String motif = motifNonCloturable(capaRepository.findByNcIdOrderByIdAsc(ncId));
        if (motif != null) throw new ResponseStatusException(HttpStatus.CONFLICT, motif);

        LocalDateTime maintenant = LocalDateTime.now();
        String ancienStatut = nc.getStatut();
        nc.setStatut(StatutNc.CLOTUREE.name());
        nc.setDateCloturation(maintenant);
        nc.setDateModification(maintenant);
        ncRepository.save(nc);

        NcStatutHistorique h = new NcStatutHistorique();
        h.setNcId(nc.getId());
        h.setAncienStatut(ancienStatut);
        h.setNouveauStatut(StatutNc.CLOTUREE.name());
        h.setCommentaire(commentaire == null || commentaire.isBlank() ? null : commentaire.trim());
        h.setAuteurId(rq.getId());
        h.setDateChangement(maintenant);
        statutHistoriqueRepository.save(h);

        journal.enregistrer(rq.getId(), "CLOSE_NC", "NON_CONFORMITE", nc.getId(),
                Map.of("statutAvant", ancienStatut, "statutApres", StatutNc.CLOTUREE.name()));
        evenements.publier(nc.getId(), null, null, "NC_CLOTUREE",
                nom(rq) + " a clôturé la non-conformité " + nc.getReference());
        return construire(nc);
    }

    // ------------------------------------------------------------------ règles
    /** Une étape est validable quand un audit a confirmé la réalisation (TERMINEE) et qu'aucun audit n'est en cours. */
    private String motifNonValidable(ActionCapa etape, List<Audit> audits) {
        if (StatutAction.VERIFIEE.name().equals(etape.getStatutAction())) return "Étape déjà validée";
        if (audits.isEmpty()) return "Aucun audit n'a été planifié pour cette étape";
        if (audits.stream().anyMatch(a -> "EN_COURS".equals(a.getStatut()))) {
            return "Un audit est encore en cours sur cette étape";
        }
        boolean auditTermine = audits.stream().anyMatch(a -> "TERMINE".equals(a.getStatut()));
        if (!auditTermine) return "Aucun audit terminé pour cette étape";
        return null;
    }

    private String motifNonCloturable(List<ActionCapa> etapes) {
        if (etapes.isEmpty()) return "Aucune étape CAPA n'est définie pour cette non-conformité";
        long restantes = etapes.stream()
                .filter(e -> !StatutAction.VERIFIEE.name().equals(e.getStatutAction())).count();
        return restantes == 0 ? null : restantes + " étape(s) CAPA restent à valider";
    }

    // ------------------------------------------------------------------ construction du suivi
    private SuiviNc construire(NonConformite nc) {
        List<ActionCapa> etapes = capaRepository.findByNcIdOrderByIdAsc(nc.getId());
        List<Long> etapeIds = etapes.stream().map(ActionCapa::getId).toList();

        List<Audit> audits = etapeIds.isEmpty() ? List.of()
                : auditRepository.findByActionCapaIdInOrderByDatePlanifieeAscIdAsc(etapeIds);
        Map<Long, List<Audit>> auditsParEtape = audits.stream()
                .collect(Collectors.groupingBy(Audit::getActionCapaId));
        Map<Long, List<ConstatDto>> constats = assembleur.constatsParAudit(
                audits.stream().map(Audit::getId).toList());

        boolean cloturee = StatutNc.CLOTUREE.name().equals(nc.getStatut());
        List<EtapeSuivi> resultat = new ArrayList<>();
        int validees = 0;
        int nonEfficaces = 0;
        int realisees = 0;
        int partielles = 0;
        int nonRealisees = 0;

        for (int i = 0; i < etapes.size(); i++) {
            ActionCapa e = etapes.get(i);
            List<Audit> auditsEtape = auditsParEtape.getOrDefault(e.getId(), List.of());

            // Un seul résultat par étape : le dernier audit renseigné, pas chaque audit historique.
            String dernierResultat = auditsEtape.stream()
                    .filter(a -> "TERMINE".equals(a.getStatut()) && a.getResultatTraitement() != null)
                    .max(Comparator.comparing(Audit::getDatePlanifiee).thenComparing(Audit::getId))
                    .map(Audit::getResultatTraitement).orElse(null);
            if ("REALISE".equals(dernierResultat)) realisees++;
            else if ("PARTIEL".equals(dernierResultat)) partielles++;
            else if ("NON_REALISE".equals(dernierResultat)) nonRealisees++;

            boolean verifiee = StatutAction.VERIFIEE.name().equals(e.getStatutAction());
            if (verifiee) {
                validees++;
                if (Boolean.FALSE.equals(e.getEfficace())) nonEfficaces++;
            }

            String motif = cloturee ? "La non-conformité est clôturée" : motifNonValidable(e, auditsEtape);
            List<AuditSuivi> auditsSuivi = auditsEtape.stream()
                    .map(a -> new AuditSuivi(a.getId(), a.getDatePlanifiee(), a.getDateRealisation(),
                            a.getTypeAudit(), a.getStatut(), assembleur.personne(a.getAuditeurId()),
                            a.getResultatTraitement(), a.getCompteRendu(), a.getTraitementRealise(),
                            constats.getOrDefault(a.getId(), List.of())))
                    .toList();

            resultat.add(new EtapeSuivi(e.getId(), i + 1, e.getTypeAction(), e.getDescription(),
                    assembleur.personne(e.getResponsableActionId()), e.getDateEcheance(), e.getStatutAction(),
                    e.getEfficace(), e.getCommentaireEfficacite(), e.getDateVerification(),
                    assembleur.personne(e.getVerificateurId()),
                    motif == null, motif, auditsSuivi));
        }

        String motifCloture = cloturee ? "La non-conformité est déjà clôturée" : motifNonCloturable(etapes);
        return new SuiviNc(nc.getId(), nc.getReference(), nc.getTitre(), nc.getStatut(), cloturee,
                etapes.size(), validees, nonEfficaces, realisees, partielles, nonRealisees,
                motifCloture == null, motifCloture, resultat);
    }

    // ------------------------------------------------------------------ outils
    private NonConformite trouverNc(Long ncId) {
        return ncRepository.findById(ncId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Non-conformité introuvable"));
    }

    private ActionCapa trouverEtape(Long etapeId) {
        ActionCapa etape = capaRepository.findById(etapeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Étape CAPA introuvable"));
        if (etape.getNcId() == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Cette étape n'est rattachée à aucune non-conformité");
        }
        return etape;
    }

    /** Verrou sur la NC : une validation et une clôture ne peuvent pas se croiser. */
    private NonConformite verrouillerNc(ActionCapa etape) {
        return ncRepository.findByIdForUpdate(etape.getNcId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Non-conformité introuvable"));
    }

    private void exigerResponsable(Users u) {
        if (!Boolean.TRUE.equals(u.getActif()) || !"RESPONSABLE_QUALITE".equals(u.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Réservé au responsable qualité");
        }
    }

    private void exigerNonCloturee(NonConformite nc) {
        if (StatutNc.CLOTUREE.name().equals(nc.getStatut())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cette non-conformité est clôturée");
        }
    }

    private static String nom(Users u) {
        return u.getPrenom() + " " + u.getNom();
    }
}