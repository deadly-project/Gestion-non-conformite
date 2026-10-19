package com.example.controller;

import com.example.dto.nc.ReferentielItem;
import com.example.repository.CategorieNcRepository;
import com.example.repository.ProcessusRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

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

    /** « Service concerné » du formulaire de déclaration. */
    @GetMapping("/processus")
    public List<ReferentielItem> processus() {
        return processusRepository.findByActifTrueOrderByLibelleAsc().stream()
                .map(p -> new ReferentielItem(p.getId(), p.getCode(), p.getLibelle()))
                .toList();
    }

    /** « Nature » de la non-conformité (produit, processus, système...). */
    @GetMapping("/categories")
    public List<ReferentielItem> categories() {
        return categorieRepository.findByActifTrueOrderByLibelleAsc().stream()
                .map(c -> new ReferentielItem(c.getId(), c.getCode(), c.getLibelle()))
                .toList();
    }
}
