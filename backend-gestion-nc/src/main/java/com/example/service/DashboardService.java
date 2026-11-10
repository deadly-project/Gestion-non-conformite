package com.example.service;

import com.example.dto.dashboard.DashboardResponse;
import com.example.dto.dashboard.DashboardResponse.*;
import com.example.entity.enums.StatutDemande;
import com.example.repository.DemandeReinitialisationRepository;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
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

        return new DashboardResponse(
                indicateurs(),
                anneeChoisie,
                anneesDisponibles(anneeCourante),
                parMois(anneeChoisie),
                recurrenceParProcessus(),
                audits(),
                administrateur ? blocAdmin() : null);
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
    private BlocAdmin blocAdmin() {
        Object[] u = (Object[]) em.createNativeQuery(
                "select count(*), count(*) filter (where actif = true) from users").getSingleResult();
        return new BlocAdmin(nombre(u[0]), nombre(u[1]),
                demandeRepository.count(), demandeRepository.countByStatut(StatutDemande.EN_ATTENTE));
    }

    private static long nombre(Object valeur) {
        return valeur == null ? 0L : ((Number) valeur).longValue();
    }

    private static double arrondi(double valeur) {
        return Math.round(valeur * 10.0) / 10.0;
    }
}