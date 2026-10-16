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

/**
 * Authentifie la connexion STOMP avec le jeton de l'onglet, envoyé dans l'en-tête
 * « Authorization: Bearer <jwt> » de la trame CONNECT. Plus aucun jeton n'est lu dans
 * un cookie : sinon, une WebSocket ouverte dans un onglet pourrait prendre l'identité
 * d'un autre utilisateur connecté dans le même navigateur.
 */
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
                MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor == null || !StompCommand.CONNECT.equals(accessor.getCommand())) {
            return message;
        }

        String header = accessor.getFirstNativeHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ") || header.length() <= 7) {
            throw new AccessDeniedException("Jeton JWT requis pour WebSocket.");
        }
        final String jwt = header.substring(7).trim();

        try {
            Claims claims = jwtService.parseClaims(jwt);

            Users user = utilisateurRepository
                    .findByEmailIgnoreCase(claims.getSubject())
                    .filter(u -> Boolean.TRUE.equals(u.getActif()))
                    .filter(u -> jwtService.isTokenValidFor(jwt, u.getEmail()))
                    .orElseThrow(() -> new AccessDeniedException("Utilisateur invalide ou inactif."));

            // Même identité (email) que dans JwtAuthenticationFilter
            accessor.setUser(new UsernamePasswordAuthenticationToken(
                    user.getEmail(),
                    null,
                    List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole()))
            ));

        } catch (AccessDeniedException e) {
            throw e;
        } catch (RuntimeException e) {
            throw new AccessDeniedException("Jeton JWT invalide ou expiré.");
        }

        return message;
    }
}