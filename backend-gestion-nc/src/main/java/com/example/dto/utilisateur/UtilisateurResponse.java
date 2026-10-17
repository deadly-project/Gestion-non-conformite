
package com.example.dto.utilisateur;

import com.example.entity.Users;

import java.time.LocalDateTime;

public record UtilisateurResponse(
        Long id,
        String nom,
        String prenom,
        String email,
        Integer matricule,
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
