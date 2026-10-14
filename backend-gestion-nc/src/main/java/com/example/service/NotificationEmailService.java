package com.example.service;

import com.example.event.UtilisateurCreeEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Notifications par email.
 *
 * <p>Principes : envoi après commit, en tâche asynchrone, et un échec d'envoi
 * n'annule jamais la création du compte (il est seulement journalisé).
 * Email en texte brut : pas de risque d'injection HTML via le nom ou le prénom.</p>
 */
@Service
public class NotificationEmailService {

    private static final Logger log = LoggerFactory.getLogger(NotificationEmailService.class);

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final String expediteur;
    private final String urlApplication;
    private final boolean inclureMotDePasse;

    public NotificationEmailService(
            ObjectProvider<JavaMailSender> mailSenderProvider,
            @Value("${app.mail.from:no-reply@smq.local}") String expediteur,
            @Value("${app.frontend.url:http://localhost:5173}") String urlApplication,
            @Value("${app.mail.inclure-mot-de-passe-temporaire:false}") boolean inclureMotDePasse) {
        this.mailSenderProvider = mailSenderProvider;
        this.expediteur = expediteur;
        this.urlApplication = urlApplication;
        this.inclureMotDePasse = inclureMotDePasse;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onUtilisateurCree(UtilisateurCreeEvent event) {
        JavaMailSender sender = mailSenderProvider.getIfAvailable();
        if (sender == null) {
            log.warn("Email de création de compte non envoyé : aucun serveur SMTP configuré (spring.mail.host).");
            return;
        }
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(expediteur);
            message.setTo(event.email());
            message.setSubject("Votre compte SMQ a été créé");
            message.setText(construireMessage(event));
            sender.send(message);
            log.info("Email de création de compte envoyé à {}", event.email());
        } catch (MailException e) {
            log.error("Échec de l'envoi de l'email de création de compte à {} : {}",
                    event.email(), e.getMessage());
        }
    }

    private String construireMessage(UtilisateurCreeEvent e) {
        StringBuilder sb = new StringBuilder();
        sb.append("Bonjour ").append(e.prenom()).append(' ').append(e.nom()).append(",\n\n");
        sb.append("Votre compte sur la plateforme SMQ (Système de Gestion de la Qualité) vient d'être créé.\n\n");
        sb.append("Identifiant de connexion : ").append(e.email()).append('\n');
        sb.append("Matricule : ").append(e.matricule()).append('\n');
        sb.append("Rôle : ").append(libelleRole(e.role())).append("\n\n");

        if (inclureMotDePasse && e.motDePasseTemporaire() != null) {
            sb.append("Mot de passe temporaire : ").append(e.motDePasseTemporaire()).append('\n');
            sb.append("Pour votre sécurité, changez-le dès votre première connexion.\n\n");
        } else {
            sb.append("Votre mot de passe vous sera communiqué par l'administrateur.\n\n");
        }

        //sb.append("Accès à la plateforme : ").append(urlApplication).append("\n\n");
        sb.append("Si vous n'êtes pas concerné(e) par ce message, merci de ne pas en tenir compte.\n\n");
        sb.append("L'équipe Qualité");
        return sb.toString();
    }

    private String libelleRole(String role) {
        return switch (role) {
            case "DECLARANT" -> "Déclarant";
            case "AUDITEUR" -> "Auditeur";
            case "RESPONSABLE_QUALITE" -> "Responsable qualité";
            case "ADMINISTRATEUR" -> "Administrateur";
            default -> role;
        };
    }
}