package com.example.service;

import com.example.dto.nc.PageResponse;
import com.example.dto.notification.NotificationDto;
import com.example.entity.NonConformite;
import com.example.entity.Notification;
import com.example.entity.Users;
import com.example.repository.NotificationRepository;
import com.example.repository.UtilisateurRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Notifications personnelles : enregistrées en base (cloche de la navigation) puis poussées en temps
 * réel sur la file privée /user/queue/notifications de chaque destinataire.
 *
 * Tout se passe APRÈS le commit de l'action métier, dans une transaction distincte :
 *  - on ne notifie jamais une action finalement annulée ;
 *  - un échec de notification ne peut jamais faire échouer l'action elle-même (il est seulement journalisé).
 */
@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    /** Destination côté serveur ; le client s'abonne à « /user/queue/notifications ». */
    public static final String QUEUE = "/queue/notifications";

    public static final String ENTITE_NC = "NON_CONFORMITE";
    public static final String ENTITE_AUDIT = "AUDIT";
    public static final String ENTITE_UTILISATEUR = "UTILISATEUR";
    public static final String ENTITE_REINITIALISATION = "REINITIALISATION";

    private static final int TAILLE_MAX_PAGE = 50;

    private record Brouillon(Long userId, String type, String message, String entite, Long entiteId) {}

    private record Envoi(String email, NotificationDto notification) {}

    private final NotificationRepository repository;
    private final UtilisateurRepository utilisateurRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final TransactionTemplate transactionIndependante;

    public NotificationService(NotificationRepository repository,
                               UtilisateurRepository utilisateurRepository,
                               SimpMessagingTemplate messagingTemplate,
                               PlatformTransactionManager transactionManager) {
        this.repository = repository;
        this.utilisateurRepository = utilisateurRepository;
        this.messagingTemplate = messagingTemplate;
        this.transactionIndependante = new TransactionTemplate(transactionManager);
        this.transactionIndependante.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    // ------------------------------------------------------------------ émission
    public void notifier(Long userId, String type, String message, String entite, Long entiteId) {
        if (userId == null) return;
        notifierPlusieurs(List.of(userId), type, message, entite, entiteId);
    }

    public void notifierPlusieurs(Collection<Long> userIds, String type, String message,
                                  String entite, Long entiteId) {
        if (userIds == null) return;
        List<Brouillon> lot = userIds.stream()
                .filter(Objects::nonNull)
                .distinct()
                .map(id -> new Brouillon(id, type, message, entite, entiteId))
                .toList();
        if (lot.isEmpty()) return;
        apresCommit(() -> persisterEtPousser(lot));
    }

    /** Tous les comptes actifs d'un rôle, sauf éventuellement l'auteur de l'action (exclureId peut être null). */
    public void notifierRole(String role, Long exclureId, String type, String message,
                             String entite, Long entiteId) {
        Set<Long> destinataires = new LinkedHashSet<>(utilisateurRepository.idsActifsParRole(role));
        if (exclureId != null) destinataires.remove(exclureId);
        notifierPlusieurs(destinataires, type, message, entite, entiteId);
    }

    /**
     * Le responsable qualité en charge de la non-conformité ; à défaut (aucun responsable désigné
     * ou compte désactivé), tous les responsables qualité.
     */
    public void notifierResponsablesNc(NonConformite nc, String type, String message) {
        Set<Long> destinataires = new LinkedHashSet<>();
        if (nc.getResponsableId() != null) {
            utilisateurRepository.findById(nc.getResponsableId())
                    .filter(u -> Boolean.TRUE.equals(u.getActif()) && "RESPONSABLE_QUALITE".equals(u.getRole()))
                    .ifPresent(u -> destinataires.add(u.getId()));
        }
        if (destinataires.isEmpty()) {
            destinataires.addAll(utilisateurRepository.idsActifsParRole("RESPONSABLE_QUALITE"));
        }
        notifierPlusieurs(destinataires, type, message, ENTITE_NC, nc.getId());
    }

    private void apresCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }

    private void persisterEtPousser(List<Brouillon> lot) {
        try {
            List<Envoi> envois = transactionIndependante.execute(status -> {
                Map<Long, String> emails = utilisateurRepository
                        .findAllById(lot.stream().map(Brouillon::userId).toList())
                        .stream().collect(Collectors.toMap(Users::getId, Users::getEmail, (a, b) -> a));

                List<Envoi> resultat = new ArrayList<>();
                for (Brouillon b : lot) {
                    Notification n = new Notification();
                    n.setUserId(b.userId());
                    n.setType(b.type());
                    n.setMessage(b.message());
                    n.setEntite(b.entite());
                    n.setEntiteId(b.entiteId());
                    n.setLue(false);
                    n.setDateCreation(java.time.LocalDateTime.now());   // colonne NOT NULL : ne pas dépendre du @PrePersist
                    n = repository.saveAndFlush(n);
                    resultat.add(new Envoi(emails.get(b.userId()), NotificationDto.from(n)));
                }
                return resultat;
            });

            if (envois == null) return;
            for (Envoi envoi : envois) {
                if (envoi.email() == null) continue;
                try {
                    // L'identité STOMP est l'email (JwtStompChannelInterceptor) : la file est privée.
                    messagingTemplate.convertAndSendToUser(envoi.email(), QUEUE, envoi.notification());
                } catch (Exception e) {
                    log.warn("Notification {} enregistrée mais non poussée en temps réel : {}",
                            envoi.notification().id(), e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("Notification « {} » non enregistrée : {}", lot.get(0).type(), e.getMessage(), e);
        }
    }

    // ------------------------------------------------------------------ lecture (API REST)
    @Transactional(readOnly = true)
    public PageResponse<NotificationDto> lister(Long userId, int page, int taille) {
        int tailleSure = Math.min(Math.max(taille, 1), TAILLE_MAX_PAGE);
        Page<Notification> resultat = repository.findByUserIdOrderByDateCreationDescIdDesc(
                userId, PageRequest.of(Math.max(page, 0), tailleSure));
        return new PageResponse<>(
                resultat.getContent().stream().map(NotificationDto::from).toList(),
                resultat.getNumber(), resultat.getSize(),
                resultat.getTotalElements(), resultat.getTotalPages());
    }

    @Transactional(readOnly = true)
    public long nombreNonLues(Long userId) {
        return repository.countByUserIdAndLueFalse(userId);
    }

    /** Ne touche que les notifications de l'utilisateur connecté : l'identifiant seul ne suffit pas. */
    @Transactional
    public void marquerLue(Long id, Long userId) {
        repository.marquerLue(id, userId);
    }

    @Transactional
    public void marquerToutesLues(Long userId) {
        repository.marquerToutesLues(userId);
    }

    /** Vrai si cette alerte a déjà été envoyée à ce destinataire depuis la date donnée. */
    @Transactional(readOnly = true)
    public boolean dejaEnvoyee(Long userId, String type, Long entiteId, java.time.LocalDateTime depuis) {
        return repository.existsByUserIdAndTypeAndEntiteIdAndDateCreationAfter(userId, type, entiteId, depuis);
    }

    // ------------------------------------------------------------------ libellés partagés
    public static String libelleStatut(String statut) {
        if (statut == null) return "";
        return switch (statut) {
            case "EN_ATTENTE" -> "En attente";
            case "OUVERT" -> "Ouvert";
            case "EN_COURS_D_ANALYSE" -> "En cours d'analyse";
            case "EN_TRAITEMENT" -> "En traitement";
            case "CLOTUREE" -> "Clôturée";
            default -> statut;
        };
    }

    public static String nom(Users u) {
        return u == null ? "" : u.getPrenom() + " " + u.getNom();
    }

    /** « NC-2026-0001 » ou, à défaut de référence, le titre. */
    public static String designation(NonConformite nc) {
        if (nc.getReference() != null && !nc.getReference().isBlank()) return nc.getReference();
        return "« " + nc.getTitre() + " »";
    }

    public static String extrait(String texte, int max) {
        if (texte == null) return "";
        String propre = texte.strip().replaceAll("\\s+", " ");
        return propre.length() <= max ? propre : propre.substring(0, max - 1) + "…";
    }
}
