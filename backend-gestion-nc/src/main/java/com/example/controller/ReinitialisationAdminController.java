package com.example.controller;

import com.example.dto.reinitialisation.DemandeReinitialisationResponse;
import com.example.entity.enums.StatutDemande;
import com.example.service.ReinitialisationMotDePasseService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/reinitialisations")
@PreAuthorize("hasRole('ADMINISTRATEUR')")
public class ReinitialisationAdminController {

    private final ReinitialisationMotDePasseService service;

    public ReinitialisationAdminController(ReinitialisationMotDePasseService service) {
        this.service = service;
    }

    /**
     * Sans paramètre « statut » : toutes les demandes (en attente, validées, refusées).
     * Avec « statut » : uniquement les demandes de ce statut.
     */
    @GetMapping
    public List<DemandeReinitialisationResponse> lister(
            @RequestParam(required = false) StatutDemande statut) {
        return statut == null ? service.listerToutes() : service.lister(statut);
    }

    @PostMapping("/{id}/valider")
    public DemandeReinitialisationResponse valider(@PathVariable Long id, Authentication authentication) {
        return service.valider(id, authentication);
    }

    @PostMapping("/{id}/refuser")
    public DemandeReinitialisationResponse refuser(@PathVariable Long id, Authentication authentication) {
        return service.refuser(id, authentication);
    }
}