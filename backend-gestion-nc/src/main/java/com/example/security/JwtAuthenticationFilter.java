package com.example.security;

import com.example.entity.Users;
import com.example.repository.UtilisateurRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Authentifie chaque requête à partir de l'en-tête « Authorization: Bearer <jwt> ».
 *
 * Le jeton est propre à chaque onglet du navigateur (sessionStorage côté React) :
 * c'est ce qui permet d'avoir plusieurs utilisateurs connectés en même temps dans
 * le même navigateur. Aucun cookie d'authentification n'est lu.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String PREFIXE_BEARER = "Bearer ";

    private final JwtService jwtService;
    private final UtilisateurRepository utilisateurRepository;

    public JwtAuthenticationFilter(
            JwtService jwtService,
            UtilisateurRepository utilisateurRepository
    ) {
        this.jwtService = jwtService;
        this.utilisateurRepository = utilisateurRepository;
    }

    private String extraireToken(HttpServletRequest request) {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);

        if (header == null || !header.startsWith(PREFIXE_BEARER)) {
            return null;
        }

        return header.substring(PREFIXE_BEARER.length()).trim();
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        // Ne pas remplacer une authentification déjà établie.
        if (SecurityContextHolder.getContext().getAuthentication() != null) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = extraireToken(request);

        // Sans jeton, on laisse Spring Security décider si la route est publique.
        if (token == null || token.isBlank()) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            String email = jwtService.parseClaims(token).getSubject();

            if (email != null && !email.isBlank()) {
                Users user = utilisateurRepository
                        .findByEmailIgnoreCase(email)
                        .orElse(null);

                if (user != null
                        && Boolean.TRUE.equals(user.getActif())
                        && jwtService.isTokenValidFor(token, user.getEmail())) {

                    var authentication = new UsernamePasswordAuthenticationToken(
                            user.getEmail(),
                            null,
                            List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole()))
                    );
                    SecurityContextHolder.getContext()
                            .setAuthentication(authentication);
                }
            }

        } catch (RuntimeException exception) {
            // Jeton invalide ou expiré : la route protégée sera refusée (401).
            SecurityContextHolder.clearContext();
        }

        filterChain.doFilter(request, response);
    }
}