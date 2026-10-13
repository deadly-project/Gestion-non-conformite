package com.example.dto.utilisateur;

import com.example.entity.Utilisateur;
import java.util.UUID;

public record UtilisateurResponse(
        UUID id,
        String nom,
        String prenom,
        String email,
        String matricule,
        String role,
        boolean actif
) {
    public static UtilisateurResponse from(Utilisateur u) {
        return new UtilisateurResponse(u.getId(), u.getNom(), u.getPrenom(), u.getEmail(),
                u.getMatricule(), u.getRole(), Boolean.TRUE.equals(u.getActif()));
    }
}
