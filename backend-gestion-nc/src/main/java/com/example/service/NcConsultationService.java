package com.example.service;

import com.example.dto.nc.*;
import com.example.entity.*;
import com.example.repository.*;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class NcConsultationService {

    private static final Set<String> ROLES = Set.of("DECLARANT", "AUDITEUR", "RESPONSABLE_QUALITE", "ADMINISTRATEUR");

    public record PieceJointeLue(Resource ressource, String nom, String mime) {}

    private final NonConformiteRepository ncRepository;
    private final NcAttachmentRepository attachmentRepository;
    private final IshikawaAnalyseRepository ishikawaRepository;
    private final ActionCapaRepository capaRepository;
    private final ProcessusRepository processusRepository;
    private final UtilisateurRechercheRepository rechercheRepository;
    private final UtilisateurRepository utilisateurRepository;
    private final PieceJointeService pieceJointeService;

    public NcConsultationService(NonConformiteRepository ncRepository,
                                 NcAttachmentRepository attachmentRepository,
                                 IshikawaAnalyseRepository ishikawaRepository,
                                 ActionCapaRepository capaRepository,
                                 ProcessusRepository processusRepository,
                                 UtilisateurRechercheRepository rechercheRepository,
                                 UtilisateurRepository utilisateurRepository,
                                 PieceJointeService pieceJointeService) {
        this.ncRepository = ncRepository;
        this.attachmentRepository = attachmentRepository;
        this.ishikawaRepository = ishikawaRepository;
        this.capaRepository = capaRepository;
        this.processusRepository = processusRepository;
        this.rechercheRepository = rechercheRepository;
        this.utilisateurRepository = utilisateurRepository;
        this.pieceJointeService = pieceJointeService;
    }

    // ------------------------------------------------------------------
    // Liste paginée (responsable qualité)
    // ------------------------------------------------------------------
    @Transactional(readOnly = true)
    public PageResponse<NcListeItem> lister(String statut, String recherche, int page, int taille) {
        int tailleSure = Math.min(Math.max(taille, 1), 50);
        int pageSure = Math.max(page, 0);
        String statutSur = statut == null ? "" : statut.trim().toUpperCase(Locale.ROOT);
        if (!statutSur.isEmpty()) {
            try {
                com.example.domain.StatutNc.valueOf(statutSur);
            } catch (IllegalArgumentException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Statut inconnu");
            }
        }

        Page<NcListeItem> resultat = ncRepository.rechercher(
                statutSur, motif(recherche), PageRequest.of(pageSure, tailleSure));
        return new PageResponse<>(resultat.getContent(), resultat.getNumber(), resultat.getSize(),
                resultat.getTotalElements(), resultat.getTotalPages());
    }

    // ------------------------------------------------------------------
    // Détail (formulaire de traitement et fenêtre « Avancement »)
    // ------------------------------------------------------------------
    @Transactional(readOnly = true)
    public NcDetailResponse detail(Long ncId) {
        NonConformite nc = ncRepository.findById(ncId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Non-conformité introuvable"));

        List<ActionCapa> actions = capaRepository.findByNcIdOrderByIdAsc(ncId);

        Set<Long> idsUtilisateurs = new HashSet<>();
        idsUtilisateurs.add(nc.getDeclarantId());
        if (nc.getAuditeurId() != null) idsUtilisateurs.add(nc.getAuditeurId());
        actions.forEach(a -> idsUtilisateurs.add(a.getResponsableActionId()));
        Map<Long, UtilisateurResume> utilisateurs = utilisateurRepository.findAllById(idsUtilisateurs).stream()
                .collect(Collectors.toMap(Users::getId, this::resume));

        Processus processus = processusRepository.findById(nc.getProcessusId()).orElse(null);
        ReferentielItem service = processus == null ? null
                : new ReferentielItem(processus.getId(), processus.getCode(), processus.getLibelle());

        List<NcDetailResponse.PieceJointeDto> pieces = attachmentRepository.findByNcIdOrderByIdAsc(ncId).stream()
                .map(p -> new NcDetailResponse.PieceJointeDto(
                        p.getId(), p.getNomOriginal(), p.getFileType(), p.getMimeType(), p.getTailleOctets()))
                .toList();

        List<AnalyseIshikawaDto> analyses = ishikawaRepository.findByNcId(ncId).stream()
                .map(a -> new AnalyseIshikawaDto(com.example.domain.BrancheIshikawa.valueOf(a.getBranche()),
                        a.getPourquoi1(), a.getPourquoi2(), a.getPourquoi3(), a.getPourquoi4(),
                        a.getPourquoi5(), a.getCauseRacineValidee()))
                .toList();

        List<NcDetailResponse.EtapeCapaDetail> etapes = actions.stream()
                .map(a -> new NcDetailResponse.EtapeCapaDetail(
                        a.getId(), a.getTypeAction(), a.getDescription(),
                        utilisateurs.get(a.getResponsableActionId()), a.getDateEcheance(), a.getStatutAction()))
                .toList();

        return new NcDetailResponse(
                nc.getId(), nc.getReference(), nc.getTitre(), nc.getDateDetection(),
                utilisateurs.get(nc.getDeclarantId()), service, nc.getCategorieId(),
                nc.getDescriptionDetaillee(), nc.getGraviteDeclaree(), nc.getGravite(), nc.getStatut(),
                nc.getAuditeurId() == null ? null : utilisateurs.get(nc.getAuditeurId()),
                nc.getDelaisJours(), nc.getDateEcheance(), nc.getDateOuverture(),
                pieces, analyses, etapes);
    }

    // ------------------------------------------------------------------
    // Pièce jointe : déclarant de la NC, responsable qualité ou auditeur
    // ------------------------------------------------------------------
    @Transactional(readOnly = true)
    public PieceJointeLue lirePieceJointe(Long pieceId, Users acteur) {
        NcAttachment pj = attachmentRepository.findById(pieceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pièce jointe introuvable"));
        NonConformite nc = ncRepository.findById(pj.getNcId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Non-conformité introuvable"));

        boolean estDeclarant = nc.getDeclarantId().equals(acteur.getId());
        boolean roleAutorise = "RESPONSABLE_QUALITE".equals(acteur.getRole()) || "AUDITEUR".equals(acteur.getRole());
        if (!Boolean.TRUE.equals(acteur.getActif()) || !(estDeclarant || roleAutorise)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Accès refusé à cette pièce jointe");
        }
        return new PieceJointeLue(pieceJointeService.lire(pj), pj.getNomOriginal(), pj.getMimeType());
    }

    // ------------------------------------------------------------------
    // Recherche d'utilisateurs (nom, prénom ou matricule)
    // ------------------------------------------------------------------
    @Transactional(readOnly = true)
    public List<UtilisateurResume> rechercherUtilisateurs(String q, String role) {
        String roleSur = role == null ? "" : role.trim().toUpperCase(Locale.ROOT);
        if (!roleSur.isEmpty() && !ROLES.contains(roleSur)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rôle inconnu");
        }
        return rechercheRepository.rechercher(roleSur, motif(q), PageRequest.of(0, 10)).stream()
                .map(this::resume)
                .toList();
    }

    // ------------------------------------------------------------------
    // Outils
    // ------------------------------------------------------------------
    private UtilisateurResume resume(Users u) {
        return new UtilisateurResume(u.getId(), u.getNom(), u.getPrenom(),
                String.valueOf(u.getMatricule()), u.getRole());
    }

    /** « %texte% » en minuscules ; les caractères spéciaux de LIKE sont neutralisés. */
    private String motif(String saisie) {
        String propre = saisie == null ? "" : saisie.trim().toLowerCase(Locale.ROOT)
                .replace("%", " ").replace("_", " ").replace("\\", " ");
        return "%" + propre + "%";
    }

    @Transactional(readOnly = true)
    public List<NcListeItem> listerParDeclarant(Long declarantId) {
        return ncRepository.findByDeclarantIdOrderByDateCreationDescIdDesc(declarantId).stream()
                .map(nc -> {
                    Processus p = processusRepository.findById(nc.getProcessusId()).orElse(null);
                    Users u = utilisateurRepository.findById(nc.getDeclarantId()).orElse(null);
                    return new NcListeItem(
                            nc.getId(),
                            nc.getReference(),
                            nc.getTitre(),
                            nc.getStatut(),
                            nc.getDateDetection(),
                            nc.getDateCreation(),
                            nc.getGraviteDeclaree(),
                            nc.getGravite(),
                            u != null ? u.getNom() : "",
                            u != null ? u.getPrenom() : "",
                            p != null ? p.getLibelle() : ""
                    );
                })
                .toList();
    }
}
