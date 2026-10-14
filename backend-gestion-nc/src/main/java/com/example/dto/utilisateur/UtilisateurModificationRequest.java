
package com.example.dto.utilisateur;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record UtilisateurModificationRequest(
        @NotBlank @Size(max = 100)
        String nom,

        @NotBlank @Size(max = 100)
        String prenom,

        @NotBlank @Email @Size(max = 255)
        String email,

        @NotBlank @Size(max = 50)
        String matricule,

        @NotBlank
        @Pattern(
                regexp = "DECLARANT|AUDITEUR|RESPONSABLE_QUALITE",
                message = "Le rôle doit être DECLARANT, AUDITEUR ou RESPONSABLE_QUALITE"
        )
        String role,

        LocalDate dateNaissance
) {}
