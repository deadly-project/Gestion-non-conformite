package com.example.controller;

import com.example.service.AuditCapaService;
import com.example.service.AuditCapaService.EntreePlanning;
import com.example.service.AuditCapaService.PlanificationRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

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

    public AuditCapaController(AuditCapaService service) {
        this.service = service;
    }

    @GetMapping
    public List<EntreePlanning> lister(@RequestParam Long ncId) {
        return service.lister(ncId);
    }

    @PostMapping
    public List<EntreePlanning> planifier(@Valid @RequestBody PlanificationRequest request) {
        return service.planifier(request);
    }

    // Renvoie un corps JSON (et non un 204 vide) pour que apiRequest puisse toujours le lire.
    @DeleteMapping("/{id}")
    public Map<String, Long> retirer(@PathVariable Long id) {
        service.retirer(id);
        return Map.of("id", id);
    }
}