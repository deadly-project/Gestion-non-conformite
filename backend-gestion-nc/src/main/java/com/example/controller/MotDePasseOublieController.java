package com.example.controller;

import com.example.dto.reinitialisation.MessageResponse;
import com.example.dto.reinitialisation.MotDePasseOublieRequest;
import com.example.service.ReinitialisationMotDePasseService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Endpoint PUBLIC (à déclarer permitAll dans SecurityConfig). */
@RestController
@RequestMapping("/api/auth")
public class MotDePasseOublieController {

    private final ReinitialisationMotDePasseService service;

    public MotDePasseOublieController(ReinitialisationMotDePasseService service) {
        this.service = service;
    }

    @PostMapping("/mot-de-passe-oublie")
    public MessageResponse demander(@Valid @RequestBody MotDePasseOublieRequest request) {
        service.demander(request.matricule());
        // Réponse identique que le matricule existe ou non (pas de fuite d'information)
        return new MessageResponse("Si ce matricule correspond à un compte actif, votre demande a été "
                + "transmise à l'administrateur et un email de confirmation vous a été envoyé.");
    }
}