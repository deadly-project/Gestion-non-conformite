package com.example.service;

import com.example.dto.auth.LoginRequest;
import com.example.dto.auth.LoginResponse;
import com.example.dto.utilisateur.UtilisateurResponse;
import com.example.entity.Utilisateur;
import com.example.repository.UtilisateurRepository;
import com.example.security.JwtService;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private final UtilisateurRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UtilisateurRepository repository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
        Utilisateur user = repository.findByEmailIgnoreCase(request.email().trim())
                .filter(u -> Boolean.TRUE.equals(u.getActif()))
                .filter(u -> passwordEncoder.matches(request.motDePasse(), u.getMotDePasse()))
                .orElseThrow(() -> new BadCredentialsException("Email ou mot de passe incorrect."));
        String token = jwtService.generateToken(user);
        return new LoginResponse(token, "Bearer", jwtService.getExpirationMs(), UtilisateurResponse.from(user));
    }
}
