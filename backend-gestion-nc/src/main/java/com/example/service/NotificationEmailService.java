package com.example.service;

import com.example.event.UtilisateurCreeEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

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

    // ------------------------------------------------------------------
    // Création de compte (inchangé)
    // ------------------------------------------------------------------
    public void envoyerEmailCreation(UtilisateurCreeEvent event) {
        envoyer(event.email(), "Votre compte SMQ a été créé", construireMessage(event));
        log.info("Email de création de compte envoyé avec succès à {}", event.email());
    }

    // ------------------------------------------------------------------
    // Mot de passe oublié
    // ------------------------------------------------------------------

    /** Accusé de réception de la demande (envoyé à l'utilisateur concerné). */
    public void envoyerAccuseReceptionDemande(String email, String prenom, String nom) {
        String texte = "Bonjour " + prenom + " " + nom + ",\n\n"
                + "Nous avons bien reçu votre demande de réinitialisation de mot de passe.\n"
                + "Elle sera examinée par un administrateur ; vous recevrez un email avec la décision.\n\n"
                + "Si vous n'êtes pas à l'origine de cette demande, prévenez l'administrateur.\n\n"
                + "L'équipe Qualité";
        envoyer(email, "SMQ : demande de réinitialisation reçue", texte);
    }

    /** Email envoyé lorsque l'administrateur valide : matricule + nouveau mot de passe. */
    public void envoyerMotDePasseReinitialise(String email, String prenom, String nom,
                                              String matricule, String nouveauMotDePasse) {
        String texte = "Bonjour " + prenom + " " + nom + ",\n\n"
                + "Votre demande de réinitialisation a été validée par l'administrateur.\n\n"
                + "Matricule : " + matricule + "\n"
                + "Nouveau mot de passe : " + nouveauMotDePasse + "\n\n"
                + "Connexion : " + urlApplication + "/login\n\n"
                + "Gardez ce mot de passe confidentiel et supprimez cet email après usage.\n\n"
                + "L'équipe Qualité";
        envoyer(email, "SMQ : votre nouveau mot de passe", texte);
    }

    /** Email envoyé lorsque l'administrateur refuse la demande. */
    public void envoyerRefusDemande(String email, String prenom, String nom) {
        String texte = "Bonjour " + prenom + " " + nom + ",\n\n"
                + "Votre demande de réinitialisation de mot de passe a été refusée.\n"
                + "Pour plus d'informations, contactez l'administrateur.\n\n"
                + "L'équipe Qualité";
        envoyer(email, "SMQ : demande de réinitialisation refusée", texte);
    }

    // ------------------------------------------------------------------
    // Outils internes
    // ------------------------------------------------------------------

    /**
     * Envoi synchrone. Lève une exception si l'email ne part pas : l'appelant décide
     * s'il l'ignore (accusé de réception) ou s'il annule son opération (nouveau mot de passe).
     */
    private void envoyer(String destinataire, String sujet, String texte) {
        JavaMailSender sender = mailSenderProvider.getIfAvailable();
        if (sender == null) {
            throw new IllegalStateException("Aucun serveur SMTP configuré (spring.mail.host manquant ou inactif).");
        }
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            if (expediteur != null && !expediteur.isBlank()) {
                message.setFrom(expediteur);
            }
            message.setTo(destinataire);
            message.setSubject(sujet);
            message.setText(texte);
            sender.send(message);
        } catch (MailException e) {
            log.error("Échec de l'envoi de l'email « {} » à {} : {}", sujet, destinataire, e.getMessage());
            String cause = e.getCause() != null ? e.getCause().getMessage() : e.getMessage();
            throw new RuntimeException("Erreur de connexion SMTP (port fermé ou serveur injoignable) : " + cause);
        }
    }

    private String construireMessage(UtilisateurCreeEvent e) {
        StringBuilder sb = new StringBuilder();
        sb.append("Bonjour ").append(e.prenom()).append(' ').append(e.nom()).append(",\n\n");
        sb.append("Votre compte sur la plateforme SMQ (Système de Gestion de la Qualité) vient d'être créé.\n\n");
        sb.append("Matricule : ").append(e.matricule()).append('\n');
        sb.append("Identifiant / Email : ").append(e.email()).append('\n');
        sb.append("Rôle : ").append(libelleRole(e.role())).append("\n\n");

        if (inclureMotDePasse && e.motDePasseTemporaire() != null) {
            sb.append("Mot de passe temporaire : ").append(e.motDePasseTemporaire()).append('\n');
            sb.append("Pour votre sécurité, changez-le dès votre première connexion.\n\n");
        } else {
            sb.append("Votre mot de passe vous a été communiqué séparément.\n\n");
        }

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