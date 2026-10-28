package com.example.dto.reinitialisation;

import jakarta.validation.constraints.NotNull;

public record MotDePasseOublieRequest(
        @NotNull
        Integer matricule
) {}