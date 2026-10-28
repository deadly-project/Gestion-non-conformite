package com.example.dto.historique;

import java.time.LocalDateTime;
import java.util.Map;

/** Ligne d'historique enrichie avec l'identité de l'utilisateur qui a agi. */
public record HistoriqueItem(
        Long id,
        Long utilisateurId,
        String utilisateurNom,
        String utilisateurPrenom,
        Integer utilisateurMatricule,
        String utilisateurRole,
        String actionType,
        String entite,
        Long entiteId,
        Map<String, Object> details,
        LocalDateTime date
) {}