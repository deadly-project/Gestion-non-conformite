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

/**
 * Protège les canaux STOMP :
 *  - seuls les administrateurs peuvent s'abonner à /topic/admin/** ;
 *  - aucun client ne peut publier directement sur /topic/** (seul le serveur le fait).
 *
 * Suppose que JwtStompChannelInterceptor place l'Authentication (avec ses rôles) dans
 * accessor.setUser(...) lors du CONNECT. À enregistrer APRÈS lui dans WebSocketConfig.
 */
@Component
public class AdminTopicSubscriptionInterceptor implements ChannelInterceptor {

    private static final String PREFIXE_ADMIN = "/topic/admin/";

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }
        String destination = accessor.getDestination();

        if (StompCommand.SEND.equals(accessor.getCommand())
                && destination != null && destination.startsWith("/topic/")) {
            throw new AccessDeniedException("Publication interdite sur " + destination);
        }

        if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())
                && destination != null && destination.startsWith(PREFIXE_ADMIN)
                && !estAdministrateur(accessor.getUser())) {
            throw new AccessDeniedException("Abonnement réservé aux administrateurs");
        }
        return message;
    }

    private boolean estAdministrateur(Principal principal) {
        return principal instanceof Authentication auth
                && auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMINISTRATEUR".equals(a.getAuthority()));
    }
}