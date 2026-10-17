package com.example.controller;

import com.example.dto.utilisateur.*;
import com.example.service.ComptePersonnelService;
import com.example.dto.utilisateur.UtilisateurResponse;
import com.example.repository.UtilisateurRepository;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/compte")
public class ComptePersonnelController {

    private final ComptePersonnelService service;
    private final UtilisateurRepository repository;

    public ComptePersonnelController(
            ComptePersonnelService service,
            UtilisateurRepository repository) {
        this.service = service;
        this.repository = repository;
    }

    @PutMapping("/profil")
    public UtilisateurResponse modifierProfil(
            Authentication authentication,
            @Valid @RequestBody ProfilModificationRequest request) {
        return service.modifierProfil(authentication, request);
    }

    @PutMapping("/mot-de-passe")
    public ResponseEntity<?> changerMotDePasse(
            Authentication authentication,
            @Valid @RequestBody ChangementMotDePasseRequest request) {
        service.changerMotDePasse(authentication, request);
        return ResponseEntity.ok(
                java.util.Map.of("message",
                        "Mot de passe modifié avec succès."));
    }
}