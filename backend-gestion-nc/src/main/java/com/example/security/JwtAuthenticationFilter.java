
package com.example.security;

import com.example.entity.Users;
import com.example.repository.UtilisateurRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

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
        Cookie[] cookies = request.getCookies();

        if (cookies == null) {
            return null;
        }

        for (Cookie cookie : cookies) {
            if (AuthCookie.TOKEN_COOKIE.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }

        return null;
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

        // Sans cookie, on laisse Spring Security décider si la route est publique.
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
            // Token invalide ou expiré :
            // la route protégée sera refusée par Spring Security.
            SecurityContextHolder.clearContext();
        }

        filterChain.doFilter(request, response);
    }
}
