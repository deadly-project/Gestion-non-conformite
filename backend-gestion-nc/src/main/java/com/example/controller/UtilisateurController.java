
package com.example.controller;

import com.example.dto.utilisateur.UtilisateurCreationRequest;
import com.example.dto.utilisateur.UtilisateurModificationRequest;
import com.example.dto.utilisateur.UtilisateurResponse;
import com.example.service.UtilisateurService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

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
    public UtilisateurResponse trouver(@PathVariable UUID id) {
        return service.trouver(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UtilisateurResponse creer(
            @Valid @RequestBody UtilisateurCreationRequest request) {
        return service.creer(request);
    }

    @PutMapping("/{id}")
    public UtilisateurResponse modifier(
            @PathVariable UUID id,
            @Valid @RequestBody UtilisateurModificationRequest request) {
        return service.modifier(id, request);
    }

    @PatchMapping("/{id}/desactiver")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void desactiver(@PathVariable UUID id) {
        service.desactiver(id);
    }
}
