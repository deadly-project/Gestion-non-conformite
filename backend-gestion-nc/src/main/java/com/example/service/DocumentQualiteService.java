package com.example.service;

import com.example.domain.StatutDocument;
import com.example.domain.TypeDocument;
import com.example.domain.TypeNotification;
import com.example.dto.audit.AuditDtos.PersonneResume;
import com.example.dto.document.DocumentDtos.*;
import com.example.dto.nc.PageResponse;
import com.example.entity.DocumentQualite;
import com.example.entity.Processus;
import com.example.entity.Users;
import com.example.repository.DocumentQualiteRepository;
import com.example.repository.ProcessusRepository;
import com.example.repository.UtilisateurRepository;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Gestion documentaire qualité.
 *
 * Droits par rôle (une seule table : {@link #droitsDuRole(String)}) :
 *  - RESPONSABLE_QUALITE : consulter, ajouter, modifier, changer le statut / archiver, voir les archives ;
 *  - ADMINISTRATEUR      : consulter (archives comprises), lecture seule ;
 *  - AUDITEUR, DECLARANT : consulter les documents non archivés.
 * Un document archivé (OBSOLETE) est conservé : jamais supprimé, plus modifiable, consultable par les
 * rôles autorisés ; il ne peut revenir qu'en révision.
 * Chaque ajout / modification / changement de statut est journalisé et notifié.
 */
@Service
public class DocumentQualiteService {

    public static final String ENTITE = "DOCUMENT_QUALITE";

    private static final Pattern REFERENCE = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9._-]{0,49}$");
    private static final Set<String> INLINE = Set.of("application/pdf", "image/png", "image/jpeg", "text/plain");

    public record FichierLu(Resource ressource, String nom, String mime, boolean affichable) {}

    private final DocumentQualiteRepository repository;
    private final ProcessusRepository processusRepository;
    private final UtilisateurRepository utilisateurRepository;
    private final PieceJointeService stockage;
    private final DocumentFichierValidateur validateur;
    private final JournalActionsService journal;
    private final NotificationService notifications;

    public DocumentQualiteService(DocumentQualiteRepository repository,
                                  ProcessusRepository processusRepository,
                                  UtilisateurRepository utilisateurRepository,
                                  PieceJointeService stockage,
                                  DocumentFichierValidateur validateur,
                                  JournalActionsService journal,
                                  NotificationService notifications) {
        this.repository = repository;
        this.processusRepository = processusRepository;
        this.utilisateurRepository = utilisateurRepository;
        this.stockage = stockage;
        this.validateur = validateur;
        this.journal = journal;
        this.notifications = notifications;
    }

    // ------------------------------------------------------------------ droits
    public static Droits droitsDuRole(String role) {
        if (role == null) return new Droits(false, false, false, false, false);
        return switch (role) {
            case "RESPONSABLE_QUALITE" -> new Droits(true, true, true, true, true);
            case "ADMINISTRATEUR" -> new Droits(true, false, false, false, true);
            case "AUDITEUR", "DECLARANT" -> new Droits(true, false, false, false, false);
            default -> new Droits(false, false, false, false, false);
        };
    }

    @Transactional(readOnly = true)
    public MesDroits mesDroits(Users u) {
        List<DroitsRole> matrice = List.of(
                new DroitsRole("RESPONSABLE_QUALITE", "Responsable qualité", droitsDuRole("RESPONSABLE_QUALITE")),
                new DroitsRole("ADMINISTRATEUR", "Administrateur", droitsDuRole("ADMINISTRATEUR")),
                new DroitsRole("AUDITEUR", "Auditeur", droitsDuRole("AUDITEUR")),
                new DroitsRole("DECLARANT", "Déclarant", droitsDuRole("DECLARANT")));
        return new MesDroits(droitsDuRole(u.getRole()), matrice);
    }

    // ------------------------------------------------------------------ consultation
    @Transactional(readOnly = true)
    public PageResponse<DocumentItem> lister(Users u, String q, Long processusId, String type, String statut,
                                             String vue, int page, int taille) {
        Droits droits = exiger(u, Droits::consulter, "Consultation des documents non autorisée");

        String typeNet = nettoyer(type);
        String statutNet = nettoyer(statut);
        if (!typeNet.isEmpty()) valeurType(typeNet);
        if (!statutNet.isEmpty()) valeurStatut(statutNet);

        String vueNette = nettoyer(vue);
        if (!Set.of("ACTIFS", "ARCHIVES", "TOUS").contains(vueNette)) vueNette = "ACTIFS";
        boolean demandeArchives = "ARCHIVES".equals(vueNette) || StatutDocument.OBSOLETE.name().equals(statutNet);
        if (demandeArchives && !droits.consulterArchives()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Les archives sont réservées au responsable qualité");
        }
        if ("TOUS".equals(vueNette) && !droits.consulterArchives()) vueNette = "ACTIFS";

        String texte = q == null ? "" : q.trim().toLowerCase(Locale.ROOT)
                .replace("!", "!!").replace("%", "!%").replace("_", "!_");

        Page<DocumentQualite> resultat = repository.rechercher(
                processusId == null ? -1L : processusId, typeNet, statutNet, vueNette, texte,
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(taille, 1), 50)));

        return new PageResponse<>(versItems(resultat.getContent()), resultat.getNumber(), resultat.getSize(),
                resultat.getTotalElements(), resultat.getTotalPages());
    }

    /** Bibliothèque commune : seuls les documents en vigueur sont diffusés aux autres rôles. */
    @Transactional(readOnly = true)
    public PageResponse<DocumentItem> listerBibliotheque(Users u, String q, Long processusId,
                                                         String type, int page, int taille) {
        if (u == null || !Boolean.TRUE.equals(u.getActif())
                || !Set.of("ADMINISTRATEUR", "AUDITEUR", "DECLARANT").contains(u.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "La bibliothèque documentaire est réservée aux administrateurs, auditeurs et déclarants.");
        }
        return lister(u, q, processusId, type, StatutDocument.EN_VIGUEUR.name(), "ACTIFS", page, taille);
    }

    @Transactional(readOnly = true)
    public Statistiques statistiques(Users u) {
        Droits droits = exiger(u, Droits::consulter, "Consultation des documents non autorisée");
        Map<String, Long> parStatut = new HashMap<>();
        for (Object[] ligne : repository.compterParStatut()) {
            parStatut.put((String) ligne[0], ((Number) ligne[1]).longValue());
        }
        long vigueur = parStatut.getOrDefault(StatutDocument.EN_VIGUEUR.name(), 0L);
        long revision = parStatut.getOrDefault(StatutDocument.EN_REVISION.name(), 0L);
        long obsolete = droits.consulterArchives() ? parStatut.getOrDefault(StatutDocument.OBSOLETE.name(), 0L) : 0L;
        return new Statistiques(vigueur + revision + obsolete, vigueur, revision, obsolete);
    }

    @Transactional(readOnly = true)
    public DocumentItem detail(Long id, Users u) {
        return versItems(List.of(consultable(id, u))).get(0);
    }

    @Transactional(readOnly = true)
    public FichierLu lireFichier(Long id, Users u) {
        DocumentQualite d = consultable(id, u);
        String mime = d.getMimeType() == null ? "application/octet-stream" : d.getMimeType();
        return new FichierLu(stockage.lireParCle(d.getCheminFichier()), d.getNomFichier(), mime, INLINE.contains(mime));
    }

    @Transactional(readOnly = true)
    public DocumentItem detailBibliotheque(Long id, Users u) {
        return versItems(List.of(documentEnVigueur(id, u))).get(0);
    }

    @Transactional(readOnly = true)
    public FichierLu lireFichierBibliotheque(Long id, Users u) {
        DocumentQualite d = documentEnVigueur(id, u);
        String mime = d.getMimeType() == null ? "application/octet-stream" : d.getMimeType();
        return new FichierLu(stockage.lireParCle(d.getCheminFichier()), d.getNomFichier(), mime, INLINE.contains(mime));
    }

    // ------------------------------------------------------------------ ajout
    @Transactional
    public DocumentItem ajouter(CreationRequest req, MultipartFile fichier, Users acteur) {
        exiger(acteur, Droits::ajouter, "Réservé au responsable qualité");
        if (req == null) throw refus("Données du document manquantes.");

        String reference = req.reference() == null ? "" : req.reference().trim().toUpperCase(Locale.ROOT);
        if (!REFERENCE.matcher(reference).matches()) {
            throw refus("Référence invalide : lettres, chiffres, « . », « _ » ou « - » (50 caractères maximum), ex. PR-PROD-001.");
        }
        String titre = titreValide(req.titre());
        String description = descriptionValide(req.description());
        String type = valeurType(nettoyer(req.typeDocument()));
        String statut = req.statut() == null || req.statut().isBlank()
                ? StatutDocument.EN_VIGUEUR.name() : valeurStatut(nettoyer(req.statut()));
        if (StatutDocument.OBSOLETE.name().equals(statut)) {
            throw refus("Un nouveau document ne peut pas être ajouté directement comme obsolète.");
        }
        Processus processus = processusActif(req.processusId());
        if (repository.existsByReferenceIgnoreCase(reference)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cette référence existe déjà : " + reference);
        }

        PieceJointeService.FichierValide valide = validateur.valider(fichier);
        String cle = stockage.stocker("documents-qualite", valide);

        LocalDateTime maintenant = LocalDateTime.now();
        DocumentQualite d = new DocumentQualite();
        d.setReference(reference);
        d.setTitre(titre);
        d.setDescription(description);
        d.setTypeDocument(type);
        d.setStatut(statut);
        d.setVersion("1.0");
        d.setNomFichier(validateur.nomAffichable(fichier.getOriginalFilename()));
        d.setCheminFichier(cle);
        d.setMimeType(valide.mime());
        d.setTailleOctets(fichier.getSize());
        d.setProcessusId(processus.getId());
        d.setCreateurId(acteur.getId());
        d.setDateApplication(StatutDocument.EN_VIGUEUR.name().equals(statut) ? LocalDate.now() : null);
        d.setDateCreation(maintenant);
        d = repository.save(d);

        Map<String, Object> contexte = new LinkedHashMap<>();
        contexte.put("processus", processus.getLibelle());
        journal.enregistrerModification(acteur.getId(), "ADD_DOCUMENT", ENTITE, d.getId(),
                null, Instantane.de(d), contexte);

        notifier(d, acteur, TypeNotification.DOCUMENT_AJOUTE,
                "Nouveau document " + d.getReference() + " « " + NotificationService.extrait(d.getTitre(), 80)
                        + " » ajouté par " + NotificationService.nom(acteur) + " (" + libelleStatut(statut) + ").",
                StatutDocument.EN_VIGUEUR.name().equals(statut));
        return versItems(List.of(d)).get(0);
    }

    // ------------------------------------------------------------------ modification des informations
    @Transactional
    public DocumentItem modifier(Long id, ModificationRequest req, Users acteur) {
        exiger(acteur, Droits::modifier, "Réservé au responsable qualité");
        if (req == null) throw refus("Données du document manquantes.");
        DocumentQualite d = trouver(id);
        if (StatutDocument.OBSOLETE.name().equals(d.getStatut())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Un document archivé ne peut plus être modifié : remettez-le d'abord en révision.");
        }

        String titre = titreValide(req.titre());
        String description = descriptionValide(req.description());
        Processus processus = processusActifOuActuel(req.processusId(), d);

        if (titre.equals(d.getTitre()) && Objects.equals(description, d.getDescription())
                && processus.getId().equals(d.getProcessusId())) {
            return versItems(List.of(d)).get(0);   // rien à enregistrer, rien à journaliser
        }

        var avant = Instantane.de(d);
        d.setTitre(titre);
        d.setDescription(description);
        d.setProcessusId(processus.getId());
        d.setDateModification(LocalDateTime.now());
        d = repository.save(d);

        Map<String, Object> contexte = new LinkedHashMap<>();
        contexte.put("processus", processus.getLibelle());
        journal.enregistrerModification(acteur.getId(), "UPDATE_DOCUMENT", ENTITE, d.getId(),
                avant, Instantane.de(d), contexte);

        notifier(d, acteur, TypeNotification.DOCUMENT_MODIFIE,
                "Les informations du document " + d.getReference() + " « "
                        + NotificationService.extrait(d.getTitre(), 80) + " » ont été modifiées par "
                        + NotificationService.nom(acteur) + ".", false);
        return versItems(List.of(d)).get(0);
    }

    // ------------------------------------------------------------------ statut / archivage
    @Transactional
    public DocumentItem changerStatut(Long id, StatutRequest req, Users acteur) {
        exiger(acteur, Droits::changerStatut, "Réservé au responsable qualité");
        if (req == null) throw refus("Statut manquant.");
        String nouveau = valeurStatut(nettoyer(req.statut()));
        DocumentQualite d = trouver(id);
        String ancien = d.getStatut();

        if (nouveau.equals(ancien)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Le document est déjà « " + libelleStatut(ancien) + " ».");
        }
        if (StatutDocument.OBSOLETE.name().equals(ancien) && !StatutDocument.EN_REVISION.name().equals(nouveau)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Un document archivé ne peut revenir qu'en révision avant d'être remis en vigueur.");
        }
        String commentaire = req.commentaire() == null || req.commentaire().isBlank() ? null : req.commentaire().trim();
        if (commentaire != null && commentaire.length() > 1000) throw refus("Commentaire trop long (1000 caractères maximum).");

        var avant = Instantane.de(d);
        LocalDateTime maintenant = LocalDateTime.now();
        d.setStatut(nouveau);
        if (StatutDocument.EN_VIGUEUR.name().equals(nouveau)) d.setDateApplication(LocalDate.now());
        d.setDateModification(maintenant);
        d = repository.save(d);

        boolean archive = StatutDocument.OBSOLETE.name().equals(nouveau);
        Map<String, Object> contexte = new LinkedHashMap<>();
        contexte.put("ancienStatut", ancien);
        contexte.put("nouveauStatut", nouveau);
        if (commentaire != null) contexte.put("commentaire", commentaire);
        journal.enregistrerModification(acteur.getId(), archive ? "ARCHIVE_DOCUMENT" : "CHANGE_DOCUMENT_STATUS",
                ENTITE, d.getId(), avant, Instantane.de(d), contexte);

        String base = "Le document " + d.getReference() + " « " + NotificationService.extrait(d.getTitre(), 80) + " » ";
        String message = archive
                ? base + "a été archivé (obsolète) par " + NotificationService.nom(acteur) + " : il n'est plus applicable."
                : base + "est passé de « " + libelleStatut(ancien) + " » à « " + libelleStatut(nouveau)
                + " » (" + NotificationService.nom(acteur) + ").";
        notifier(d, acteur, archive ? TypeNotification.DOCUMENT_ARCHIVE : TypeNotification.DOCUMENT_STATUT_CHANGE,
                message, archive || StatutDocument.EN_VIGUEUR.name().equals(nouveau));
        return versItems(List.of(d)).get(0);
    }

    // ------------------------------------------------------------------ notifications
    /**
     * Tous les responsables qualité (sauf l'auteur de l'action) ; les auditeurs et déclarants seulement
     * quand le document devient applicable ou cesse de l'être (diffusion).
     */
    private void notifier(DocumentQualite d, Users acteur, String type, String message, boolean diffuser) {
        notifications.notifierRole("RESPONSABLE_QUALITE", acteur.getId(), type, message, ENTITE, d.getId());
        if (diffuser) {
            notifications.notifierRole("AUDITEUR", acteur.getId(), type, message, ENTITE, d.getId());
            notifications.notifierRole("DECLARANT", acteur.getId(), type, message, ENTITE, d.getId());
        }
    }

    // ------------------------------------------------------------------ outils
    private DocumentQualite trouver(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Document introuvable"));
    }

    private DocumentQualite consultable(Long id, Users u) {
        Droits droits = exiger(u, Droits::consulter, "Consultation des documents non autorisée");
        DocumentQualite d = trouver(id);
        if (StatutDocument.OBSOLETE.name().equals(d.getStatut()) && !droits.consulterArchives()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Ce document est archivé");
        }
        return d;
    }

    private DocumentQualite documentEnVigueur(Long id, Users u) {
        if (u == null || !Boolean.TRUE.equals(u.getActif())
                || !Set.of("ADMINISTRATEUR", "AUDITEUR", "DECLARANT").contains(u.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Accès à la bibliothèque documentaire refusé.");
        }
        DocumentQualite d = trouver(id);
        if (!StatutDocument.EN_VIGUEUR.name().equals(d.getStatut())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Document en vigueur introuvable.");
        }
        return d;
    }

    private Droits exiger(Users u, java.util.function.Predicate<Droits> droit, String message) {
        Droits droits = droitsDuRole(u.getRole());
        if (!Boolean.TRUE.equals(u.getActif()) || !droit.test(droits)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, message);
        }
        return droits;
    }

    private Processus processusActif(Long id) {
        if (id == null) throw refus("Le processus est obligatoire.");
        return processusRepository.findById(id)
                .filter(p -> Boolean.TRUE.equals(p.getActif()))
                .orElseThrow(() -> refus("Processus introuvable ou inactif."));
    }

    /** À la modification, le processus actuel reste accepté même s'il a été désactivé depuis. */
    private Processus processusActifOuActuel(Long id, DocumentQualite d) {
        if (id != null && id.equals(d.getProcessusId())) {
            return processusRepository.findById(id).orElseThrow(() -> refus("Processus introuvable."));
        }
        return processusActif(id);
    }

    private String titreValide(String titre) {
        String t = titre == null ? "" : titre.trim();
        if (t.isEmpty()) throw refus("Le titre est obligatoire.");
        if (t.length() > 255) throw refus("Titre trop long (255 caractères maximum).");
        return t;
    }

    private String descriptionValide(String description) {
        if (description == null || description.isBlank()) return null;
        String t = description.trim();
        if (t.length() > 4000) throw refus("Description trop longue (4000 caractères maximum).");
        return t;
    }

    private String valeurType(String valeur) {
        try {
            return TypeDocument.valueOf(valeur).name();
        } catch (IllegalArgumentException e) {
            throw refus("Type de document invalide (PROCEDURE, INSTRUCTION ou ENREGISTREMENT).");
        }
    }

    private String valeurStatut(String valeur) {
        try {
            return StatutDocument.valueOf(valeur).name();
        } catch (IllegalArgumentException e) {
            throw refus("Statut invalide (EN_VIGUEUR, EN_REVISION ou OBSOLETE).");
        }
    }

    private String nettoyer(String valeur) {
        return valeur == null ? "" : valeur.trim().toUpperCase(Locale.ROOT);
    }

    private ResponseStatusException refus(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    public static String libelleStatut(String statut) {
        if (statut == null) return "";
        return switch (statut) {
            case "EN_VIGUEUR" -> "En vigueur";
            case "EN_REVISION" -> "En révision";
            case "OBSOLETE" -> "Obsolète";
            default -> statut;
        };
    }

    /** Résout processus et créateurs en une requête chacun (pas de N+1). */
    private List<DocumentItem> versItems(List<DocumentQualite> documents) {
        if (documents.isEmpty()) return List.of();
        Map<Long, Processus> processus = processusRepository
                .findAllById(documents.stream().map(DocumentQualite::getProcessusId).distinct().toList())
                .stream().collect(Collectors.toMap(Processus::getId, Function.identity()));
        Map<Long, Users> createurs = utilisateurRepository
                .findAllById(documents.stream().map(DocumentQualite::getCreateurId).distinct().toList())
                .stream().collect(Collectors.toMap(Users::getId, Function.identity()));

        return documents.stream().map(d -> {
            Processus p = processus.get(d.getProcessusId());
            Users c = createurs.get(d.getCreateurId());
            return new DocumentItem(d.getId(), d.getReference(), d.getTitre(), d.getDescription(),
                    d.getTypeDocument(), d.getStatut(), d.getVersion(), d.getNomFichier(), d.getMimeType(),
                    d.getTailleOctets(),
                    p == null ? null : new ProcessusResume(p.getId(), p.getCode(), p.getLibelle()),
                    c == null ? null : new PersonneResume(c.getId(), c.getNom(), c.getPrenom(), c.getMatricule()),
                    d.getDateApplication(), d.getDateCreation(), d.getDateModification());
        }).toList();
    }
}