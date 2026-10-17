package com.example.controller;

import com.example.dto.utilisateur.UtilisateurCreationRequest;
import com.example.dto.utilisateur.UtilisateurCreationResponse;
import com.example.dto.utilisateur.UtilisateurModificationRequest;
import com.example.dto.utilisateur.UtilisateurResponse;
import com.example.service.UtilisateurService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/utilisateurs")
@PreAuthorize("hasRole('ADMINISTRATEUR')")
public class UtilisateurController {

    private final UtilisateurService service;

    public UtilisateurController(UtilisateurService service) {
        this.service = service;
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
            @Valid @RequestBody UtilisateurCreationRequest request) {
        return service.creer(request);
    }

    @PutMapping("/{id}")
    public UtilisateurResponse modifier(
            @PathVariable Long id,
            @Valid @RequestBody UtilisateurModificationRequest request) {
        return service.modifier(id, request);
    }

    @PatchMapping("/{id}/desactiver")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void desactiver(@PathVariable Long id) {
        service.desactiver(id);
    }

    @PatchMapping("/{id}/activer")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void activer(@PathVariable Long id) {
        service.activer(id);
    }
}