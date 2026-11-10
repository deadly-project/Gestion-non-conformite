package com.example.controller;

import com.example.dto.dashboard.DashboardResponse;
import com.example.service.DashboardService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Tableau de bord qualité : responsable qualité et administrateur.
 * Le bloc « admin » (utilisateurs, demandes de réinitialisation) n'est renvoyé qu'à l'administrateur.
 */
@RestController
@RequestMapping("/api/dashboard")
@PreAuthorize("hasAnyRole('RESPONSABLE_QUALITE','ADMINISTRATEUR')")
public class DashboardController {

    private final DashboardService service;

    public DashboardController(DashboardService service) {
        this.service = service;
    }

    /** @param annee année de l'histogramme mensuel (année courante par défaut) */
    @GetMapping
    public DashboardResponse tableauDeBord(@RequestParam(required = false) Integer annee,
                                           Authentication authentication) {
        boolean administrateur = authentication.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMINISTRATEUR".equals(a.getAuthority()));
        return service.construire(annee, administrateur);
    }
}