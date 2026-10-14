
package com.example.dto.utilisateur;

import com.example.entity.Users;

import java.time.LocalDateTime;
import java.util.UUID;

public record UtilisateurResponse(
        UUID id,
        String nom,
        String prenom,
        String email,
        String matricule,
        String role,
        boolean actif,
        LocalDateTime dateCreation,
        LocalDateTime dateModification
) {
    public static UtilisateurResponse from(Users u) {
        return new UtilisateurResponse(
                u.getId(),
                u.getNom(),
                u.getPrenom(),
                u.getEmail(),
                u.getMatricule(),
                u.getRole(),
                Boolean.TRUE.equals(u.getActif()),
                u.getDateCreation(),
                u.getDateModification()
        );
    }
}
