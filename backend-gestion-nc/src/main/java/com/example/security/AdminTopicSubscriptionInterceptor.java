package com.example.security;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.Set;

/**
 * Contrôle des abonnements et des publications STOMP.
 *
 *  - /topic/admin/**           : canaux de suivi (administrateur, et responsable qualité pour nc / capa) ;
 *  - /user/queue/notifications : file PRIVÉE des notifications, ouverte à tous les rôles connectés
 *                                (administrateur, responsable qualité, auditeur, déclarant) ;
 *  - /queue/** direct          : refusé, seul le chemin /user/queue/... (résolu par Spring pour
 *                                l'utilisateur authentifié) donne accès aux messages d'un utilisateur ;
 *  - SEND vers /topic, /queue ou /user : refusé, seul le serveur publie (sinon un client pourrait
 *                                fabriquer de fausses notifications pour un autre utilisateur).
 */
@Component
public class AdminTopicSubscriptionInterceptor implements ChannelInterceptor {

    private static final String PREFIXE_ADMIN = "/topic/admin/";
    private static final String TOPIC_REINITIALISATIONS =
            "/topic/admin/reinitialisations";
    private static final String TOPIC_NC = "/topic/admin/nc";
    /** Suivi terrain des CAPA : actions des auditeurs et du responsable qualité (CapaEvenementService). */
    private static final String TOPIC_CAPA = "/topic/admin/capa";

    /** Canaux que le responsable qualité peut écouter, en plus de l'administrateur qui les peut tous. */
    private static final Set<String> TOPICS_RESPONSABLE = Set.of(TOPIC_NC, TOPIC_CAPA);

    /** Notifications personnelles en temps réel (NotificationService). */
    private static final String QUEUE_NOTIFICATIONS = "/user/queue/notifications";

    /** Rôles autorisés à s'abonner à leurs notifications : tous, auditeur compris. */
    private static final Set<String> ROLES_NOTIFICATIONS = Set.of(
            "ROLE_ADMINISTRATEUR", "ROLE_RESPONSABLE_QUALITE", "ROLE_AUDITEUR", "ROLE_DECLARANT");

    @Override
    public Message<?> preSend(
            Message<?> message,
            MessageChannel channel
    ) {
        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(
                        message,
                        StompHeaderAccessor.class
                );

        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }

        String destination = accessor.getDestination();

        // Empêche les clients de publier directement sur les canaux du serveur.
        if (StompCommand.SEND.equals(accessor.getCommand())
                && destination != null
                && (destination.startsWith("/topic/")
                || destination.startsWith("/queue/")
                || destination.startsWith("/user/"))) {
            throw new AccessDeniedException(
                    "Publication interdite sur " + destination
            );
        }

        if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())
                && destination != null) {

            Principal principal = accessor.getUser();

            // Notifications personnelles : tout rôle connecté, y compris l'auditeur.
            if (QUEUE_NOTIFICATIONS.equals(destination)) {
                if (possedeUnDesRoles(principal, ROLES_NOTIFICATIONS)) {
                    return message;
                }
                throw new AccessDeniedException(
                        "Abonnement interdit sur " + destination
                );
            }

            // Une file brute (/queue/...) ne passe pas par la résolution « par utilisateur » :
            // l'accepter permettrait d'écouter les notifications d'un autre compte.
            if (destination.startsWith("/queue/") || destination.startsWith("/user/")) {
                throw new AccessDeniedException(
                        "Abonnement interdit sur " + destination
                );
            }

            if (destination.startsWith(PREFIXE_ADMIN)) {
                // Les administrateurs conservent leurs accès.
                if (estAdministrateur(principal)) {
                    return message;
                }

                // Le responsable qualité peut suivre les non-conformités et leurs CAPA,
                // mais pas consulter les demandes de réinitialisation.
                if (TOPICS_RESPONSABLE.contains(destination)
                        && estResponsable(principal)) {
                    return message;
                }

                throw new AccessDeniedException(
                        "Abonnement interdit sur " + destination
                );
            }
        }

        return message;
    }

    private boolean estAdministrateur(Principal principal) {
        return possedeRole(principal, "ROLE_ADMINISTRATEUR");
    }

    private boolean estResponsable(Principal principal) {
        return possedeRole(principal, "ROLE_RESPONSABLE_QUALITE");
    }

    private boolean possedeRole(Principal principal, String role) {
        return possedeUnDesRoles(principal, Set.of(role));
    }

    private boolean possedeUnDesRoles(Principal principal, Set<String> roles) {
        return principal instanceof Authentication auth
                && auth.getAuthorities().stream()
                .anyMatch(a -> roles.contains(a.getAuthority()));
    }
}