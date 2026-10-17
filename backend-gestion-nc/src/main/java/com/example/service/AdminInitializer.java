package com.example.service;

import com.example.entity.Users;
import com.example.repository.UtilisateurRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class AdminInitializer implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(AdminInitializer.class);
    private final UtilisateurRepository repository;
    private final PasswordEncoder encoder;
    private final String email, password, matricule, nom, prenom;

    public AdminInitializer(UtilisateurRepository repository, PasswordEncoder encoder,
            @Value("${app.admin.email:}") String email,
            @Value("${app.admin.password:}") String password,
            @Value("${app.admin.matricule:}") String matricule,
            @Value("${app.admin.nom:Administrateur}") String nom,
            @Value("${app.admin.prenom:SMQ}") String prenom) {
        this.repository = repository; this.encoder = encoder;
        this.email = email; this.password = password; this.matricule = matricule;
        this.nom = nom; this.prenom = prenom;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (email.isBlank() || password.isBlank() || matricule.isBlank()) {
            log.warn("Administrateur initial non créé : définir ADMIN_EMAIL, ADMIN_PASSWORD et ADMIN_MATRICULE dans .env.");
            return;
        }
        if (password.length() < 8) {
            throw new IllegalStateException("ADMIN_PASSWORD doit contenir au moins 8 caractères.");
        }
        final Integer matriculeNumerique;
        try {
            matriculeNumerique = Integer.parseInt(matricule.trim());
        } catch (NumberFormatException e) {
            throw new IllegalStateException("ADMIN_MATRICULE doit être un nombre entier.");
        }
        if (repository.existsByEmailIgnoreCase(email) || repository.existsByMatricule(matriculeNumerique)) {
            log.info("Le compte administrateur initial existe déjà; aucun mot de passe n'a été modifié.");
            return;
        }
        Users admin = Users.builder()
                .nom(nom).prenom(prenom).email(email.trim().toLowerCase())
                .matricule(matriculeNumerique).motDePasse(encoder.encode(password))
                .role("ADMINISTRATEUR").actif(true).build();
        repository.save(admin);
        log.info("Compte administrateur initial créé pour {}.", email);
    }
}
