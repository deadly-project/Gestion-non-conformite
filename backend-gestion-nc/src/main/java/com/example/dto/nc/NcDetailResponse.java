package com.example.dto.nc;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record NcDetailResponse(
        Long id,
        String reference,
        String titre,
        LocalDate dateDetection,
        UtilisateurResume declarant,
        ReferentielItem service,
        Long categorieId,
        String descriptionDetaillee,
        String graviteDeclaree,
        String gravite,
        String statut,
        UtilisateurResume auditeur,
        Integer delaisJours,
        LocalDate dateEcheance,
        LocalDateTime dateOuverture,
        List<PieceJointeDto> piecesJointes,
        List<AnalyseIshikawaDto> analyses,
        List<EtapeCapaDetail> etapesCapa
) {
    public record PieceJointeDto(Long id, String nomOriginal, String type, String mimeType, Long taille) {}

    public record EtapeCapaDetail(
            Long id,
            String type,
            String description,
            UtilisateurResume responsable,
            LocalDate dateEcheance,
            String statut
    ) {}
}
