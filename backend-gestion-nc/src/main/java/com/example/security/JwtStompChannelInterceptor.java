package com.example.security;

import com.example.entity.Users;
import com.example.repository.UtilisateurRepository;
import io.jsonwebtoken.Claims;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
public class JwtStompChannelInterceptor implements ChannelInterceptor {
    private final JwtService jwtService;
    private final UtilisateurRepository utilisateurRepository;

    public JwtStompChannelInterceptor(JwtService jwtService, UtilisateurRepository utilisateurRepository) {
        this.jwtService = jwtService;
        this.utilisateurRepository = utilisateurRepository;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(
                        message, StompHeaderAccessor.class
                );

        if (accessor == null) {
            return message;
        }

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            String token = null;

            // 1. Privilégier un Bearer token si le client en fournit un.
            String header = accessor.getFirstNativeHeader("Authorization");

            if (header != null && header.startsWith("Bearer ")) {
                token = header.substring(7);
            }

            // 2. Sinon, récupérer le JWT issu du handshake HTTP.
            if (token == null || token.isBlank()) {
                Map<String, Object> attributes = accessor.getSessionAttributes();

                if (attributes != null) {
                    Object valeur = attributes.get("SMQ_JWT");

                    if (valeur instanceof String jwt && !jwt.isBlank()) {
                        token = jwt;
                    }
                }
            }

            if (token == null || token.isBlank()) {
                throw new AccessDeniedException(
                        "Jeton JWT requis pour WebSocket."
                );
            }

            try {
                final String jwt = token;
                Claims claims = jwtService.parseClaims(jwt);

                Users user = utilisateurRepository
                        .findByEmailIgnoreCase(claims.getSubject())
                        .filter(u -> Boolean.TRUE.equals(u.getActif()))
                        .filter(u -> jwtService.isTokenValidFor(
                                jwt, u.getEmail()
                        ))
                        .orElseThrow(() -> new AccessDeniedException(
                                "Utilisateur invalide ou inactif."
                        ));

                accessor.setUser(
                        new UsernamePasswordAuthenticationToken(
                                user,
                                null,
                                List.of(new SimpleGrantedAuthority(
                                        "ROLE_" + user.getRole()
                                ))
                        )
                );

            } catch (AccessDeniedException e) {
                throw e;
            } catch (RuntimeException e) {
                throw new AccessDeniedException(
                        "Jeton JWT invalide ou expiré."
                );
            }
        }

        return message;
    }
}
