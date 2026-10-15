package com.example.event;

import com.example.dto.reinitialisation.DemandeReinitialisationResponse;

/** Publié après validation ou refus d'une demande (statut dans {@code demande}). */
public record DemandeReinitialisationTraiteeEvent(
        DemandeReinitialisationResponse demande,
        String email,
        String prenom,
        String nom
) {}
