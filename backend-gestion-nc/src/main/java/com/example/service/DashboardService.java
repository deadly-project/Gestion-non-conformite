package com.example.service;

import com.example.dto.dashboard.DashboardResponse;
import com.example.dto.dashboard.DashboardResponse.*;
import com.example.entity.enums.StatutDemande;
import com.example.repository.DemandeReinitialisationRepository;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.ArrayList;
import java.util.List;

/**
 * Indicateurs du tableau de bord (responsable qualité et administrateur).
 *
 * Tout est calculé en SQL (agrégats) pour rester réactif avec un gros volume, et à partir de l'état
 * COURANT des non-conformités : une NC rouverte n'est plus « clôturée », elle sort donc du taux de
 * traitement dans les délais jusqu'à sa nouvelle clôture (date_cloturation est réécrite à chaque clôture).
 *
 * « Traitée dans les délais » : NC clôturée dont la clôture a eu lieu au plus tard le jour de l'échéance.
 * « Hors délais » : NC clôturée après l'échéance, ou NC non clôturée dont l'échéance est dépassée.
 * Les NC sans échéance ne comptent pas dans ce taux.
 */
@Service
public class DashboardService {

    private final EntityManager em;
    private final DemandeReinitialisationRepository demandeRepository;

    public DashboardService(EntityManager em, DemandeReinitialisationRepository demandeRepository) {
        this.em = em;
        this.demandeRepository = demandeRepository;
    }

    @Transactional(readOnly = true)
    public DashboardResponse construire(Integer annee, boolean administrateur) {
        int anneeCourante = LocalDate.now().getYear();
        int anneeChoisie = annee == null ? anneeCourante : Math.min(Math.max(annee, 2000), 2100);

        if (administrateur) {
            // Le dashboard administrateur ne reçoit aucune statistique relative aux NC ou aux audits.
            return new DashboardResponse(null, anneeChoisie, List.of(), List.of(), List.of(), null,
                    blocAdmin(anneeChoisie));
        }

        return new DashboardResponse(
                indicateurs(),
                anneeChoisie,
                anneesDisponibles(anneeCourante),
                parMois(anneeChoisie),
                recurrenceParProcessus(),
                audits(),
                null);
    }

    // ------------------------------------------------------------------ non-conformités
    private Indicateurs indicateurs() {
        Object[] l = (Object[]) em.createNativeQuery("""
                select
                    count(*),
                    count(*) filter (where statut = 'EN_ATTENTE'),
                    count(*) filter (where statut in ('OUVERT','EN_COURS_D_ANALYSE','EN_TRAITEMENT')),
                    count(*) filter (where statut = 'CLOTUREE'),
                    count(*) filter (where statut = 'CLOTUREE' and date_echeance is not null
                                       and date_cloturation is not null
                                       and cast(date_cloturation as date) <= date_echeance),
                    count(*) filter (where date_echeance is not null and (
                                       (statut = 'CLOTUREE' and date_cloturation is not null
                                            and cast(date_cloturation as date) > date_echeance)
                                    or (statut <> 'CLOTUREE' and date_echeance < current_date))),
                    avg(extract(epoch from (date_cloturation - date_creation)) / 86400.0)
                        filter (where statut = 'CLOTUREE' and date_cloturation is not null),
                    coalesce(sum(nb_reouvertures), 0)
                from non_conformites
                """).getSingleResult();

        long dans = nombre(l[4]);
        long hors = nombre(l[5]);
        Double taux = (dans + hors) == 0 ? null : arrondi(100.0 * dans / (dans + hors));
        Double delai = l[6] == null ? null : arrondi(((Number) l[6]).doubleValue());

        return new Indicateurs(nombre(l[0]), nombre(l[1]), nombre(l[2]), nombre(l[3]),
                dans, hors, taux, delai, nombre(l[7]));
    }

    private List<Integer> anneesDisponibles(int anneeCourante) {
        Object min = em.createNativeQuery(
                "select min(extract(year from date_creation)) from non_conformites").getSingleResult();
        int debut = min == null ? anneeCourante : Math.min(((Number) min).intValue(), anneeCourante);
        List<Integer> annees = new ArrayList<>();
        for (int a = anneeCourante; a >= debut; a--) annees.add(a);
        return annees;
    }

    /** 12 mois, avec 0 pour les mois sans NC : l'histogramme est toujours complet. */
    @SuppressWarnings("unchecked")
    private List<MoisNc> parMois(int annee) {
        long[] declarees = new long[13];
        long[] prises = new long[13];

        List<Object[]> d = em.createNativeQuery("""
                select cast(extract(month from date_creation) as integer), count(*)
                from non_conformites
                where cast(extract(year from date_creation) as integer) = :annee
                group by 1
                """).setParameter("annee", annee).getResultList();
        for (Object[] r : d) declarees[((Number) r[0]).intValue()] = nombre(r[1]);

        List<Object[]> o = em.createNativeQuery("""
                select cast(extract(month from date_ouverture) as integer), count(*)
                from non_conformites
                where date_ouverture is not null
                  and cast(extract(year from date_ouverture) as integer) = :annee
                group by 1
                """).setParameter("annee", annee).getResultList();
        for (Object[] r : o) prises[((Number) r[0]).intValue()] = nombre(r[1]);

        List<MoisNc> mois = new ArrayList<>();
        for (int m = 1; m <= 12; m++) mois.add(new MoisNc(m, declarees[m], prises[m]));
        return mois;
    }

    @SuppressWarnings("unchecked")
    private List<ProcessusNc> recurrenceParProcessus() {
        List<Object[]> lignes = em.createNativeQuery("""
                select p.libelle, count(n.id), coalesce(sum(n.nb_reouvertures), 0)
                from processus p
                join non_conformites n on n.processus_id = p.id
                group by p.id, p.libelle
                order by count(n.id) desc, p.libelle
                limit 8
                """).getResultList();
        return lignes.stream()
                .map(r -> new ProcessusNc((String) r[0], nombre(r[1]), nombre(r[2])))
                .toList();
    }

    // ------------------------------------------------------------------ audits
    private AvancementAudits audits() {
        Object[] l = (Object[]) em.createNativeQuery("""
                select
                    count(*),
                    count(*) filter (where statut = 'PLANIFIE'),
                    count(*) filter (where statut = 'EN_COURS'),
                    count(*) filter (where statut = 'TERMINE'),
                    count(*) filter (where statut = 'PLANIFIE' and date_planifiee < current_date)
                from audits
                """).getSingleResult();
        return new AvancementAudits(nombre(l[0]), nombre(l[1]), nombre(l[2]), nombre(l[3]), nombre(l[4]));
    }

    // ------------------------------------------------------------------ administrateur
    private BlocAdmin blocAdmin(int annee) {
        long utilisateurs = nombre(em.createNativeQuery(
                "select count(*) from users").getSingleResult());

        long total = demandeRepository.count();
        long attente = demandeRepository.countByStatut(StatutDemande.EN_ATTENTE);
        long validees = demandeRepository.countByStatut(StatutDemande.VALIDEE);
        long rejetees = demandeRepository.countByStatut(StatutDemande.REFUSEE);

        return new BlocAdmin(utilisateurs, total, attente, validees, rejetees,
                activiteParMois(annee), activiteParJour());
    }

    /** Nombre d'actions enregistrées dans l'historique, regroupées par mois. */
    private List<Activite> activiteParMois(int annee) {
        Map<Integer, Long> compteurs = new HashMap<>();
        List<Object[]> lignes = em.createNativeQuery("""
                select extract(month from date_action)::integer, count(*)
                from historique_actions
                where date_action >= make_date(:annee, 1, 1)
                  and date_action < make_date(:anneeSuivante, 1, 1)
                group by 1
                """).setParameter("annee", annee)
                .setParameter("anneeSuivante", annee + 1).getResultList();
        for (Object[] ligne : lignes) {
            compteurs.put(((Number) ligne[0]).intValue(), nombre(ligne[1]));
        }

        String[] mois = {"Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
                "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"};
        List<Activite> resultat = new ArrayList<>();
        for (int m = 1; m <= 12; m++) {
            resultat.add(new Activite(mois[m - 1], compteurs.getOrDefault(m, 0L)));
        }
        return resultat;
    }

    /** Activité quotidienne sur les 30 derniers jours, journée courante comprise. */
    private List<Activite> activiteParJour() {
        LocalDate aujourdHui = LocalDate.now();
        LocalDate debut = aujourdHui.minusDays(29);
        Map<LocalDate, Long> compteurs = new HashMap<>();

        List<Object[]> lignes = em.createNativeQuery("""
                select cast(date_action as date), count(*)
                from historique_actions
                where date_action >= :debut
                  and date_action < :fin
                group by cast(date_action as date)
                """).setParameter("debut", debut.atStartOfDay())
                .setParameter("fin", aujourdHui.plusDays(1).atStartOfDay())
                .getResultList();

        for (Object[] ligne : lignes) {
            Object valeurDate = ligne[0];
            LocalDate date = valeurDate instanceof java.sql.Date sqlDate
                    ? sqlDate.toLocalDate()
                    : (LocalDate) valeurDate;
            compteurs.put(date, nombre(ligne[1]));
        }

        DateTimeFormatter format = DateTimeFormatter.ofPattern("dd/MM");
        List<Activite> resultat = new ArrayList<>();
        for (LocalDate date = debut; !date.isAfter(aujourdHui); date = date.plusDays(1)) {
            resultat.add(new Activite(date.format(format), compteurs.getOrDefault(date, 0L)));
        }
        return resultat;
    }

    private static long nombre(Object valeur) {
        return valeur == null ? 0L : ((Number) valeur).longValue();
    }

    private static double arrondi(double valeur) {
        return Math.round(valeur * 10.0) / 10.0;
    }
}