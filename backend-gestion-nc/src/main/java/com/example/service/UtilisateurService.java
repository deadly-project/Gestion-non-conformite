
package com.example.service;

import com.example.dto.utilisateur.UtilisateurCreationRequest;
import com.example.dto.utilisateur.UtilisateurModificationRequest;
import com.example.dto.utilisateur.UtilisateurResponse;
import com.example.entity.Users;
import com.example.repository.UtilisateurRepository;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;
import java.util.Locale;

@Service
public class UtilisateurService {

    private final UtilisateurRepository repository;
    private final PasswordEncoder passwordEncoder;

    public UtilisateurService(
            UtilisateurRepository repository,
            PasswordEncoder passwordEncoder) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
    }

    private String normaliserEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private String validerRole(String role) {
        if (role == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Rôle obligatoire"
            );
        }

        String valeur = role.trim().toUpperCase(Locale.ROOT);

        if (!List.of(
                "DECLARANT",
                "AUDITEUR",
                "RESPONSABLE_QUALITE"
        ).contains(valeur)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Rôle non autorisé pour cette opération"
            );
        }

        return valeur;
    }

    @Transactional(readOnly = true)
    public List<UtilisateurResponse> lister() {
        return repository.findAll()
                .stream()
                .map(UtilisateurResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public UtilisateurResponse trouver(UUID id) {
        return UtilisateurResponse.from(rechercher(id));
    }

    @Transactional
    public UtilisateurResponse creer(
            UtilisateurCreationRequest request) {

        String email = normaliserEmail(request.email());
        String matricule = request.matricule().trim();

        if (repository.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Cet email existe déjà"
            );
        }

        if (repository.existsByMatriculeIgnoreCase(matricule)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Ce matricule existe déjà"
            );
        }

        Users u = Users.builder()
                .nom(request.nom().trim())
                .prenom(request.prenom().trim())
                .dateNaissance(request.dateNaissance())
                .email(email)
                .matricule(matricule)
                .motDePasse(passwordEncoder.encode(request.motDePasse()))
                .role(validerRole(request.role()))
                .actif(true)
                .build();

        return UtilisateurResponse.from(repository.save(u));
    }

    @Transactional
    public UtilisateurResponse modifier(
            UUID id,
            UtilisateurModificationRequest request) {

        Users u = rechercher(id);

        String email = normaliserEmail(request.email());
        String matricule = request.matricule().trim();

        repository.findByEmailIgnoreCase(email)
                .filter(existant -> !existant.getId().equals(id))
                .ifPresent(existant -> {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT, "Cet email existe déjà"
                    );
                });

        repository.findByMatriculeIgnoreCase(matricule)
                .filter(existant -> !existant.getId().equals(id))
                .ifPresent(existant -> {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT, "Ce matricule existe déjà"
                    );
                });

        u.setNom(request.nom().trim());
        u.setPrenom(request.prenom().trim());
        u.setDateNaissance(request.dateNaissance());
        u.setEmail(email);
        u.setMatricule(matricule);
        u.setRole(validerRole(request.role()));

        return UtilisateurResponse.from(repository.save(u));
    }

    @Transactional
    public void desactiver(UUID id) {
        Users u = rechercher(id);
        u.setActif(false);
        repository.save(u);
    }

    private Users rechercher(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Utilisateur introuvable"
                ));
    }
}
