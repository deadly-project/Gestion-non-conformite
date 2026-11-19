package com.example.dto.dashboard;

import java.util.List;

/** Données des tableaux de bord qualité et administration. */
public record DashboardResponse(
        Indicateurs indicateurs,
        int annee,
        List<Integer> anneesDisponibles,
        List<MoisNc> parMois,
        List<ProcessusNc> recurrenceParProcessus,
        AvancementAudits audits,
        BlocAdmin admin
) {
    /** enCours conserve le total agrégé pour compatibilité avec les anciens écrans. */
    public record Indicateurs(
            long total,
            long enAttente,
            long enCours,
            long cloturees,
            long dansLesDelais,
            long horsDelais,
            Double tauxDansLesDelais,
            Double delaiMoyenJours,
            long reouvertures,
            long ouvert,
            long enCoursAnalyse,
            long enTraitement,
            RepartitionDelais repartitionDelais
    ) {}

    /** Détail du KPI : clôtures à temps et NC dont l'échéance est dépassée. */
    public record RepartitionDelais(
            long dansLesDelaisCloturees,
            long horsDelaisEnAttente,
            long horsDelaisOuvertes,
            long horsDelaisEnCoursAnalyse,
            long horsDelaisEnTraitement,
            long horsDelaisCloturees
    ) {}

    public record MoisNc(int mois, long declarees, long prisesEnCharge) {}
    public record ProcessusNc(String processus, long nbNc, long nbReouvertures) {}
    public record AvancementAudits(long total, long planifies, long enCours, long termines, long enRetard) {}

    /** Activité issue de historique_actions, et non du nombre de NC. */
    public record Activite(String periode, long total) {}

    public record BlocAdmin(
            long nbUtilisateurs,
            long nbDemandesReinitialisation,
            long nbDemandesEnAttente,
            long nbDemandesValidees,
            long nbDemandesRejetees,
            List<Activite> activiteParMois,
            List<Activite> activiteParJour
    ) {}
}