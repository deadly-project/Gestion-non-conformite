package com.example.dto.nc;

import com.example.domain.TypeAction;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/** Une étape du plan d'actions. id = null pour une nouvelle étape. */
public record EtapeCapaDto(
        Long id,
        @NotNull TypeAction type,
        @NotBlank @Size(max = 2000) String description,
        @NotNull Long responsableId,
        @NotNull LocalDate dateEcheance
) {}
