package com.example.controller;

import com.example.dto.audit.AuditDtos.*;
import com.example.entity.Users;
import com.example.repository.UtilisateurRepository;
import com.example.service.AuditeurAuditService;
import com.example.service.ConstatPieceJointeService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
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
    private final ConstatPieceJointeService pieceJointeService;
    private final UtilisateurRepository utilisateurRepository;

    public AuditeurAuditController(AuditeurAuditService service,
                                   ConstatPieceJointeService pieceJointeService,
                                   UtilisateurRepository utilisateurRepository) {
        this.service = service;
        this.pieceJointeService = pieceJointeService;
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

    /** Preuves facultatives d'un constat : images (JPEG/PNG/WebP) et/ou PDF. */
    @PostMapping(value = "/{id}/constats/{constatId}/pieces-jointes", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('AUDITEUR')")
    public AuditDetail ajouterPieceJointe(@PathVariable Long id, @PathVariable Long constatId,
                                          @RequestPart(value = "images", required = false) List<MultipartFile> images,
                                          @RequestPart(value = "pdf", required = false) MultipartFile pdf,
                                          Authentication authentication) {
        return pieceJointeService.ajouter(id, constatId, images, pdf, utilisateurCourant(authentication));
    }

    /** Téléchargement protégé d'une preuve de constat. */
    @GetMapping("/pieces-jointes/{pieceId}")
    @PreAuthorize("hasAnyRole('AUDITEUR','RESPONSABLE_QUALITE','ADMINISTRATEUR')")
    public ResponseEntity<org.springframework.core.io.Resource> pieceJointe(@PathVariable Long pieceId,
                                                                           Authentication authentication) {
        ConstatPieceJointeService.PieceJointeLue pj =
                pieceJointeService.lire(pieceId, utilisateurCourant(authentication));
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(pj.mime()))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.inline().filename(pj.nom(), StandardCharsets.UTF_8).build().toString())
                .header("X-Content-Type-Options", "nosniff")
                .body(pj.ressource());
    }

    @PostMapping("/{id}/reouvrir")
    @PreAuthorize("hasRole('AUDITEUR')")
    public AuditDetail reouvrir(@PathVariable Long id, Authentication authentication) {
        return service.reouvrir(id, utilisateurCourant(authentication));
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