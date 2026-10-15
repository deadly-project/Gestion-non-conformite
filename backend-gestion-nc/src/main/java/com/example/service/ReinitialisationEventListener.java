package com.example.service;

import com.example.dto.reinitialisation.DemandeReinitialisationResponse;
import com.example.dto.reinitialisation.NotificationTempsReel;
import com.example.entity.enums.StatutDemande;
import com.example.event.DemandeReinitialisationRecueEvent;
import com.example.event.DemandeReinitialisationTraiteeEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Réagit APRÈS le commit : notifie les administrateurs en temps réel (WebSocket)
 * et envoie les emails non critiques. Une panne ici n'annule jamais la demande.
 */
@Component
public class ReinitialisationEventListener {

    private static final Logger log = LoggerFactory.getLogger(ReinitialisationEventListener.class);

    /** Réservé aux administrateurs (voir AdminTopicSubscriptionInterceptor). */
    public static final String TOPIC_ADMIN = "/topic/admin/reinitialisations";

    private final SimpMessagingTemplate messagingTemplate;
    private final NotificationEmailService emailService;

    public ReinitialisationEventListener(SimpMessagingTemplate messagingTemplate,
                                         NotificationEmailService emailService) {
        this.messagingTemplate = messagingTemplate;
        this.emailService = emailService;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onDemandeRecue(DemandeReinitialisationRecueEvent event) {
        DemandeReinitialisationResponse d = event.demande();
        pousser("DEMANDE_RECUE", d, "Nouvelle demande de réinitialisation : "
                + d.prenom() + " " + d.nom() + " (matricule " + d.matricule() + ")");

        try {
            emailService.envoyerAccuseReceptionDemande(event.email(), event.prenom(), event.nom());
        } catch (Exception e) {
            log.error("Accusé de réception non envoyé à {} : {}", event.email(), e.getMessage());
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onDemandeTraitee(DemandeReinitialisationTraiteeEvent event) {
        DemandeReinitialisationResponse d = event.demande();
        boolean validee = d.statut() == StatutDemande.VALIDEE;

        pousser(validee ? "DEMANDE_VALIDEE" : "DEMANDE_REFUSEE", d,
                (validee ? "Demande validée : " : "Demande refusée : ")
                        + d.prenom() + " " + d.nom() + " (matricule " + d.matricule() + ")");

        if (!validee) {
            try {
                emailService.envoyerRefusDemande(event.email(), event.prenom(), event.nom());
            } catch (Exception e) {
                log.error("Email de refus non envoyé à {} : {}", event.email(), e.getMessage());
            }
        }
    }

    private void pousser(String type, DemandeReinitialisationResponse d, String message) {
        messagingTemplate.convertAndSend(TOPIC_ADMIN, new NotificationTempsReel(
                type, d.id(), d.matricule(), d.nom(), d.prenom(), d.statut().name(),
                d.dateDemande() != null ? d.dateDemande().toString() : null, message));
    }
}
