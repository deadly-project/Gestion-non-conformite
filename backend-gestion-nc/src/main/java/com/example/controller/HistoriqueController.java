package com.example.controller;

import com.example.dto.historique.HistoriqueItem;
import com.example.dto.historique.HistoriqueOptions;
import com.example.dto.nc.PageResponse;
import com.example.entity.Users;
import com.example.repository.UtilisateurRepository;
import com.example.service.HistoriqueService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;

/** Historique : chaque utilisateur voit ses actions, l'administrateur voit tout. */
@RestController
@RequestMapping("/api/historique")
public class HistoriqueController {

    private final HistoriqueService service;
    private final UtilisateurRepository utilisateurRepository;

    public HistoriqueController(HistoriqueService service, UtilisateurRepository utilisateurRepository) {
        this.service = service;
        this.utilisateurRepository = utilisateurRepository;
    }

    @GetMapping
    public PageResponse<HistoriqueItem> lister(
            @RequestParam(required = false) Long utilisateurId,
            @RequestParam(defaultValue = "") String actionType,
            @RequestParam(defaultValue = "") String entite,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate debut,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fin,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int taille,
            Authentication authentication) {
        return service.lister(utilisateurCourant(authentication), utilisateurId,
                actionType, entite, debut, fin, page, taille);
    }

    @GetMapping("/options")
    public HistoriqueOptions options() {
        return service.options();
    }

    private Users utilisateurCourant(Authentication authentication) {
        return utilisateurRepository.findByEmailIgnoreCase(authentication.getName())
                .filter(u -> Boolean.TRUE.equals(u.getActif()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session invalide"));
    }
}