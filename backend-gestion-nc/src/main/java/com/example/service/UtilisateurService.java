package com.example.service;

import com.example.dto.utilisateur.UtilisateurCreationRequest;
import com.example.dto.utilisateur.UtilisateurCreationResponse;
import com.example.dto.utilisateur.UtilisateurModificationRequest;
import com.example.dto.utilisateur.UtilisateurResponse;
import com.example.entity.Users;
import com.example.domain.TypeNotification;
import com.example.event.UtilisateurCreeEvent;
import com.example.repository.UtilisateurRepository;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;

@Service
public class UtilisateurService {

    private static final int MOT_DE_PASSE_MIN = 8;

    private final UtilisateurRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final NotificationEmailService notificationEmailService;
    private final JournalActionsService journal;
    private final NotificationService notifications;

    public UtilisateurService(
            UtilisateurRepository repository,
            PasswordEncoder passwordEncoder,
            NotificationEmailService notificationEmailService,
            JournalActionsService journal,
            NotificationService notifications) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.notificationEmailService = notificationEmailService;
        this.journal = journal;
        this.notifications = notifications;
    }

    /** Prévient tous les administrateurs (celui qui agit compris : sa cloche garde la trace de l'action). */
    private void notifierAdmins(String type, String message, Long utilisateurId) {
        notifications.notifierRole("ADMINISTRATEUR", null, type, message,
                NotificationService.ENTITE_UTILISATEUR, utilisateurId);
    }

    private String nomActeur(Long acteurId) {
        return repository.findById(acteurId).map(NotificationService::nom).orElse("un administrateur");
    }

    private String normaliserEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private String validerRole(String role) {
        if (role == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rôle obligatoire");
        }
        String valeur = role.trim().toUpperCase(Locale.ROOT);
        if (!List.of("DECLARANT", "AUDITEUR", "RESPONSABLE_QUALITE").contains(valeur)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rôle non autorisé pour cette opération");
        }
        return valeur;
    }

    @Transactional(readOnly = true)
    public List<UtilisateurResponse> lister() {
        return repository.findAll().stream().map(UtilisateurResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public UtilisateurResponse trouver(Long id) {
        return UtilisateurResponse.from(rechercher(id));
    }

    @Transactional
    public UtilisateurCreationResponse creer(UtilisateurCreationRequest request, Long acteurId) {
        String email = normaliserEmail(request.email());
        Integer matricule = request.matricule();

        if (request.motDePasse().length() < MOT_DE_PASSE_MIN) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Le mot de passe doit contenir au moins " + MOT_DE_PASSE_MIN + " caractères"
            );
        }

        if (repository.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cet email  existe déjà dans le système.");
        }

        if (repository.existsByMatricule(matricule)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ce matricule existe déjà dans le système.");
        }

        Users u = Users.builder()
                .nom(request.nom().trim())
                .prenom(request.prenom().trim())
                .email(email)
                .matricule(matricule)
                .motDePasse(passwordEncoder.encode(request.motDePasse()))
                .role(validerRole(request.role()))
                .actif(true)
                .build();

        Users cree = repository.save(u);

        journal.enregistrerModification(acteurId, "ADD_USER", "UTILISATEUR", cree.getId(),
                null, Instantane.de(cree), null);

        notifierAdmins(TypeNotification.UTILISATEUR_CREE,
                "Compte créé : " + NotificationService.nom(cree) + " (matricule " + cree.getMatricule()
                        + ", rôle " + cree.getRole() + ") par " + nomActeur(acteurId) + ".",
                cree.getId());

        UtilisateurCreeEvent event = new UtilisateurCreeEvent(
                cree.getId(),
                cree.getPrenom(),
                cree.getNom(),
                cree.getEmail(),
                cree.getMatricule(),
                cree.getRole(),
                request.motDePasse()
        );

        String statutEmail;
        String messageSucces = "L'utilisateur a été créé avec succès.";

        try {
            notificationEmailService.envoyerEmailCreation(event);
            statutEmail = "E-mail de notification envoyé avec succès à " + email;
        } catch (IllegalStateException e) {
            statutEmail = "Attention : Aucun serveur SMTP configuré. L'e-mail n'a pas pu être envoyé.";
        } catch (Exception e) {
            statutEmail = "Attention : Échec de l'envoi de l'e-mail (Port SMTP fermé, mauvais identifiants ou réseau inaccessible) : " + e.getMessage();
        }

        return new UtilisateurCreationResponse(
                UtilisateurResponse.from(cree),
                messageSucces,
                statutEmail
        );
    }

    @Transactional
    public UtilisateurResponse modifier(Long id, UtilisateurModificationRequest request, Long acteurId) {
        Users u = rechercher(id);
        String email = normaliserEmail(request.email());
        Integer matricule = request.matricule();

        repository.findByEmailIgnoreCase(email)
                .filter(existant -> !existant.getId().equals(id))
                .ifPresent(existant -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Cet email  existe déjà");
                });

        repository.findByMatricule(matricule)
                .filter(existant -> !existant.getId().equals(id))
                .ifPresent(existant -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Ce matricule existe déjà");
                });

        var avant = Instantane.de(u);      // à prendre avant les setters : l'entité est modifiée sur place
        u.setNom(request.nom().trim());
        u.setPrenom(request.prenom().trim());
        u.setEmail(email);
        u.setMatricule(matricule);
        u.setRole(validerRole(request.role()));
        Users enregistre = repository.saveAndFlush(u);

        journal.enregistrerModification(acteurId, "UPDATE_USER", "UTILISATEUR", enregistre.getId(),
                avant, Instantane.de(enregistre), null);

        notifierAdmins(TypeNotification.UTILISATEUR_MODIFIE,
                "Compte modifié : " + NotificationService.nom(enregistre) + " (matricule "
                        + enregistre.getMatricule() + ") par " + nomActeur(acteurId) + ".",
                enregistre.getId());

        return UtilisateurResponse.from(enregistre);
    }

    @Transactional
    public void desactiver(Long id, Long acteurId) {
        Users u = rechercher(id);
        var avant = Instantane.de(u);
        u.setActif(false);
        repository.saveAndFlush(u);
        journal.enregistrerModification(acteurId, "DISABLE_USER", "UTILISATEUR", u.getId(),
                avant, Instantane.de(u), null);
        notifierAdmins(TypeNotification.UTILISATEUR_DESACTIVE,
                "Compte désactivé : " + NotificationService.nom(u) + " (matricule " + u.getMatricule()
                        + ") par " + nomActeur(acteurId) + ".",
                u.getId());
    }

    private Users rechercher(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Utilisateur introuvable"));
    }

    @Transactional
    public void activer(Long id, Long acteurId) {
        Users u = rechercher(id);
        var avant = Instantane.de(u);
        u.setActif(true);
        repository.saveAndFlush(u);
        journal.enregistrerModification(acteurId, "ENABLE_USER", "UTILISATEUR", u.getId(),
                avant, Instantane.de(u), null);
        notifierAdmins(TypeNotification.UTILISATEUR_ACTIVE,
                "Compte réactivé : " + NotificationService.nom(u) + " (matricule " + u.getMatricule()
                        + ") par " + nomActeur(acteurId) + ".",
                u.getId());
    }
}