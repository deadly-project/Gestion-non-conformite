package com.example.dto.utilisateur;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ProfilModificationRequest(
        @NotBlank @Size(max = 100)
        String nom,

        @NotBlank @Size(max = 100)
        String prenom,

        @NotBlank @Email @Size(max = 255)
        String email,

        @NotBlank @Size(max = 50)
        String matricule
) {}