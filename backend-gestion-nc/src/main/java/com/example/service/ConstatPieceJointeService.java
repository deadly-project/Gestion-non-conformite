package com.example.service;

import com.example.dto.audit.AuditDtos.AuditDetail;
import com.example.entity.*;
import com.example.repository.*;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Preuves jointes aux constats d'audit (facultatives) : mêmes contrôles que les pièces
 * jointes d'une NC (images JPEG/PNG/WebP + PDF, tailles limitées).
 */
@Service
public class ConstatPieceJointeService {

    public record PieceJointeLue(Resource ressource, String nom, String mime) {}

    private final ConstatPieceJointeRepository repository;
    private final ConstatAuditRepository constatRepository;
    private final AuditRepository auditRepository;
    private final PieceJointeService stockage;
    private final AuditAssembleur assembleur;
    private final JournalActionsService journal;

    public ConstatPieceJointeService(ConstatPieceJointeRepository repository,
                                     ConstatAuditRepository constatRepository,
                                     AuditRepository auditRepository,
                                     PieceJointeService stockage,
                                     AuditAssembleur assembleur,
                                     JournalActionsService journal) {
        this.repository = repository;
        this.constatRepository = constatRepository;
        this.auditRepository = auditRepository;
        this.stockage = stockage;
        this.assembleur = assembleur;
        this.journal = journal;
    }

    @Transactional
    public AuditDetail ajouter(Long auditId, Long constatId, List<MultipartFile> images,
                               MultipartFile pdf, Users acteur) {
        Audit audit = auditRepository.findById(auditId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Audit introuvable"));
        if (!"AUDITEUR".equals(acteur.getRole()) || !audit.getAuditeurId().equals(acteur.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cet audit ne vous est pas attribué");
        }
        if (!"EN_COURS".equals(audit.getStatut())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Les preuves ne peuvent être ajoutées que pendant un audit en cours");
        }
        ConstatAudit constat = constatRepository.findById(constatId)
                .filter(c -> c.getAuditId().equals(auditId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Constat introuvable"));

        List<PieceJointeService.FichierValide> fichiers = stockage.valider(images, pdf);
        LocalDateTime maintenant = LocalDateTime.now();
        List<Map<String, Object>> ajoutees = new java.util.ArrayList<>();
        for (PieceJointeService.FichierValide f : fichiers) {
            String cle = stockage.stocker("constat/" + constatId, f);
            ConstatPieceJointe pj = new ConstatPieceJointe();
            pj.setConstatId(constatId);
            pj.setFileUrl(cle);
            pj.setNomOriginal(f.fichier().getOriginalFilename());
            pj.setFileType(f.type().name());
            pj.setMimeType(f.mime());
            pj.setTailleOctets(f.fichier().getSize());
            pj.setUploadedBy(acteur.getId());
            pj.setDateCreation(maintenant);
            repository.save(pj);
            ajoutees.add(Instantane.de(pj));     // toutes les colonnes de chaque fichier enregistré
        }

        Map<String, Object> apres = new java.util.LinkedHashMap<>();
        apres.put("piecesJointesAjoutees", ajoutees);
        Map<String, Object> contexte = new java.util.LinkedHashMap<>();
        contexte.put("auditId", auditId);
        journal.enregistrerModification(acteur.getId(), "ADD_CONSTAT_ATTACHMENT", "CONSTAT_AUDIT", constat.getId(),
                null, apres, contexte);

        com.example.dto.audit.AuditDtos.AuditItem item = assembleur.items(List.of(audit)).get(0);
        return new AuditDetail(item, audit.getCompteRendu(), audit.getTraitementRealise(),
                true, null, assembleur.constatsParAudit(List.of(auditId))
                .getOrDefault(auditId, List.of()));
    }

    @Transactional(readOnly = true)
    public PieceJointeLue lire(Long pieceId, Users acteur) {
        ConstatPieceJointe pj = repository.findById(pieceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pièce jointe introuvable"));
        ConstatAudit constat = constatRepository.findById(pj.getConstatId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Constat introuvable"));
        Audit audit = auditRepository.findById(constat.getAuditId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Audit introuvable"));

        boolean autorise = switch (acteur.getRole()) {
            case "ADMINISTRATEUR", "RESPONSABLE_QUALITE" -> true;
            case "AUDITEUR" -> audit.getAuditeurId().equals(acteur.getId());
            default -> false;
        };
        if (!Boolean.TRUE.equals(acteur.getActif()) || !autorise) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Accès refusé à cette pièce jointe");
        }
        return new PieceJointeLue(stockage.lireParCle(pj.getFileUrl()), pj.getNomOriginal(), pj.getMimeType());
    }
}