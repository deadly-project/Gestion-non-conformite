
package com.example.dto.utilisateur;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UtilisateurModificationRequest(
        @NotBlank @Size(max = 100)
        String nom,

        @NotBlank @Size(max = 100)
        String prenom,

        @NotBlank @Email @Size(max = 255)
        String email,

        @NotNull
        Integer matricule,

        @NotBlank
        @Pattern(
                regexp = "DECLARANT|AUDITEUR|RESPONSABLE_QUALITE",
                message = "Le rôle doit être DECLARANT, AUDITEUR ou RESPONSABLE_QUALITE"
        )
        String role
) {}
