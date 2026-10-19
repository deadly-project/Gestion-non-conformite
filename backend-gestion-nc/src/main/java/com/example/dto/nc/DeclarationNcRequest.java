package com.example.dto.nc;

import com.example.domain.Gravite;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * Formulaire de déclaration d'une non-conformité.
 * La référence et l'auteur peuvent être saisis ou gérés selon les besoins.
 */
public record DeclarationNcRequest(
        @NotBlank @Size(max = 20) String reference,

        @NotBlank @Size(max = 200) String titre,

        @NotNull LocalDate dateDetection,

        // Optionnel si on crée un nouveau processus à la volée
        Long processusId,

        // Optionnel si on choisit un processus existant
        NouveauProcessusDto nouveauProcessus,

        @NotNull Gravite graviteDeclaree,

        @NotBlank @Size(max = 5000) String descriptionDetaillee
) {
    /**
     * Sous-DTO pour la création d'un processus à la volée lors de la déclaration.
     */
    public record NouveauProcessusDto(
            @NotBlank @Size(max = 30) String code,
            @NotBlank @Size(max = 150) String libelle,
            String description
    ) {}
}