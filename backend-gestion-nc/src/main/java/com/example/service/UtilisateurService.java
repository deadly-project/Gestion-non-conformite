package com.example.service;

import com.example.dto.utilisateur.UtilisateurCreationRequest;
import com.example.dto.utilisateur.UtilisateurCreationResponse;
import com.example.dto.utilisateur.UtilisateurModificationRequest;
import com.example.dto.utilisateur.UtilisateurResponse;
import com.example.entity.Users;
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

    public UtilisateurService(
            UtilisateurRepository repository,
            PasswordEncoder passwordEncoder,
            NotificationEmailService notificationEmailService,
            JournalActionsService journal) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.notificationEmailService = notificationEmailService;
        this.journal = journal;
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

        journal.enregistrer(acteurId, "ADD_USER", "UTILISATEUR", cree.getId(), java.util.Map.of(
                "matricule", cree.getMatricule(), "role", cree.getRole(), "email", cree.getEmail()));

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

        u.setNom(request.nom().trim());
        u.setPrenom(request.prenom().trim());
        u.setEmail(email);
        u.setMatricule(matricule);
        String ancienRole = u.getRole();
        u.setRole(validerRole(request.role()));
        Users enregistre = repository.save(u);

        journal.enregistrer(acteurId, "UPDATE_USER", "UTILISATEUR", enregistre.getId(), java.util.Map.of(
                "matricule", enregistre.getMatricule(), "roleAvant", ancienRole, "roleApres", enregistre.getRole()));

        return UtilisateurResponse.from(enregistre);
    }

    @Transactional
    public void desactiver(Long id, Long acteurId) {
        Users u = rechercher(id);
        u.setActif(false);
        repository.save(u);
        journal.enregistrer(acteurId, "DISABLE_USER", "UTILISATEUR", u.getId(),
                java.util.Map.of("matricule", u.getMatricule()));
    }

    private Users rechercher(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Utilisateur introuvable"));
    }

    @Transactional
    public void activer(Long id, Long acteurId) {
        Users u = rechercher(id);
        u.setActif(true);
        repository.save(u);
        journal.enregistrer(acteurId, "ENABLE_USER", "UTILISATEUR", u.getId(),
                java.util.Map.of("matricule", u.getMatricule()));
    }
}