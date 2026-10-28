package com.example.service;

import com.example.domain.TypeNotification;
import com.example.entity.NonConformite;
import com.example.repository.NonConformiteRepository;
import com.example.repository.UtilisateurRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Alertes envoyées aux responsables qualité :
 *  - non-conformité NON clôturée dont la date d'échéance est dépassée ;
 *  - non-conformité déclarée mais qui n'a encore fait l'objet d'AUCUN traitement
 *    (toujours « En attente » depuis plus de N jours).
 *
 * Exécution au démarrage de l'application puis chaque jour. Une même alerte n'est renvoyée
 * au même responsable qu'une fois tous les RAPPEL_JOURS jours tant que la situation dure.
 */
@Service
public class RappelsNcService {

    private static final Logger log = LoggerFactory.getLogger(RappelsNcService.class);
    private static final String ROLE_RQ = "RESPONSABLE_QUALITE";
    private static final int RAPPEL_JOURS = 7;
    private static final DateTimeFormatter FORMAT_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final NonConformiteRepository ncRepository;
    private final UtilisateurRepository utilisateurRepository;
    private final NotificationService notifications;
    private final int delaiSansTraitementJours;

    public RappelsNcService(NonConformiteRepository ncRepository,
                            UtilisateurRepository utilisateurRepository,
                            NotificationService notifications,
                            @Value("${app.notifications.delai-sans-traitement-jours:2}") int delaiSansTraitementJours) {
        this.ncRepository = ncRepository;
        this.utilisateurRepository = utilisateurRepository;
        this.notifications = notifications;
        this.delaiSansTraitementJours = Math.max(delaiSansTraitementJours, 0);
    }

    @EventListener(ApplicationReadyEvent.class)
    public void auDemarrage() {
        verifier();
    }

    @Scheduled(cron = "${app.notifications.cron-rappels:0 0 8 * * *}")
    public void chaqueJour() {
        verifier();
    }

    /** Pas de transaction englobante : chaque lecture est autonome et les envois se font à la suite. */
    public void verifier() {
        try {
            List<Long> responsables = utilisateurRepository.idsActifsParRole(ROLE_RQ);
            if (responsables.isEmpty()) return;

            LocalDateTime maintenant = LocalDateTime.now();
            LocalDateTime depuis = maintenant.minusDays(RAPPEL_JOURS);

            for (NonConformite nc : ncRepository.findEcheanceDepassee(LocalDate.now())) {
                long retard = ChronoUnit.DAYS.between(nc.getDateEcheance(), LocalDate.now());
                String message = "Échéance dépassée : la non-conformité " + NotificationService.designation(nc)
                        + " devait être traitée avant le " + nc.getDateEcheance().format(FORMAT_DATE)
                        + " (" + retard + " jour" + (retard > 1 ? "s" : "") + " de retard).";
                envoyerUneFois(responsables, nc, TypeNotification.NC_ECHEANCE_DEPASSEE, message, depuis);
            }

            LocalDateTime limite = maintenant.minusDays(delaiSansTraitementJours);
            for (NonConformite nc : ncRepository.findSansTraitementDepuis(limite)) {
                long jours = ChronoUnit.DAYS.between(nc.getDateCreation().toLocalDate(), LocalDate.now());
                String message = "Aucun traitement : la non-conformité « " + nc.getTitre()
                        + " » est en attente depuis " + jours + " jour" + (jours > 1 ? "s" : "") + ".";
                envoyerUneFois(responsables, nc, TypeNotification.NC_SANS_TRAITEMENT, message, depuis);
            }
        } catch (Exception e) {
            // Un rappel raté ne doit jamais empêcher le démarrage ni les exécutions suivantes.
            log.error("Vérification des échéances impossible : {}", e.getMessage(), e);
        }
    }

    private void envoyerUneFois(List<Long> responsables, NonConformite nc, String type,
                                String message, LocalDateTime depuis) {
        List<Long> aPrevenir = responsables.stream()
                .filter(id -> !notifications.dejaEnvoyee(id, type, nc.getId(), depuis))
                .toList();
        notifications.notifierPlusieurs(aPrevenir, type, message, NotificationService.ENTITE_NC, nc.getId());
    }
}
