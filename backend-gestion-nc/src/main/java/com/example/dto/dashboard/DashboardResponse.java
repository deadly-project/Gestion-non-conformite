package com.example.dto.dashboard;

import java.util.List;

/**
 * Indicateurs du tableau de bord qualité.
 * Le bloc « admin » n'est renseigné que pour l'administrateur (null pour le responsable qualité).
 */
public record DashboardResponse(
        Indicateurs indicateurs,
        int annee,
        List<Integer> anneesDisponibles,
        List<MoisNc> parMois,
        List<ProcessusNc> recurrenceParProcessus,
        AvancementAudits audits,
        BlocAdmin admin
) {

    /**
     * @param tauxDansLesDelais pourcentage (0 à 100) de NC traitées dans les délais, null si aucune NC
     *                          n'a d'échéance exploitable
     * @param delaiMoyenJours   délai moyen (déclaration -> clôture) des NC clôturées, null si aucune
     */
    public record Indicateurs(
            long total,
            long enAttente,
            long enCours,
            long cloturees,
            long dansLesDelais,
            long horsDelais,
            Double tauxDansLesDelais,
            Double delaiMoyenJours,
            long reouvertures
    ) {}

    /** mois : 1 à 12. declarees : NC déclarées ce mois ; prisesEnCharge : NC ouvertes (prises en charge) ce mois. */
    public record MoisNc(int mois, long declarees, long prisesEnCharge) {}

    public record ProcessusNc(String processus, long nbNc, long nbReouvertures) {}

    public record AvancementAudits(long total, long planifies, long enCours, long termines, long enRetard) {}

    public record BlocAdmin(
            long nbUtilisateurs,
            long nbUtilisateursActifs,
            long nbDemandesReinitialisation,
            long nbDemandesEnAttente
    ) {}
}