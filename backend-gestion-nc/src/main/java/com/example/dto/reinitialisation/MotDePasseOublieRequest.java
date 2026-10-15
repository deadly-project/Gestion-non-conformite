package com.example.dto.reinitialisation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record MotDePasseOublieRequest(
        @NotBlank @Size(max = 50)
        String matricule
) {}
