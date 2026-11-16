package com.example.controller;

import com.example.dto.document.DocumentDtos.*;
import com.example.dto.nc.PageResponse;
import com.example.entity.Users;
import com.example.repository.UtilisateurRepository;
import com.example.service.DocumentQualiteService;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;

/**
 * Gestion documentaire qualité. Connexion obligatoire ; le détail des droits (consulter, ajouter,
 * modifier, changer le statut, voir les archives) est appliqué par {@link DocumentQualiteService}.
 */
@RestController
@RequestMapping("/api/documents-qualite")
@PreAuthorize("isAuthenticated()")
public class DocumentQualiteController {

    private final DocumentQualiteService service;
    private final UtilisateurRepository utilisateurRepository;

    public DocumentQualiteController(DocumentQualiteService service, UtilisateurRepository utilisateurRepository) {
        this.service = service;
        this.utilisateurRepository = utilisateurRepository;
    }

    /** Liste filtrée : q (texte), processusId, type, statut, vue = ACTIFS | ARCHIVES | TOUS. */
    @GetMapping
    public PageResponse<DocumentItem> lister(
            @RequestParam(defaultValue = "") String q,
            @RequestParam(required = false) Long processusId,
            @RequestParam(defaultValue = "") String type,
            @RequestParam(defaultValue = "") String statut,
            @RequestParam(defaultValue = "ACTIFS") String vue,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int taille,
            Authentication authentication) {
        return service.lister(utilisateurCourant(authentication), q, processusId, type, statut, vue, page, taille);
    }

    @GetMapping("/statistiques")
    public Statistiques statistiques(Authentication authentication) {
        return service.statistiques(utilisateurCourant(authentication));
    }

    @GetMapping("/droits")
    public MesDroits droits(Authentication authentication) {
        return service.mesDroits(utilisateurCourant(authentication));
    }

    @GetMapping("/{id}")
    public DocumentItem detail(@PathVariable Long id, Authentication authentication) {
        return service.detail(id, utilisateurCourant(authentication));
    }

    /** Affichage (inline, si le format s'y prête) ou téléchargement (telecharger=true). */
    @GetMapping("/{id}/fichier")
    public ResponseEntity<org.springframework.core.io.Resource> fichier(
            @PathVariable Long id,
            @RequestParam(defaultValue = "false") boolean telecharger,
            Authentication authentication) {
        DocumentQualiteService.FichierLu f = service.lireFichier(id, utilisateurCourant(authentication));
        ContentDisposition disposition = (!telecharger && f.affichable() ? ContentDisposition.inline()
                : ContentDisposition.attachment()).filename(f.nom(), StandardCharsets.UTF_8).build();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(f.mime()))
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .body(f.ressource());
    }

    /** Ajout : corps multipart « donnees » (JSON) + « fichier ». */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public DocumentItem ajouter(@RequestPart("donnees") CreationRequest donnees,
                                @RequestPart(value = "fichier", required = false) MultipartFile fichier,
                                Authentication authentication) {
        return service.ajouter(donnees, fichier, utilisateurCourant(authentication));
    }

    @PutMapping("/{id}")
    public DocumentItem modifier(@PathVariable Long id, @RequestBody ModificationRequest requete,
                                 Authentication authentication) {
        return service.modifier(id, requete, utilisateurCourant(authentication));
    }

    /** Changement de statut ; passer à OBSOLETE = archiver. */
    @PutMapping("/{id}/statut")
    public DocumentItem statut(@PathVariable Long id, @RequestBody StatutRequest requete,
                               Authentication authentication) {
        return service.changerStatut(id, requete, utilisateurCourant(authentication));
    }

    private Users utilisateurCourant(Authentication authentication) {
        return utilisateurRepository.findByEmailIgnoreCase(authentication.getName())
                .filter(u -> Boolean.TRUE.equals(u.getActif()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session invalide"));
    }
}