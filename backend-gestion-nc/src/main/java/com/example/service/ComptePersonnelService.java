package com.example.service;

import com.example.domain.TypeNotification;
import com.example.dto.utilisateur.*;
import com.example.entity.Users;
import com.example.repository.UtilisateurRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;

@Service
public class ComptePersonnelService {

    private final UtilisateurRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final NotificationEmailService emailService;
    private final JournalActionsService journal;
    private final NotificationService notifications;

    public ComptePersonnelService(
            UtilisateurRepository repository,
            PasswordEncoder passwordEncoder,
            NotificationEmailService emailService,
            JournalActionsService journal,
            NotificationService notifications) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
        this.journal = journal;
        this.notifications = notifications;
    }

    private Users utilisateurConnecte(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED, "Session invalide");
        }

        return repository.findByEmailIgnoreCase(authentication.getName())
                .filter(u -> Boolean.TRUE.equals(u.getActif()))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Compte introuvable ou désactivé"));
    }

    @Transactional
    public UtilisateurResponse modifierProfil(
            Authentication authentication,
            ProfilModificationRequest request) {

        Users user = utilisateurConnecte(authentication);
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        Integer matricule = request.matricule();

        repository.findByEmailIgnoreCase(email)
                .filter(u -> !u.getId().equals(user.getId()))
                .ifPresent(u -> {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT, "Cet email est déjà utilisé");
                });

        repository.findByMatricule(matricule)
                .filter(u -> !u.getId().equals(user.getId()))
                .ifPresent(u -> {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT, "Ce matricule est déjà utilisé");
                });

        var avant = Instantane.de(user);   // avant les setters : l'entité est modifiée sur place
        user.setNom(request.nom().trim());
        user.setPrenom(request.prenom().trim());
        user.setEmail(email);
        user.setMatricule(matricule);
        Users enregistre = repository.saveAndFlush(user);

        journal.enregistrerModification(user.getId(), "UPDATE_PROFILE", "UTILISATEUR", user.getId(),
                avant, Instantane.de(enregistre), null);

        notifications.notifier(user.getId(), TypeNotification.PROFIL_MODIFIE,
                "Vos informations personnelles ont été modifiées.",
                NotificationService.ENTITE_UTILISATEUR, user.getId());

        return UtilisateurResponse.from(enregistre);
    }

    @Transactional
    public void changerMotDePasse(
            Authentication authentication,
            ChangementMotDePasseRequest request) {

        Users user = utilisateurConnecte(authentication);

        if (!passwordEncoder.matches(
                request.ancienMotDePasse(), user.getMotDePasse())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "L'ancien mot de passe est incorrect");
        }

        if (!request.nouveauMotDePasse().equals(
                request.confirmationMotDePasse())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "La confirmation du mot de passe ne correspond pas");
        }

        if (passwordEncoder.matches(
                request.nouveauMotDePasse(), user.getMotDePasse())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Le nouveau mot de passe doit être différent de l'ancien");
        }

        String ancienEmail = user.getEmail();
        String prenom = user.getPrenom();
        String nom = user.getNom();

        user.setMotDePasse(
                passwordEncoder.encode(request.nouveauMotDePasse()));
        repository.save(user);

        // Le mot de passe (même chiffré) n'est jamais copié dans l'historique : seule la trace de l'action l'est.
        var etat = Instantane.de(user);
        java.util.Map<String, Object> contexte = new java.util.LinkedHashMap<>();
        contexte.put("motDePasseModifie", true);
        journal.enregistrerModification(user.getId(), "UPDATE_PASSWORD", "UTILISATEUR", user.getId(),
                etat, etat, contexte);

        notifications.notifier(user.getId(), TypeNotification.MOT_DE_PASSE_MODIFIE,
                "Votre mot de passe a été modifié.",
                NotificationService.ENTITE_UTILISATEUR, user.getId());

        // Une notification est envoyée après la modification.
        try {
            emailService.envoyerNotificationChangementMotDePasse(
                    ancienEmail, prenom, nom);
        } catch (Exception e) {
            // Le mot de passe est déjà modifié. Ne pas annoncer que
            // l'opération a échoué alors que le changement est effectif.
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Mot de passe modifié, mais l'envoi de l'email a échoué. "
                            + "Vérifiez la configuration SMTP.");
        }
    }
}