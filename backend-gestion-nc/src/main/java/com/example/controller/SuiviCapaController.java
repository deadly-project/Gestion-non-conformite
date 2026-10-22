package com.example.controller;

import com.example.dto.audit.AuditDtos.*;
import com.example.entity.Users;
import com.example.repository.UtilisateurRepository;
import com.example.service.SuiviCapaService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * Suivi des CAPA par le responsable qualité. /api/capa/** est déjà ouvert à
 * RESPONSABLE_QUALITE et ADMINISTRATEUR dans SecurityConfig ; seules les lectures
 * restent accessibles à l'administrateur, les actions sont réservées au responsable qualité.
 * Chaque action renvoie le suivi complet à jour de la non-conformité.
 */
@RestController
@RequestMapping("/api/capa")
public class SuiviCapaController {

    private final SuiviCapaService service;
    private final UtilisateurRepository utilisateurRepository;

    public SuiviCapaController(SuiviCapaService service, UtilisateurRepository utilisateurRepository) {
        this.service = service;
        this.utilisateurRepository = utilisateurRepository;
    }

    @GetMapping("/nc/{ncId}/suivi")
    @PreAuthorize("hasAnyRole('RESPONSABLE_QUALITE','ADMINISTRATEUR')")
    public SuiviNc suivi(@PathVariable Long ncId) {
        return service.suivi(ncId);
    }

    @PostMapping("/constats/{constatId}/commentaires")
    @PreAuthorize("hasRole('RESPONSABLE_QUALITE')")
    public SuiviNc commenter(@PathVariable Long constatId, @Valid @RequestBody CommentaireRequest requete,
                             Authentication authentication) {
        return service.commenter(constatId, requete.commentaire(), utilisateurCourant(authentication));
    }

    @PutMapping("/etapes/{etapeId}/validation")
    @PreAuthorize("hasRole('RESPONSABLE_QUALITE')")
    public SuiviNc valider(@PathVariable Long etapeId, @Valid @RequestBody ValidationRequest requete,
                           Authentication authentication) {
        return service.validerEtape(etapeId, requete, utilisateurCourant(authentication));
    }

    @DeleteMapping("/etapes/{etapeId}/validation")
    @PreAuthorize("hasRole('RESPONSABLE_QUALITE')")
    public SuiviNc annulerValidation(@PathVariable Long etapeId, Authentication authentication) {
        return service.annulerValidation(etapeId, utilisateurCourant(authentication));
    }

    @PostMapping("/nc/{ncId}/cloture")
    @PreAuthorize("hasRole('RESPONSABLE_QUALITE')")
    public SuiviNc cloturer(@PathVariable Long ncId, @Valid @RequestBody ClotureRequest requete,
                            Authentication authentication) {
        return service.cloturer(ncId, requete.commentaire(), utilisateurCourant(authentication));
    }

    private Users utilisateurCourant(Authentication authentication) {
        return utilisateurRepository.findByEmailIgnoreCase(authentication.getName())
                .filter(u -> Boolean.TRUE.equals(u.getActif()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session invalide"));
    }
}