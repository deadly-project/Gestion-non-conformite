package com.example.dto.reinitialisation;

import java.util.UUID;

/**
 * Message poussé en temps réel aux administrateurs (WebSocket).
 * Champs simples (dates en texte ISO) pour une lecture directe côté React.
 * Le front recharge ensuite la liste via l'API : le message n'est qu'un signal.
 */
public record NotificationTempsReel(
        String type,          // DEMANDE_RECUE, DEMANDE_VALIDEE, DEMANDE_REFUSEE
        UUID demandeId,
        String matricule,
        String nom,
        String prenom,
        String statut,
        String dateDemande,
        String message
) {}
