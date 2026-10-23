package com.example.service;

import com.example.domain.StatutAction;
import com.example.domain.StatutNc;
import com.example.dto.nc.*;
import com.example.entity.*;
import com.example.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Stream;

/**
 * Traitement d'une NC par le responsable qualité (formulaire « Actions ») :
 * analyse Ishikawa + 5 Pourquoi, auditeur, nature, gravité retenue, statut, délai et plan d'actions.
 */
@Service
public class NcTraitementService {

    /** Statuts proposés par le formulaire. La clôture exige des CAPA vérifiées : autre étape. */
    private static final Set<StatutNc> STATUTS_AUTORISES =
            EnumSet.of(StatutNc.OUVERT, StatutNc.EN_COURS_D_ANALYSE, StatutNc.EN_TRAITEMENT, StatutNc.EN_ATTENTE);

    private final NonConformiteRepository ncRepository;
    private final CategorieNcRepository categorieRepository;
    private final UtilisateurRepository utilisateurRepository;
    private final IshikawaAnalyseRepository ishikawaRepository;
    private final ActionCapaRepository capaRepository;
    private final NcStatutHistoriqueRepository statutHistoriqueRepository;
    private final NcCompteurRepository compteurRepository;
    private final NcConsultationService consultationService;
    private final JournalActionsService journal;

    public NcTraitementService(NonConformiteRepository ncRepository,
                               CategorieNcRepository categorieRepository,
                               UtilisateurRepository utilisateurRepository,
                               IshikawaAnalyseRepository ishikawaRepository,
                               ActionCapaRepository capaRepository,
                               NcStatutHistoriqueRepository statutHistoriqueRepository,
                               NcCompteurRepository compteurRepository,
                               NcConsultationService consultationService,
                               JournalActionsService journal) {
        this.ncRepository = ncRepository;
        this.categorieRepository = categorieRepository;
        this.utilisateurRepository = utilisateurRepository;
        this.ishikawaRepository = ishikawaRepository;
        this.capaRepository = capaRepository;
        this.statutHistoriqueRepository = statutHistoriqueRepository;
        this.compteurRepository = compteurRepository;
        this.consultationService = consultationService;
        this.journal = journal;
    }

    @Transactional
    public NcDetailResponse traiter(Long ncId, TraitementNcRequest req, Users acteur) {
        if (!Boolean.TRUE.equals(acteur.getActif()) || !"RESPONSABLE_QUALITE".equals(acteur.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Réservé au responsable qualité");
        }

        NonConformite nc = ncRepository.findByIdForUpdate(ncId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Non-conformité introuvable"));

        StatutNc statutActuel = StatutNc.valueOf(nc.getStatut());
        if (statutActuel == StatutNc.CLOTUREE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cette non-conformité est clôturée : elle ne peut plus être modifiée ici");
        }
        if (!STATUTS_AUTORISES.contains(req.statut())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Statut non autorisé : la clôture se fait après vérification des actions");
        }
        if (req.statut().getOrdre() < statutActuel.getOrdre()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Retour en arrière interdit : la NC est déjà « " + statutActuel + " »");
        }

        // Gestion de la catégorie (si non fournie, on garde celle de la NC)
        Long categorieIdFinal = req.categorieId() != null ? req.categorieId() : nc.getCategorieId();
        if (categorieIdFinal != null) {
            categorieRepository.findById(categorieIdFinal)
                    .filter(c -> Boolean.TRUE.equals(c.getActif()))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Nature (catégorie) introuvable ou inactive"));
        }

        // Vérification de l'auditeur uniquement s'il est renseigné
        if (req.auditeurId() != null) {
            utilisateurRepository.findById(req.auditeurId())
                    .filter(u -> Boolean.TRUE.equals(u.getActif()) && "AUDITEUR".equals(u.getRole()))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "L'utilisateur choisi n'est pas un auditeur actif"));
        }

        LocalDateTime maintenant = LocalDateTime.now();

        // --- Attribution de la référence (une seule fois, par le responsable qualité) ---
        String referenceAttribuee = null;
        if (nc.getReference() == null || nc.getReference().isBlank()) {
            if (Boolean.TRUE.equals(req.genererReference())) {
                referenceAttribuee = genererReferenceUnique();
            } else if (req.reference() != null && !req.reference().isBlank()) {
                String proposee = req.reference().trim();
                if (ncRepository.findByReference(proposee).isPresent()) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cette référence existe déjà");
                }
                referenceAttribuee = proposee;
            } else {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Attribuez une référence à cette non-conformité ou cochez la génération automatique");
            }
            nc.setReference(referenceAttribuee);
        }

        // --- Champs de qualification ---
        if (req.gravite() != null) {
            nc.setGravite(req.gravite().name());
        }
        nc.setCategorieId(categorieIdFinal);
        if (req.auditeurId() != null) {
            nc.setAuditeurId(req.auditeurId());
        }
        nc.setResponsableId(acteur.getId());
        if (req.delaisJours() != null) {
            nc.setDelaisJours(req.delaisJours());
        }
        if (nc.getDateOuverture() == null) {
            nc.setDateOuverture(maintenant);
        }
        if (nc.getDelaisJours() != null) {
            nc.setDateEcheance(nc.getDateOuverture().toLocalDate().plusDays(nc.getDelaisJours()));
        }
        if (req.statut() == StatutNc.EN_TRAITEMENT && nc.getDateCommencementTraitement() == null) {
            nc.setDateCommencementTraitement(maintenant);
        }

        // --- Analyse des causes et plan d'actions ---
        synchroniserIshikawa(nc.getId(), req.analyses(), acteur.getId(), maintenant);
        synchroniserEtapes(nc.getId(), req.etapesCapa(), maintenant);

        if (req.statut() == StatutNc.EN_TRAITEMENT && capaRepository.countByNcId(nc.getId()) == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Au moins une étape du plan d'actions est requise pour passer en traitement");
        }

        // --- Statut + historique ---
        if (req.statut() != statutActuel) {
            NcStatutHistorique h = new NcStatutHistorique();
            h.setNcId(nc.getId());
            h.setAncienStatut(statutActuel.name());
            h.setNouveauStatut(req.statut().name());
            h.setAuteurId(acteur.getId());
            h.setDateChangement(maintenant);
            statutHistoriqueRepository.save(h);
            nc.setStatut(req.statut().name());
        }
        nc.setDateModification(maintenant);
        ncRepository.save(nc);

        Map<String, Object> detailsTraitement = new HashMap<>();
        detailsTraitement.put("statutAvant", statutActuel.name());
        detailsTraitement.put("statutApres", req.statut().name());
        detailsTraitement.put("gravite", req.gravite() != null ? req.gravite().name() : "");
        detailsTraitement.put("etapesCapa", req.etapesCapa().size());
        if (referenceAttribuee != null) detailsTraitement.put("referenceAttribuee", referenceAttribuee);
        journal.enregistrer(acteur.getId(), "UPDATE_NC", "NON_CONFORMITE", nc.getId(), detailsTraitement);

        return consultationService.detail(nc.getId());
    }

    /** Référence unique au format NC-ANNEE-NNNN, séquence annuelle verrouillée. */
    private String genererReferenceUnique() {
        int annee = LocalDate.now().getYear();
        compteurRepository.creerSiAbsent(annee);
        NcCompteur compteur = compteurRepository.findByAnneeForUpdate(annee)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "Compteur de références indisponible"));

        int numero = compteur.getDernierNumero() == null ? 1 : compteur.getDernierNumero() + 1;
        String reference = String.format("NC-%d-%04d", annee, numero);
        while (ncRepository.findByReference(reference).isPresent()) {
            numero++;
            reference = String.format("NC-%d-%04d", annee, numero);
        }
        compteur.setDernierNumero(numero);
        compteurRepository.save(compteur);
        return reference;
    }

    // ------------------------------------------------------------------
    // Ishikawa : une ligne par branche (upsert sur nc_id + branche)
    // ------------------------------------------------------------------
    private void synchroniserIshikawa(Long ncId, List<AnalyseIshikawaDto> analyses, Long auteurId, LocalDateTime maintenant) {
        Map<String, IshikawaAnalyse> existantes = new HashMap<>();
        ishikawaRepository.findByNcId(ncId).forEach(a -> existantes.put(a.getBranche(), a));

        Set<String> vues = new HashSet<>();
        for (AnalyseIshikawaDto dto : analyses) {
            String branche = dto.branche().name();
            if (!vues.add(branche)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Branche d'Ishikawa en double : " + branche);
            }
            IshikawaAnalyse a = existantes.get(branche);
            if (a == null) {
                if (toutVide(dto)) {
                    continue;              // pas de ligne vide en base
                }
                a = new IshikawaAnalyse();
                a.setNcId(ncId);
                a.setBranche(branche);
            }
            a.setPourquoi1(nettoyer(dto.pourquoi1()));
            a.setPourquoi2(nettoyer(dto.pourquoi2()));
            a.setPourquoi3(nettoyer(dto.pourquoi3()));
            a.setPourquoi4(nettoyer(dto.pourquoi4()));
            a.setPourquoi5(nettoyer(dto.pourquoi5()));
            a.setCauseRacineValidee(nettoyer(dto.causeRacineValidee()));
            a.setAuteurId(auteurId);
            a.setDateModification(maintenant);
            ishikawaRepository.save(a);
        }
    }

    private boolean toutVide(AnalyseIshikawaDto d) {
        return Stream.of(d.pourquoi1(), d.pourquoi2(), d.pourquoi3(), d.pourquoi4(), d.pourquoi5(), d.causeRacineValidee())
                .allMatch(s -> s == null || s.isBlank());
    }

    // ------------------------------------------------------------------
    // Plan d'actions : créer / modifier / retirer, sans toucher aux étapes déjà démarrées
    // ------------------------------------------------------------------
    private void synchroniserEtapes(Long ncId, List<EtapeCapaDto> etapes, LocalDateTime maintenant) {
        List<ActionCapa> existantes = capaRepository.findByNcIdOrderByIdAsc(ncId);
        Map<Long, ActionCapa> parId = new HashMap<>();
        existantes.forEach(a -> parId.put(a.getId(), a));

        LocalDate aujourdhui = LocalDate.now();
        Set<Long> idsRecus = new HashSet<>();

        for (EtapeCapaDto dto : etapes) {
            utilisateurRepository.findById(dto.responsableId())
                    .filter(u -> Boolean.TRUE.equals(u.getActif()))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Responsable d'étape introuvable ou inactif"));

            if (dto.id() == null) {
                if (dto.dateEcheance().isBefore(aujourdhui)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "L'échéance d'une nouvelle étape ne peut pas être passée");
                }
                ActionCapa a = new ActionCapa();
                a.setNcId(ncId);
                a.setTypeAction(dto.type().name());
                a.setDescription(dto.description().trim());
                a.setResponsableActionId(dto.responsableId());
                a.setStatutAction(StatutAction.A_FAIRE.name());
                a.setDateEcheance(dto.dateEcheance());
                a.setDateCreation(maintenant);
                capaRepository.save(a);
            } else {
                ActionCapa a = parId.get(dto.id());
                if (a == null) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Étape inconnue pour cette non-conformité");
                }
                idsRecus.add(a.getId());
                if (StatutAction.A_FAIRE.name().equals(a.getStatutAction())) {   // étape pas encore démarrée
                    if (dto.dateEcheance().isBefore(aujourdhui) && !dto.dateEcheance().equals(a.getDateEcheance())) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                "L'échéance d'une étape ne peut pas être déplacée dans le passé");
                    }
                    a.setTypeAction(dto.type().name());
                    a.setDescription(dto.description().trim());
                    a.setResponsableActionId(dto.responsableId());
                    a.setDateEcheance(dto.dateEcheance());
                    a.setDateModification(maintenant);
                    capaRepository.save(a);
                }
            }
        }

        // Étapes retirées du formulaire : supprimées seulement si elles n'ont pas démarré
        for (ActionCapa a : existantes) {
            if (!idsRecus.contains(a.getId()) && StatutAction.A_FAIRE.name().equals(a.getStatutAction())) {
                capaRepository.delete(a);
            }
        }
    }

    private String nettoyer(String texte) {
        return texte == null || texte.isBlank() ? null : texte.trim();
    }
}
