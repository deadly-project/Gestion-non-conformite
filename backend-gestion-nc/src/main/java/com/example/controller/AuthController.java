package com.example.controller;

import com.example.dto.auth.LoginRequest;
import com.example.dto.auth.LoginResponse;
import com.example.dto.utilisateur.UtilisateurResponse;
import com.example.repository.UtilisateurRepository;
import com.example.service.AuthService;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final UtilisateurRepository utilisateurRepository;

    public AuthController(
            AuthService authService,
            UtilisateurRepository utilisateurRepository
    ) {
        this.authService = authService;
        this.utilisateurRepository = utilisateurRepository;
    }

    /**
     * Le jeton est renvoyé dans le corps de la réponse : le front le garde dans le
     * sessionStorage de l'onglet (donc propre à cet onglet) et l'envoie ensuite
     * dans l'en-tête Authorization.
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(
            @Valid @RequestBody LoginRequest request
    ) {
        LoginResponse resultat = authService.login(request);

        return ResponseEntity.ok(Map.of(
                "utilisateur", resultat.utilisateur(),
                "accessToken", resultat.accessToken(),
                "tokenType", resultat.tokenType(),
                "expiresIn", resultat.expiresIn(),
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

    /**
     * L'API est sans état : la déconnexion consiste à supprimer le jeton côté onglet.
     * L'endpoint est conservé pour que le front garde le même appel.
     */
    @PostMapping("/logout")
    public ResponseEntity<?> logout() {
        return ResponseEntity.ok(Map.of("message", "Déconnexion réussie"));
    }
}