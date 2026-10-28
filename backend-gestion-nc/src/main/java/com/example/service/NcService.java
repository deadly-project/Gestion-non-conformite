package com.example.service;

import com.example.domain.StatutNc;
import com.example.domain.TypeNotification;
import com.example.dto.nc.DeclarationNcRequest;
import com.example.dto.nc.NcCreeResponse;
import com.example.entity.NcStatutHistorique;
import com.example.entity.NonConformite;
import com.example.entity.Processus;
import com.example.entity.Users;
import com.example.repository.NcStatutHistoriqueRepository;
import com.example.repository.NonConformiteRepository;
import com.example.repository.ProcessusRepository;

import com.example.dto.nc.NcDetailResponse;
import com.example.service.NcConsultationService;

import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** Déclaration d'une non-conformité (tout employé connecté, quel que soit son rôle). */
@Service
public class NcService {

    private final NonConformiteRepository ncRepository;
    private final NcStatutHistoriqueRepository statutHistoriqueRepository;
    private final ProcessusRepository processusRepository;
    private final PieceJointeService pieceJointeService;
    private final JournalActionsService journal;
    private final SimpMessagingTemplate messagingTemplate;
    private final NcConsultationService consultationService;
    private final NotificationService notifications;

    public NcService(NonConformiteRepository ncRepository,
                     NcStatutHistoriqueRepository statutHistoriqueRepository,
                     ProcessusRepository processusRepository,
                     PieceJointeService pieceJointeService,
                     JournalActionsService journal,
                     SimpMessagingTemplate messagingTemplate, NcConsultationService consultationService,
                     NotificationService notifications) {
        this.ncRepository = ncRepository;
        this.statutHistoriqueRepository = statutHistoriqueRepository;
        this.processusRepository = processusRepository;
        this.pieceJointeService = pieceJointeService;
        this.journal = journal;
        this.messagingTemplate = messagingTemplate;
        this.consultationService =consultationService;
        this.notifications = notifications;
    }

    @Transactional
    public NcCreeResponse declarer(DeclarationNcRequest req,
                                   List<MultipartFile> images,
                                   MultipartFile pdf,
                                   Users declarant) {
        if (!Boolean.TRUE.equals(declarant.getActif())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Compte désactivé");
        }
        if (req.dateDetection().isAfter(LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "La date de détection ne peut pas être dans le futur");
        }

        // 1. La référence n'est plus saisie par le déclarant : elle est attribuée
        //    plus tard par le responsable qualité dans le formulaire de traitement.
        // 2. Gestion du processus : Existant ou création à la volée
        Long processusIdFinal;
        if (req.processusId() != null) {
            Processus p = processusRepository.findById(req.processusId())
                    .filter(proc -> Boolean.TRUE.equals(proc.getActif()))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Service ou processus introuvable ou inactif"));
            processusIdFinal = p.getId();
        } else if (req.nouveauProcessus() != null) {
            DeclarationNcRequest.NouveauProcessusDto npDto = req.nouveauProcessus();
            if (npDto.libelle() == null || npDto.libelle().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le libellé du nouveau processus est obligatoire");
            }

            // Un même code peut être réutilisé avec une autre description ; seul un doublon STRICT est refusé.
            String code = npDto.code().trim().toUpperCase(java.util.Locale.ROOT);
            String libelle = npDto.libelle().trim();
            String description = npDto.description() == null ? "" : npDto.description().trim();
            if (code.length() > 30 || libelle.length() > 150) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Le code (30 caractères max.) ou le libellé (150 caractères max.) du processus est trop long");
            }
            if (processusRepository.existeDoublon(code, libelle, description)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Un processus identique (même code, même libellé et même description) existe déjà : "
                                + "recherchez-le dans la liste et sélectionnez-le.");
            }

            Processus nouveauP = new Processus();
            nouveauP.setCode(code);
            nouveauP.setLibelle(libelle);
            nouveauP.setDescription(description.isEmpty() ? null : description);
            nouveauP.setActif(true);

            try {
                nouveauP = processusRepository.saveAndFlush(nouveauP);
                processusIdFinal = nouveauP.getId();
            } catch (Exception e) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Ce processus existe déjà (même code, même libellé et même description)");
            }
            journal.enregistrerModification(declarant.getId(), "ADD_PROCESSUS", "PROCESSUS", nouveauP.getId(),
                    null, Instantane.de(nouveauP), null);
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Veuillez sélectionner ou créer un processus");
        }

        // 3. Contrôle des fichiers
        List<PieceJointeService.FichierValide> fichiers = pieceJointeService.valider(images, pdf);

        LocalDateTime maintenant = LocalDateTime.now();

        // 4. Enregistrement de la non-conformité
        NonConformite nc = new NonConformite();
        nc.setReference(null);
        nc.setTitre(req.titre().trim());
        nc.setDateDetection(req.dateDetection());
        nc.setDeclarantId(declarant.getId());
        nc.setProcessusId(processusIdFinal);
        nc.setDescriptionDetaillee(req.descriptionDetaillee().trim());
        nc.setGraviteDeclaree(req.graviteDeclaree().name());
        nc.setStatut(StatutNc.EN_ATTENTE.name());
        nc.setNbReouvertures(0);
        nc.setDateCreation(maintenant);
        nc = ncRepository.save(nc);

        // 5. Historique des statuts
        NcStatutHistorique h = new NcStatutHistorique();
        h.setNcId(nc.getId());
        h.setNouveauStatut(StatutNc.EN_ATTENTE.name());
        h.setAuteurId(declarant.getId());
        h.setDateChangement(maintenant);
        statutHistoriqueRepository.save(h);

        // 6. Enregistrement des pièces jointes
        pieceJointeService.enregistrer(nc.getId(), fichiers, declarant.getId(), maintenant);

        // 7. Journalisation
        Map<String, Object> contexteCreation = new java.util.LinkedHashMap<>();
        contexteCreation.put("referenceAttenteAttribution", nc.getReference() == null);
        contexteCreation.put("piecesJointes", fichiers.size());
        journal.enregistrerModification(declarant.getId(), "ADD_NC", "NON_CONFORMITE", nc.getId(),
                null, Instantane.de(nc), contexteCreation);

        // Notification des responsables qualité (sauf le déclarant lui-même s'il en est un)
        notifications.notifierRole("RESPONSABLE_QUALITE", declarant.getId(), TypeNotification.NC_DECLAREE,
                "Nouvelle non-conformité déclarée par " + NotificationService.nom(declarant)
                        + " : « " + nc.getTitre() + " ».",
                NotificationService.ENTITE_NC, nc.getId());


        // 8. Notification WebSocket après validation de la transaction
        Map<String, Object> payloadNotification = Map.of(
                "id", nc.getId(),
                "reference", nc.getReference() == null ? "" : nc.getReference(),
                "titre", nc.getTitre(),
                "dateCreation", maintenant.toString()
        );

        // Préparer les valeurs avant la fin de la méthode
        final Object payload = payloadNotification;

        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        messagingTemplate.convertAndSend(
                                "/topic/admin/nc",
                                (Object) payload
                        );
                    }
                }
        );

        return new NcCreeResponse(nc.getId(), nc.getReference());

    }

    @Transactional
    public NcDetailResponse modifierParDeclarant(Long id, DeclarationNcRequest req, Users declarant) {
        NonConformite nc = ncRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Non-conformité introuvable"));

        if (!nc.getDeclarantId().equals(declarant.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Vous ne pouvez modifier que vos propres non-conformités");
        }

        if (!"EN_ATTENTE".equals(nc.getStatut())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La non-conformité ne peut plus être modifiée car son traitement a débuté");
        }

        var avant = Instantane.de(nc);     // avant les setters : l'entité est modifiée sur place
        nc.setTitre(req.titre().trim());
        nc.setDescriptionDetaillee(req.descriptionDetaillee().trim());
        nc.setGraviteDeclaree(req.graviteDeclaree().name());
        nc.setDateDetection(req.dateDetection());
        nc.setDateModification(LocalDateTime.now());
        ncRepository.save(nc);

        journal.enregistrerModification(declarant.getId(), "UPDATE_NC", "NON_CONFORMITE", nc.getId(),
                avant, Instantane.de(nc), null);

        notifications.notifierRole("RESPONSABLE_QUALITE", declarant.getId(), TypeNotification.NC_MODIFIEE,
                NotificationService.nom(declarant) + " a modifié sa déclaration « " + nc.getTitre() + " ».",
                NotificationService.ENTITE_NC, nc.getId());

        // Notification WebSocket en temps réel
        Map<String, Object> payloadNotification = Map.of(
                "id", nc.getId(),
                "reference", nc.getReference() == null ? "" : nc.getReference(),
                "titre", nc.getTitre(),
                "type", "MODIFICATION_NC"
        );

        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        messagingTemplate.convertAndSend("/topic/admin/nc", (Object) payloadNotification);
                    }
                }
        );

        return consultationService.detail(nc.getId());
    }
}