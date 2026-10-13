package com.example.controller;

import com.example.dto.auth.LoginRequest;
import com.example.dto.auth.LoginResponse;
import com.example.dto.utilisateur.UtilisateurResponse;
import com.example.entity.Utilisateur;
import com.example.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;
    public AuthController(AuthService authService) { this.authService = authService; }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @GetMapping("/me")
    public ResponseEntity<UtilisateurResponse> me(@AuthenticationPrincipal Utilisateur user) {
        return ResponseEntity.ok(UtilisateurResponse.from(user));
    }
}
