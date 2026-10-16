package com.example.config;

import com.example.security.JwtAuthenticationFilter;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import org.springframework.http.HttpStatus;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            JwtAuthenticationFilter jwtFilter
    ) throws Exception {

        return http
                // L'authentification passe par l'en-tête Authorization (jamais par un cookie) :
                // le navigateur n'envoie rien automatiquement, donc il n'y a pas d'attaque CSRF.
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )
                .authorizeHttpRequests(auth -> auth

                        // Routes publiques
                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/auth/login",
                                "/api/auth/logout",
                                "/api/auth/mot-de-passe-oublie"
                        ).permitAll()

                        .requestMatchers("/error").permitAll()

                        // Le handshake WebSocket est public.
                        // L'authentification STOMP est vérifiée séparément (JwtStompChannelInterceptor).
                        .requestMatchers("/ws", "/ws/**").permitAll()

                        // Profil utilisateur
                        .requestMatchers("/api/auth/me").authenticated()

                        // Administration
                        .requestMatchers("/api/admin/**")
                        .hasRole("ADMINISTRATEUR")

                        .requestMatchers("/api/utilisateurs/**")
                        .hasRole("ADMINISTRATEUR")

                        // Non-conformités
                        .requestMatchers("/api/non-conformites/**")
                        .hasAnyRole(
                                "DECLARANT",
                                "RESPONSABLE_QUALITE",
                                "ADMINISTRATEUR"
                        )

                        // Audits
                        .requestMatchers("/api/audits/**")
                        .hasAnyRole(
                                "AUDITEUR",
                                "RESPONSABLE_QUALITE",
                                "ADMINISTRATEUR"
                        )

                        // Actions correctives et préventives
                        .requestMatchers("/api/capa/**")
                        .hasAnyRole(
                                "RESPONSABLE_QUALITE",
                                "ADMINISTRATEUR"
                        )

                        // Toutes les autres routes nécessitent une connexion.
                        .anyRequest().authenticated()
                )
                .exceptionHandling(exception -> exception
                        .authenticationEntryPoint(
                                new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)
                        )
                )
                .httpBasic(basic -> basic.disable())
                .formLogin(form -> form.disable())
                .addFilterBefore(
                        jwtFilter,
                        UsernamePasswordAuthenticationFilter.class
                )
                .build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${app.frontend-urls:http://localhost:5173}")
            String frontendUrls
    ) {
        List<String> origins = Arrays.stream(frontendUrls.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isBlank())
                .toList();

        CorsConfiguration config = new CorsConfiguration();

        config.setAllowedOrigins(origins);
        config.setAllowedMethods(List.of(
                "GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"
        ));
        config.setAllowedHeaders(List.of(
                "Content-Type",
                "Accept",
                "Authorization"
        ));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source =
                new UrlBasedCorsConfigurationSource();

        source.registerCorsConfiguration("/**", config);

        return source;
    }
}