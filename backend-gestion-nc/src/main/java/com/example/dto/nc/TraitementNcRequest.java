package com.example.dto.nc;

import com.example.domain.Gravite;
import com.example.domain.StatutNc;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Formulaire de traitement d'une NC par le responsable qualité. */
public record TraitementNcRequest(
        @NotNull Gravite gravite,
        Long categorieId,          // nature : produit / processus / système...
        @NotNull StatutNc statut,
        Long auditeurId,
        @NotNull @Min(1) @Max(365) Integer delaisJours,
        @NotNull @Size(max = 5) List<@Valid AnalyseIshikawaDto> analyses,
        @NotNull @Size(max = 30) List<@Valid EtapeCapaDto> etapesCapa,
        // Attribution de la référence par le responsable qualité (uniquement si la NC n'en a pas).
        @Size(max = 20) String reference,
        Boolean genererReference
) {}
