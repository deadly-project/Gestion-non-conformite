package com.example.controller;

import com.example.dto.audit.AuditDtos.*;
import com.example.entity.Users;
import com.example.repository.UtilisateurRepository;
import com.example.service.AuditeurAuditService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;

/**
 * Espace auditeur. /api/audits/** est déjà ouvert à AUDITEUR, RESPONSABLE_QUALITE et ADMINISTRATEUR
 * dans SecurityConfig ; les droits précis sont portés par @PreAuthorize et par le service.
 * Les routes littérales (/mes-audits, /planning) sont prioritaires sur /{id}.
 */
@RestController
@RequestMapping("/api/audits")
public class AuditeurAuditController {

    private final AuditeurAuditService service;
    private final UtilisateurRepository utilisateurRepository;

    public AuditeurAuditController(AuditeurAuditService service, UtilisateurRepository utilisateurRepository) {
        this.service = service;
        this.utilisateurRepository = utilisateurRepository;
    }

    /** Calendrier : audits de l'auditeur connecté entre deux dates (AAAA-MM-JJ). */
    @GetMapping("/mes-audits")
    @PreAuthorize("hasRole('AUDITEUR')")
    public List<AuditItem> mesAudits(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate du,
                                     @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate au,
                                     Authentication authentication) {
        return service.mesAudits(utilisateurCourant(authentication), du, au);
    }

    @GetMapping("/mes-audits/a-traiter")
    @PreAuthorize("hasRole('AUDITEUR')")
    public List<AuditItem> aTraiter(Authentication authentication) {
        return service.aTraiter(utilisateurCourant(authentication));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('AUDITEUR','RESPONSABLE_QUALITE','ADMINISTRATEUR')")
    public AuditDetail detail(@PathVariable Long id, Authentication authentication) {
        return service.detail(id, utilisateurCourant(authentication));
    }

    @PostMapping("/{id}/demarrer")
    @PreAuthorize("hasRole('AUDITEUR')")
    public AuditDetail demarrer(@PathVariable Long id, Authentication authentication) {
        return service.demarrer(id, utilisateurCourant(authentication));
    }

    @PutMapping("/{id}/compte-rendu")
    @PreAuthorize("hasRole('AUDITEUR')")
    public AuditDetail enregistrer(@PathVariable Long id, @Valid @RequestBody CompteRenduRequest requete,
                                   Authentication authentication) {
        return service.enregistrer(id, requete, utilisateurCourant(authentication));
    }

    @PostMapping("/{id}/constats")
    @PreAuthorize("hasRole('AUDITEUR')")
    public AuditDetail ajouterConstat(@PathVariable Long id, @Valid @RequestBody ConstatRequest requete,
                                      Authentication authentication) {
        return service.ajouterConstat(id, requete, utilisateurCourant(authentication));
    }

    @PutMapping("/{id}/constats/{constatId}")
    @PreAuthorize("hasRole('AUDITEUR')")
    public AuditDetail modifierConstat(@PathVariable Long id, @PathVariable Long constatId,
                                       @Valid @RequestBody ConstatRequest requete, Authentication authentication) {
        return service.modifierConstat(id, constatId, requete, utilisateurCourant(authentication));
    }

    @DeleteMapping("/{id}/constats/{constatId}")
    @PreAuthorize("hasRole('AUDITEUR')")
    public AuditDetail supprimerConstat(@PathVariable Long id, @PathVariable Long constatId,
                                        Authentication authentication) {
        return service.supprimerConstat(id, constatId, utilisateurCourant(authentication));
    }

    @PostMapping("/{id}/terminer")
    @PreAuthorize("hasRole('AUDITEUR')")
    public AuditDetail terminer(@PathVariable Long id, @Valid @RequestBody CompteRenduRequest requete,
                                Authentication authentication) {
        return service.terminer(id, requete, utilisateurCourant(authentication));
    }

    private Users utilisateurCourant(Authentication authentication) {
        return utilisateurRepository.findByEmailIgnoreCase(authentication.getName())
                .filter(u -> Boolean.TRUE.equals(u.getActif()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session invalide"));
    }
}