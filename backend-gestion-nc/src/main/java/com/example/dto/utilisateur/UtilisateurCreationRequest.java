
package com.example.dto.utilisateur;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;


public record UtilisateurCreationRequest(
        @NotBlank
        @Size(max = 100)
        String nom,

        @NotBlank
        @Size(max = 100)
        String prenom,

        @NotBlank
        @Email
        @Size(max = 255)
        String email,

        @NotNull
        Integer matricule,

        @NotBlank
        @Size(min = 8, max = 72,message = "Le mot de passe doit contenir entre 8 et 72 caractères")
        String motDePasse,

        @NotBlank
        @Pattern(
                regexp = "DECLARANT|AUDITEUR|RESPONSABLE_QUALITE",
                message = "Le rôle doit être DECLARANT, AUDITEUR ou RESPONSABLE_QUALITE"
        )
        String role

) {
        /** Évite que le mot de passe apparaisse dans un log ou une trace. */
        @Override
        public String toString() {
                return "UtilisateurCreationRequest[email=" + email + ", matricule=" + matricule + ", role=" + role + "]";
        }
}
