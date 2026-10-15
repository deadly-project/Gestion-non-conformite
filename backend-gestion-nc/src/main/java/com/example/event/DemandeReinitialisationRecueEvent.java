package com.example.event;

import com.example.dto.reinitialisation.DemandeReinitialisationResponse;

/** Publié après l'enregistrement (commit) d'une demande de réinitialisation. */
public record DemandeReinitialisationRecueEvent(
        DemandeReinitialisationResponse demande,
        String email,
        String prenom,
        String nom
) {}
