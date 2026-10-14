
package com.example.controller;

import com.example.dto.auth.LoginRequest;
import com.example.dto.auth.LoginResponse;
import com.example.dto.utilisateur.UtilisateurResponse;
import com.example.security.AuthCookie;
import com.example.security.JwtService;
import com.example.service.AuthService;
import com.example.repository.UtilisateurRepository;

import org.springframework.security.web.csrf.CsrfToken;

import jakarta.validation.Valid;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final UtilisateurRepository utilisateurRepository;
    private final JwtService jwtService;

    public AuthController(
            AuthService authService,
            UtilisateurRepository utilisateurRepository,
            JwtService jwtService
    ) {
        this.authService = authService;
        this.utilisateurRepository = utilisateurRepository;
        this.jwtService = jwtService;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(
            @Valid @RequestBody LoginRequest request
    ) {
        LoginResponse resultat = authService.login(request);

        ResponseCookie cookie = AuthCookie.creer(
                resultat.accessToken(),
                jwtService.getExpirationMs()
        );

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(Map.of(
                        "utilisateur", resultat.utilisateur(),
                        "message", "Connexion réussie"
                ));
    }
    @GetMapping("/me")
    public ResponseEntity<UtilisateurResponse> me(
            Authentication authentication
    ) {
        return utilisateurRepository
                .findByEmailIgnoreCase(authentication.getName())
                .filter(u -> Boolean.TRUE.equals(u.getActif()))
                .map(UtilisateurResponse::from)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout() {
        return ResponseEntity.ok()
                .header(
                        HttpHeaders.SET_COOKIE,
                        AuthCookie.supprimer().toString()
                )
                .body(Map.of("message", "Déconnexion réussie"));
    }

    @GetMapping("/csrf")
    public Map<String, String> csrf(CsrfToken csrfToken) {
        return Map.of("token", csrfToken.getToken());
    }
}
