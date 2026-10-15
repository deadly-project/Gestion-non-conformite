package com.example.dto.utilisateur;

public record UtilisateurCreationResponse(
        UtilisateurResponse utilisateur,
        String messageSucces,
        String statutEmail
) {}