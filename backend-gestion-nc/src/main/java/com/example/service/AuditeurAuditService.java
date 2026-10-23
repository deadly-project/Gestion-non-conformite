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

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Espace auditeur : calendrier de ses audits, constats, compte rendu et traitement constaté.
 * Cycle d'un audit : PLANIFIE -> EN_COURS (démarrer) -> TERMINE (terminer).
 * Terminer avec le résultat REALISE fait passer l'étape CAPA à TERMINEE : elle devient alors
 * validable par le responsable qualité.
 */
@Service
public class AuditeurAuditService {

    private static final String PLANIFIE = "PLANIFIE";
    private static final String EN_COURS = "EN_COURS";
    private static final String TERMINE = "TERMINE";
    private static final int JOURS_A_TRAITER = 14;

    private final AuditRepository auditRepository;
    private final ConstatAuditRepository constatRepository;
    private final ActionCapaRepository capaRepository;
    private final NonConformiteRepository ncRepository;
    private final AuditAssembleur assembleur;
    private final CapaEvenementService evenements;
    private final JournalActionsService journal;

    public AuditeurAuditService(AuditRepository auditRepository,
                                ConstatAuditRepository constatRepository,
                                ActionCapaRepository capaRepository,
                                NonConformiteRepository ncRepository,
                                AuditAssembleur assembleur,
                                CapaEvenementService evenements,
                                JournalActionsService journal) {
        this.auditRepository = auditRepository;
        this.constatRepository = constatRepository;
        this.capaRepository = capaRepository;
        this.ncRepository = ncRepository;
        this.assembleur = assembleur;
        this.evenements = evenements;
        this.journal = journal;
    }

    // ------------------------------------------------------------------ lecture
    @Transactional(readOnly = true)
    public List<AuditItem> mesAudits(Users auditeur, LocalDate du, LocalDate au) {
        LocalDate debut = du != null ? du : LocalDate.of(1900, 1, 1);
        LocalDate fin = au != null ? au : LocalDate.of(2999, 12, 31);
        return assembleur.items(auditRepository
                .findByAuditeurIdAndDatePlanifieeBetweenOrderByDatePlanifieeAscIdAsc(auditeur.getId(), debut, fin));
    }

    /** Audits à démarrer ou à terminer : en cours, en retard, ou prévus dans les 14 prochains jours. */
    @Transactional(readOnly = true)
    public List<AuditItem> aTraiter(Users auditeur) {
        return assembleur.items(auditRepository
                .findByAuditeurIdAndStatutInAndDatePlanifieeLessThanEqualOrderByDatePlanifieeAscIdAsc(
                        auditeur.getId(), Set.of(PLANIFIE, EN_COURS), LocalDate.now().plusDays(JOURS_A_TRAITER)));
    }

    /** Détail : l'auditeur concerné, le responsable qualité et l'administrateur. */
    @Transactional(readOnly = true)
    public AuditDetail detail(Long auditId, Users utilisateur) {
        Audit audit = trouver(auditId);
        if ("AUDITEUR".equals(utilisateur.getRole()) && !audit.getAuditeurId().equals(utilisateur.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cet audit ne vous est pas attribué");
        }
        return construireDetail(audit);
    }

    // ------------------------------------------------------------------ actions de l'auditeur
    @Transactional
    public AuditDetail demarrer(Long auditId, Users auditeur) {
        Audit audit = pourModification(auditId, auditeur);
        if (!PLANIFIE.equals(audit.getStatut())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cet audit est déjà démarré");
        }
        LocalDateTime maintenant = LocalDateTime.now();
        audit.setStatut(EN_COURS);
        audit.setDateModification(maintenant);
        auditRepository.save(audit);

        ActionCapa etape = etapeDe(audit);
        if (etape != null && StatutAction.A_FAIRE.name().equals(etape.getStatutAction())) {
            etape.setStatutAction(StatutAction.EN_COURS.name());
            etape.setDateModification(maintenant);
            capaRepository.save(etape);
        }

        journal.enregistrer(auditeur.getId(), "START_AUDIT", "AUDIT", audit.getId(),
                Map.of("titre", audit.getTitre()));
        publier(etape, audit, "AUDIT_DEMARRE", nom(auditeur) + " a démarré l'audit « " + audit.getTitre() + " »");
        return construireDetail(audit);
    }

    /** Enregistrement du brouillon : compte rendu, traitement constaté et résultat (tous facultatifs). */
    @Transactional
    public AuditDetail enregistrer(Long auditId, CompteRenduRequest req, Users auditeur) {
        Audit audit = pourModification(auditId, auditeur);
        exigerEnCours(audit);

        appliquerTextes(audit, req, etapeDe(audit) != null);
        audit.setDateModification(LocalDateTime.now());
        auditRepository.save(audit);

        journal.enregistrer(auditeur.getId(), "UPDATE_AUDIT", "AUDIT", audit.getId(),
                Map.of("titre", audit.getTitre()));
        publier(etapeDe(audit), audit, "AUDIT_ENREGISTRE",
                nom(auditeur) + " a mis à jour le compte rendu de « " + audit.getTitre() + " »");
        return construireDetail(audit);
    }

    @Transactional
    public AuditDetail ajouterConstat(Long auditId, ConstatRequest req, Users auditeur) {
        Audit audit = pourModification(auditId, auditeur);
        exigerEnCours(audit);

        ConstatAudit constat = new ConstatAudit();
        constat.setAuditId(audit.getId());
        constat.setTypeConstat(req.type());
        constat.setDescriptionConstat(req.description().trim());
        constat.setAuteurId(auditeur.getId());
        constatRepository.save(constat);

        journal.enregistrer(auditeur.getId(), "ADD_CONSTAT", "CONSTAT_AUDIT", constat.getId(),
                Map.of("auditId", audit.getId(), "type", req.type()));
        publier(etapeDe(audit), audit, "CONSTAT_AJOUTE",
                nom(auditeur) + " a ajouté un constat (" + libelleConstat(req.type()) + ") sur « " + audit.getTitre() + " »");
        return construireDetail(audit);
    }

    @Transactional
    public AuditDetail modifierConstat(Long auditId, Long constatId, ConstatRequest req, Users auditeur) {
        Audit audit = pourModification(auditId, auditeur);
        exigerEnCours(audit);

        ConstatAudit constat = constatDe(audit, constatId);
        constat.setTypeConstat(req.type());
        constat.setDescriptionConstat(req.description().trim());
        constatRepository.save(constat);

        journal.enregistrer(auditeur.getId(), "UPDATE_CONSTAT", "CONSTAT_AUDIT", constat.getId(),
                Map.of("auditId", audit.getId(), "type", req.type()));
        publier(etapeDe(audit), audit, "CONSTAT_MODIFIE",
                nom(auditeur) + " a modifié un constat de « " + audit.getTitre() + " »");
        return construireDetail(audit);
    }

    @Transactional
    public AuditDetail supprimerConstat(Long auditId, Long constatId, Users auditeur) {
        Audit audit = pourModification(auditId, auditeur);
        exigerEnCours(audit);

        ConstatAudit constat = constatDe(audit, constatId);
        constatRepository.delete(constat);   // ses commentaires partent avec lui (ON DELETE CASCADE)

        journal.enregistrer(auditeur.getId(), "DELETE_CONSTAT", "CONSTAT_AUDIT", constatId,
                Map.of("auditId", audit.getId()));
        publier(etapeDe(audit), audit, "CONSTAT_SUPPRIME",
                nom(auditeur) + " a supprimé un constat de « " + audit.getTitre() + " »");
        return construireDetail(audit);
    }

    /**
     * Valide l'audit : constats et traitement constaté deviennent définitifs.
     * Pour une étape CAPA, le résultat est obligatoire ; REALISE fait passer l'étape à TERMINEE.
     */
    @Transactional
    public AuditDetail terminer(Long auditId, CompteRenduRequest req, Users auditeur) {
        Audit audit = pourModification(auditId, auditeur);
        exigerEnCours(audit);

        ActionCapa etape = etapeDe(audit);
        appliquerTextes(audit, req, etape != null);

        if (isBlank(audit.getCompteRendu())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le compte rendu de l'audit est obligatoire");
        }
        if (etape != null) {
            if (isBlank(audit.getTraitementRealise())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Décrivez le traitement constaté sur le terrain");
            }
            if (audit.getResultatTraitement() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Indiquez si le traitement est réalisé, partiellement réalisé ou non réalisé");
            }
        }

        LocalDateTime maintenant = LocalDateTime.now();
        audit.setStatut(TERMINE);
        audit.setDateRealisation(LocalDate.now());
        audit.setDateModification(maintenant);
        auditRepository.save(audit);

        if (etape != null && audit.getResultatTraitement() != null
                && !StatutAction.VERIFIEE.name().equals(etape.getStatutAction())) {
            etape.setStatutAction(StatutAction.TERMINEE.name());
            if (etape.getDateRealisation() == null) etape.setDateRealisation(LocalDate.now());
            etape.setDateModification(maintenant);
            capaRepository.save(etape);
        }

        journal.enregistrer(auditeur.getId(), "CLOSE_AUDIT", "AUDIT", audit.getId(),
                Map.of("titre", audit.getTitre(),
                        "resultat", audit.getResultatTraitement() == null ? "" : audit.getResultatTraitement()));
        publier(etape, audit, "AUDIT_TERMINE",
                nom(auditeur) + " a terminé l'audit « " + audit.getTitre() + " »"
                        + (audit.getResultatTraitement() == null ? "" : " : " + libelleResultat(audit.getResultatTraitement())));
        return construireDetail(audit);
    }

    /**
     * Réouvre un audit terminé si le traitement est partiel ou non réalisé,
     * tant que l'échéance CAPA n'est pas dépassée.
     */
    @Transactional
    public AuditDetail reouvrir(Long auditId, Users auditeur) {
        if (!"AUDITEUR".equals(auditeur.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Réservé aux auditeurs");
        }
        Audit audit = trouver(auditId);
        if (!audit.getAuditeurId().equals(auditeur.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cet audit ne vous est pas attribué");
        }
        if (!TERMINE.equals(audit.getStatut())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Seul un audit terminé peut être réouvert");
        }
        if (!"PARTIEL".equals(audit.getResultatTraitement())
                && !"NON_REALISE".equals(audit.getResultatTraitement())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "La réouverture est réservée aux traitements partiels ou non réalisés");
        }
        ActionCapa etape = etapeDe(audit);
        if (etape == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cet audit n'est pas rattaché à une étape CAPA");
        }
        if (etape.getDateEcheance() == null || LocalDate.now().isAfter(etape.getDateEcheance())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "La date d'échéance du traitement est dépassée : réouverture impossible");
        }
        if (StatutAction.VERIFIEE.name().equals(etape.getStatutAction())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "L'étape CAPA a déjà été validée par le responsable qualité");
        }
        if (etape.getNcId() != null) {
            NonConformite nc = ncRepository.findById(etape.getNcId()).orElse(null);
            if (nc != null && StatutNc.CLOTUREE.name().equals(nc.getStatut())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "La non-conformité est clôturée");
            }
        }
        audit.setStatut(EN_COURS);
        audit.setDateModification(LocalDateTime.now());
        auditRepository.save(audit);
        journal.enregistrer(auditeur.getId(), "REOPEN_AUDIT", "AUDIT", audit.getId(),
                Map.of("resultatPrecedent", audit.getResultatTraitement(), "echeance", etape.getDateEcheance().toString()));
        publier(etape, audit, "AUDIT_REOUVERT",
                nom(auditeur) + " a réouvert l'audit « " + audit.getTitre() + " » pour reprendre le traitement");
        return construireDetail(audit);
    }

    // ------------------------------------------------------------------ outils
    private Audit trouver(Long auditId) {
        return auditRepository.findById(auditId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Audit introuvable"));
    }

    /** L'audit existe, appartient à l'auditeur et n'est verrouillé ni par sa fin, ni par une validation. */
    private Audit pourModification(Long auditId, Users auditeur) {
        if (!"AUDITEUR".equals(auditeur.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Réservé aux auditeurs");
        }
        Audit audit = trouver(auditId);
        if (!audit.getAuditeurId().equals(auditeur.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cet audit ne vous est pas attribué");
        }
        String motif = motifBlocage(audit, etapeDe(audit));
        if (motif != null) throw new ResponseStatusException(HttpStatus.CONFLICT, motif);
        return audit;
    }

    private void exigerEnCours(Audit audit) {
        if (!EN_COURS.equals(audit.getStatut())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Démarrez l'audit avant de le renseigner");
        }
    }

    private ConstatAudit constatDe(Audit audit, Long constatId) {
        return constatRepository.findById(constatId)
                .filter(c -> c.getAuditId().equals(audit.getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Constat introuvable"));
    }

    private ActionCapa etapeDe(Audit audit) {
        return audit.getActionCapaId() == null ? null : capaRepository.findById(audit.getActionCapaId()).orElse(null);
    }

    private String motifBlocage(Audit audit, ActionCapa etape) {
        if (TERMINE.equals(audit.getStatut())) return "Cet audit est terminé : il n'est plus modifiable";
        if (etape != null) {
            if (StatutAction.VERIFIEE.name().equals(etape.getStatutAction())) {
                return "L'étape CAPA a déjà été validée par le responsable qualité";
            }
            if (etape.getNcId() != null) {
                NonConformite nc = ncRepository.findById(etape.getNcId()).orElse(null);
                if (nc != null && StatutNc.CLOTUREE.name().equals(nc.getStatut())) {
                    return "La non-conformité est clôturée";
                }
            }
        }
        return null;
    }

    private void appliquerTextes(Audit audit, CompteRenduRequest req, boolean avecEtape) {
        audit.setCompteRendu(nettoyer(req.compteRendu()));
        if (avecEtape) {
            audit.setTraitementRealise(nettoyer(req.traitementRealise()));
            audit.setResultatTraitement(req.resultatTraitement());
        }
    }

    private AuditDetail construireDetail(Audit audit) {
        AuditItem item = assembleur.items(List.of(audit)).get(0);
        List<ConstatDto> constats = assembleur.constatsParAudit(List.of(audit.getId()))
                .getOrDefault(audit.getId(), List.of());
        String motif = motifBlocage(audit, etapeDe(audit));
        return new AuditDetail(item, audit.getCompteRendu(), audit.getTraitementRealise(),
                motif == null, motif, constats);
    }

    private void publier(ActionCapa etape, Audit audit, String type, String message) {
        if (etape != null) evenements.publier(etape.getNcId(), etape.getId(), audit.getId(), type, message);
    }

    private static String nom(Users u) {
        return u.getPrenom() + " " + u.getNom();
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String nettoyer(String s) {
        return isBlank(s) ? null : s.trim();
    }

    private static String libelleConstat(String type) {
        return switch (type) {
            case "ECART" -> "écart";
            case "POINT_FORT" -> "point fort";
            default -> "remarque";
        };
    }

    private static String libelleResultat(String resultat) {
        return switch (resultat) {
            case "REALISE" -> "traitement réalisé";
            case "PARTIEL" -> "traitement partiellement réalisé";
            default -> "traitement non réalisé";
        };
    }
}