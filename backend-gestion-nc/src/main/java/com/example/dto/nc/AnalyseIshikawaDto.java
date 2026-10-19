package com.example.dto.nc;

import com.example.domain.BrancheIshikawa;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Une branche d'Ishikawa avec ses 5 « Pourquoi ». */
public record AnalyseIshikawaDto(
        @NotNull BrancheIshikawa branche,
        @Size(max = 2000) String pourquoi1,
        @Size(max = 2000) String pourquoi2,
        @Size(max = 2000) String pourquoi3,
        @Size(max = 2000) String pourquoi4,
        @Size(max = 2000) String pourquoi5,
        @Size(max = 2000) String causeRacineValidee
) {}
