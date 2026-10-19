package com.example.controller;

import com.example.dto.nc.ReferentielItem;
import com.example.repository.CategorieNcRepository;
import com.example.repository.ProcessusRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** Listes de paramétrage (gérées par l'administrateur), lisibles par tout utilisateur connecté. */
@RestController
@RequestMapping("/api/referentiels")
@PreAuthorize("isAuthenticated()")
public class ReferentielController {

    private final ProcessusRepository processusRepository;
    private final CategorieNcRepository categorieRepository;

    public ReferentielController(ProcessusRepository processusRepository,
                                 CategorieNcRepository categorieRepository) {
        this.processusRepository = processusRepository;
        this.categorieRepository = categorieRepository;
    }

    /** « Service concerné » du formulaire de déclaration (avec description). */
    @GetMapping("/processus")
    public List<Map<String, Object>> processus() {
        return processusRepository.findByActifTrueOrderByLibelleAsc().stream()
                .map(p -> Map.of(
                        "id", (Object) p.getId(),
                        "code", p.getCode(),
                        "libelle", p.getLibelle(),
                        "description", p.getDescription() != null ? p.getDescription() : ""
                ))
                .toList();
    }

    /** « Nature » de la non-conformité. */
    @GetMapping("/categories")
    public List<ReferentielItem> categories() {
        return categorieRepository.findByActifTrueOrderByLibelleAsc().stream()
                .map(c -> new ReferentielItem(c.getId(), c.getCode(), c.getLibelle()))
                .toList();
    }
}