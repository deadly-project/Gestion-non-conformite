package com.example.controller;

import com.example.dto.utilisateur.UtilisateurCreationRequest;
import com.example.dto.utilisateur.UtilisateurCreationResponse;
import com.example.dto.utilisateur.UtilisateurModificationRequest;
import com.example.dto.utilisateur.UtilisateurResponse;
import com.example.entity.Users;
import com.example.repository.UtilisateurRepository;
import com.example.service.UtilisateurService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/utilisateurs")
@PreAuthorize("hasRole('ADMINISTRATEUR')")
public class UtilisateurController {

    private final UtilisateurService service;
    private final UtilisateurRepository utilisateurRepository;

    public UtilisateurController(UtilisateurService service, UtilisateurRepository utilisateurRepository) {
        this.service = service;
        this.utilisateurRepository = utilisateurRepository;
    }

    @GetMapping
    public List<UtilisateurResponse> lister() {
        return service.lister();
    }

    @GetMapping("/{id}")
    public UtilisateurResponse trouver(@PathVariable Long id) {
        return service.trouver(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UtilisateurCreationResponse creer(
            @Valid @RequestBody UtilisateurCreationRequest request,
            Authentication authentication) {
        return service.creer(request, acteur(authentication));
    }

    @PutMapping("/{id}")
    public UtilisateurResponse modifier(
            @PathVariable Long id,
            @Valid @RequestBody UtilisateurModificationRequest request,
            Authentication authentication) {
        return service.modifier(id, request, acteur(authentication));
    }

    @PatchMapping("/{id}/desactiver")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void desactiver(@PathVariable Long id, Authentication authentication) {
        service.desactiver(id, acteur(authentication));
    }

    @PatchMapping("/{id}/activer")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void activer(@PathVariable Long id, Authentication authentication) {
        service.activer(id, acteur(authentication));
    }

    private Long acteur(Authentication authentication) {
        return utilisateurRepository.findByEmailIgnoreCase(authentication.getName())
                .filter(u -> Boolean.TRUE.equals(u.getActif()))
                .map(Users::getId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session invalide"));
    }
}