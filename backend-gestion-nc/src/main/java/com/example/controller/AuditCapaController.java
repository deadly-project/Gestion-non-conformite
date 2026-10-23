package com.example.controller;

import com.example.entity.Users;
import com.example.repository.UtilisateurRepository;
import com.example.service.AuditCapaService;
import com.example.service.AuditCapaService.EntreePlanning;
import com.example.service.AuditCapaService.PlanificationRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

/**
 * Calendrier d'audits (audits portant sur des étapes CAPA).
 * /api/audits/** est déjà ouvert à AUDITEUR, RESPONSABLE_QUALITE et ADMINISTRATEUR
 * dans SecurityConfig : aucune modification de la sécurité n'est nécessaire.
 */
@RestController
@RequestMapping("/api/audits/planning")
public class AuditCapaController {

    private final AuditCapaService service;
    private final UtilisateurRepository utilisateurRepository;

    public AuditCapaController(AuditCapaService service, UtilisateurRepository utilisateurRepository) {
        this.service = service;
        this.utilisateurRepository = utilisateurRepository;
    }

    @GetMapping
    public List<EntreePlanning> lister(@RequestParam Long ncId) {
        return service.lister(ncId);
    }

    @PostMapping
    public List<EntreePlanning> planifier(@Valid @RequestBody PlanificationRequest request,
                                          Authentication authentication) {
        return service.planifier(request, utilisateurCourant(authentication));
    }

    // Renvoie un corps JSON (et non un 204 vide) pour que apiRequest puisse toujours le lire.
    @DeleteMapping("/{id}")
    public Map<String, Long> retirer(@PathVariable Long id, Authentication authentication) {
        service.retirer(id, utilisateurCourant(authentication));
        return Map.of("id", id);
    }

    private Users utilisateurCourant(Authentication authentication) {
        return utilisateurRepository.findByEmailIgnoreCase(authentication.getName())
                .filter(u -> Boolean.TRUE.equals(u.getActif()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session invalide"));
    }
}