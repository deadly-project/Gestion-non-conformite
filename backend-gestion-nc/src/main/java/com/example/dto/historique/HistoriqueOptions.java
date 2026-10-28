package com.example.dto.historique;

import java.util.List;

/** Valeurs disponibles pour les filtres de l'historique. */
public record HistoriqueOptions(List<String> typesAction, List<String> entites) {}