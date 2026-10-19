
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

@Component
public class AdminTopicSubscriptionInterceptor implements ChannelInterceptor {

    private static final String PREFIXE_ADMIN = "/topic/admin/";
    private static final String TOPIC_REINITIALISATIONS =
            "/topic/admin/reinitialisations";
    private static final String TOPIC_NC = "/topic/admin/nc";

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

        // Empêche les clients de publier directement sur les topics.
        if (StompCommand.SEND.equals(accessor.getCommand())
                && destination != null
                && destination.startsWith("/topic/")) {
            throw new AccessDeniedException(
                    "Publication interdite sur " + destination
            );
        }

        if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())
                && destination != null
                && destination.startsWith(PREFIXE_ADMIN)) {

            Principal principal = accessor.getUser();

            // Les administrateurs conservent leurs accès.
            if (estAdministrateur(principal)) {
                return message;
            }

            // Le responsable qualité peut suivre les non-conformités,
            // mais pas consulter les demandes de réinitialisation.
            if (TOPIC_NC.equals(destination)
                    && estResponsable(principal)) {
                return message;
            }

            throw new AccessDeniedException(
                    "Abonnement interdit sur " + destination
            );
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
        return principal instanceof Authentication auth
                && auth.getAuthorities().stream()
                .anyMatch(a -> role.equals(a.getAuthority()));
    }
}
