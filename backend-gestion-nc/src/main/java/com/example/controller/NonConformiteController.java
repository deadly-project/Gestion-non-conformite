package com.example.controller;

import com.example.dto.nc.*;
import com.example.entity.Users;
import com.example.repository.UtilisateurRepository;
import com.example.service.NcConsultationService;
import com.example.service.NcService;
import com.example.service.NcTraitementService;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api/non-conformites")
public class NonConformiteController {

    private final NcService ncService;
    private final NcConsultationService consultationService;
    private final NcTraitementService traitementService;
    private final UtilisateurRepository utilisateurRepository;

    public NonConformiteController(NcService ncService,
                                   NcConsultationService consultationService,
                                   NcTraitementService traitementService,
                                   UtilisateurRepository utilisateurRepository) {
        this.ncService = ncService;
        this.consultationService = consultationService;
        this.traitementService = traitementService;
        this.utilisateurRepository = utilisateurRepository;
    }

    /** Déclaration : tout employé connecté. Corps multipart : « donnees » (JSON), « images », « pdf ». */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("isAuthenticated()")
    public NcCreeResponse declarer(
            @Valid @RequestPart("donnees") DeclarationNcRequest donnees,
            @RequestPart(value = "images", required = false) List<MultipartFile> images,
            @RequestPart(value = "pdf", required = false) MultipartFile pdf,
            Authentication authentication) {
        return ncService.declarer(donnees, images, pdf, utilisateurCourant(authentication));
    }

    @GetMapping
    @PreAuthorize("hasRole('RESPONSABLE_QUALITE')")
    public PageResponse<NcListeItem> lister(
            @RequestParam(defaultValue = "") String statut,
            @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int taille) {
        return consultationService.lister(statut, q, page, taille);
    }

    @GetMapping("/mes-nc")
    @PreAuthorize("isAuthenticated()")
    public List<NcListeItem> listerMesNonConformites(Authentication authentication) {
        return consultationService.listerParDeclarant(utilisateurCourant(authentication).getId());
    }

    @GetMapping("/{id}")
    //@PreAuthorize("hasRole('RESPONSABLE_QUALITE')")
    public NcDetailResponse detail(@PathVariable Long id) {
        return consultationService.detail(id);
    }

    @PutMapping("/{id}/traitement")
    @PreAuthorize("hasRole('RESPONSABLE_QUALITE')")
    public NcDetailResponse traiter(@PathVariable Long id,
                                    @Valid @RequestBody TraitementNcRequest requete,
                                    Authentication authentication) {
        return traitementService.traiter(id, requete, utilisateurCourant(authentication));
    }

    /** Modification par le déclarant d'une non-conformité à l'état EN_ATTENTE. */
    @PutMapping("/{id}/declarant")
    @PreAuthorize("isAuthenticated()")
    public NcDetailResponse modifierParDeclarant(@PathVariable Long id,
                                                 @Valid @RequestBody DeclarationNcRequest requete,
                                                 Authentication authentication) {
        return ncService.modifierParDeclarant(id, requete, utilisateurCourant(authentication));
    }

    /** Recherche d'un auditeur (ou de tout utilisateur) par nom, prénom ou matricule. */
    @GetMapping("/recherche-utilisateurs")
    @PreAuthorize("hasRole('RESPONSABLE_QUALITE')")
    public List<UtilisateurResume> rechercherUtilisateurs(@RequestParam(defaultValue = "") String q,
                                                          @RequestParam(defaultValue = "") String role) {
        return consultationService.rechercherUtilisateurs(q, role);
    }

    /** Téléchargement protégé : le navigateur l'appelle avec l'en-tête Authorization (blob). */
    @GetMapping("/pieces-jointes/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<org.springframework.core.io.Resource> pieceJointe(@PathVariable Long id,
                                                                            Authentication authentication) {
        NcConsultationService.PieceJointeLue pj =
                consultationService.lirePieceJointe(id, utilisateurCourant(authentication));
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(pj.mime()))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.inline().filename(pj.nom(), StandardCharsets.UTF_8).build().toString())
                .header("X-Content-Type-Options", "nosniff")
                .body(pj.ressource());
    }

    private Users utilisateurCourant(Authentication authentication) {
        return utilisateurRepository.findByEmailIgnoreCase(authentication.getName())
                .filter(u -> Boolean.TRUE.equals(u.getActif()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session invalide"));
    }
}