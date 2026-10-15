package com.example.dto.reinitialisation;

import com.example.entity.DemandeReinitialisation;
import com.example.entity.enums.StatutDemande;
import com.example.entity.Users;

import java.time.LocalDateTime;
import java.util.UUID;

public record DemandeReinitialisationResponse(
        UUID id,
        UUID utilisateurId,
        String matricule,
        String nom,
        String prenom,
        String role,
        StatutDemande statut,
        LocalDateTime dateDemande,
        LocalDateTime dateTraitement
) {
    public static DemandeReinitialisationResponse from(DemandeReinitialisation d) {
        Users u = d.getUtilisateur();
        return new DemandeReinitialisationResponse(
                d.getId(),
                u.getId(),
                u.getMatricule(),
                u.getNom(),
                u.getPrenom(),
                u.getRole(),
                d.getStatut(),
                d.getDateDemande(),
                d.getDateTraitement()
        );
    }
}
