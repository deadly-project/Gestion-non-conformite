package com.example.dto.auth;

import com.example.dto.utilisateur.UtilisateurResponse;

public record LoginResponse(
        String accessToken,
        String tokenType,
        long expiresIn,
        UtilisateurResponse utilisateur
) {}