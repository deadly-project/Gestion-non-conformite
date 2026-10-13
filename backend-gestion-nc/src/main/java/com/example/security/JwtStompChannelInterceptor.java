package com.example.security;

import com.example.entity.Utilisateur;
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
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
            String header = accessor.getFirstNativeHeader("Authorization");
            if (header == null || !header.startsWith("Bearer ")) {
                throw new AccessDeniedException("Jeton JWT requis pour WebSocket.");
            }
            try {
                Claims claims = jwtService.parseClaims(header.substring(7));
                Utilisateur user = utilisateurRepository.findByEmailIgnoreCase(claims.getSubject())
                        .filter(u -> Boolean.TRUE.equals(u.getActif()))
                        .filter(u -> jwtService.isTokenValidFor(header.substring(7), u.getEmail()))
                        .orElseThrow(() -> new AccessDeniedException("Utilisateur invalide ou inactif."));
                accessor.setUser(new UsernamePasswordAuthenticationToken(user, null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole()))));
            } catch (AccessDeniedException e) {
                throw e;
            } catch (RuntimeException e) {
                throw new AccessDeniedException("Jeton JWT invalide ou expiré.");
            }
        }
        return message;
    }
}
