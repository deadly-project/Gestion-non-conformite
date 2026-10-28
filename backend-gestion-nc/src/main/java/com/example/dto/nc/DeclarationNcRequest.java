package com.example.dto.nc;

import com.example.domain.Gravite;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record DeclarationNcRequest(
        // La référence est désormais facultative : pas d'annotation @NotBlank / @NotNull ici
        String reference,

        @NotBlank(message = "Le titre est obligatoire")
        @Size(max = 200, message = "Le titre ne doit pas dépasser 200 caractères")
        String titre,

        @NotNull(message = "La date de détection est obligatoire")
        LocalDate dateDetection,

        Long processusId,

        @Valid
        NouveauProcessusDto nouveauProcessus,

        @NotNull(message = "La gravité déclarée est obligatoire")
        Gravite graviteDeclaree,

        @NotBlank(message = "La description détaillée est obligatoire")
        @Size(max = 5000, message = "La description ne doit pas dépasser 5000 caractères")
        String descriptionDetaillee
) {
        public record NouveauProcessusDto(
                @NotBlank(message = "Le code du processus est obligatoire")
                String code,

                @NotBlank(message = "Le libellé du processus est obligatoire")
                String libelle,

                String description
        ) {}
}