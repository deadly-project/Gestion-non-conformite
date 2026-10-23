package com.example.service;

import com.example.dto.auth.LoginRequest;
import com.example.dto.auth.LoginResponse;
import com.example.dto.utilisateur.UtilisateurResponse;
import com.example.entity.Users;
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
    private final JournalActionsService journal;

    public AuthService(UtilisateurRepository repository, PasswordEncoder passwordEncoder,
                       JwtService jwtService, JournalActionsService journal) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.journal = journal;
    }

    @Transactional
    public LoginResponse login(LoginRequest request) {
        Users user = repository.findByMatricule(request.matricule())
                .filter(u -> Boolean.TRUE.equals(u.getActif()))
                .filter(u -> passwordEncoder.matches(request.motDePasse(), u.getMotDePasse()))
                .orElseThrow(() -> new BadCredentialsException("Matricule ou mot de passe incorrect."));
        String token = jwtService.generateToken(user);
        journal.enregistrer(user.getId(), "LOGIN", "AUTHENTIFICATION", user.getId(),
                java.util.Map.of("matricule", user.getMatricule()));
        return new LoginResponse(token, "Bearer", jwtService.getExpirationMs(), UtilisateurResponse.from(user));
    }
}
