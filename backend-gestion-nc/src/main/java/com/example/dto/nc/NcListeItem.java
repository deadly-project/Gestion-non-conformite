package com.example.dto.nc;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** Ligne de la liste des NC (construite directement par la requête JPQL). */
public record NcListeItem(
        Long id,
        String reference,
        String titre,
        String statut,
        LocalDate dateDetection,
        LocalDateTime dateCreation,
        String graviteDeclaree,
        String gravite,
        // ---- Auteur ----
        Long auteurId,
        String auteurNom,
        String auteurPrenom,
        String matriculeAuteur,
        String roleAuteur,
        String emailAuteur,
        // ---- Processus ----
        Long processusId,
        String service,
        // ---- Échéance ----
        LocalDate dateEcheance
) {}