package com.example.service;

import com.example.dto.historique.HistoriqueItem;
import com.example.dto.historique.HistoriqueOptions;
import com.example.dto.nc.PageResponse;
import com.example.entity.HistoriqueAction;
import com.example.entity.Users;
import com.example.repository.HistoriqueActionRepository;
import com.example.repository.UtilisateurRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Historique des actions. Un utilisateur ne voit que ses propres actions ;
 * l'administrateur voit tout et peut filtrer par utilisateur.
 */
@Service
public class HistoriqueService {

    private final HistoriqueActionRepository repository;
    private final UtilisateurRepository utilisateurRepository;

    public HistoriqueService(HistoriqueActionRepository repository,
                             UtilisateurRepository utilisateurRepository) {
        this.repository = repository;
        this.utilisateurRepository = utilisateurRepository;
    }

    @Transactional(readOnly = true)
    public PageResponse<HistoriqueItem> lister(Users acteur, Long utilisateurIdFiltre,
                                               String actionType, String entite,
                                               LocalDate debut, LocalDate fin,
                                               int page, int taille) {
        boolean admin = "ADMINISTRATEUR".equals(acteur.getRole());
        Long utilisateurId = admin
                ? (utilisateurIdFiltre != null ? utilisateurIdFiltre : -1L)
                : acteur.getId();

        int tailleSure = Math.min(Math.max(taille, 1), 100);
        int pageSure = Math.max(page, 0);


        LocalDateTime dateDebut = debut == null
                ? LocalDateTime.of(1, 1, 1, 0, 0, 0)
                : debut.atStartOfDay();

        LocalDateTime dateFin = fin == null
                ? LocalDateTime.of(9999, 12, 31, 23, 59, 59, 999_999_999)
                : fin.plusDays(1).atStartOfDay().minusNanos(1);

        Page<HistoriqueAction> resultat = repository.rechercher(
                utilisateurId,
                nettoyer(actionType),
                nettoyer(entite),
                dateDebut,
                dateFin,
                PageRequest.of(pageSure, tailleSure)
        );


        Map<Long, Users> utilisateurs = utilisateurRepository
                .findAllById(resultat.getContent().stream()
                        .map(HistoriqueAction::getUtilisateurId)
                        .filter(java.util.Objects::nonNull)
                        .distinct().toList())
                .stream().collect(Collectors.toMap(Users::getId, Function.identity()));

        List<HistoriqueItem> contenu = resultat.getContent().stream()
                .map(h -> versItem(h, utilisateurs.get(h.getUtilisateurId())))
                .toList();

        return new PageResponse<>(contenu, resultat.getNumber(), resultat.getSize(),
                resultat.getTotalElements(), resultat.getTotalPages());
    }

    @Transactional(readOnly = true)
    public HistoriqueOptions options() {
        return new HistoriqueOptions(repository.listerTypesAction(), repository.listerEntites());
    }

    private HistoriqueItem versItem(HistoriqueAction h, Users u) {
        return new HistoriqueItem(
                h.getId(), h.getUtilisateurId(),
                u == null ? null : u.getNom(),
                u == null ? null : u.getPrenom(),
                u == null ? null : u.getMatricule(),
                u == null ? null : u.getRole(),
                h.getActionType(), h.getEntiteConcernee(), h.getEntiteId(),
                h.getDetailsModification(), h.getDateAction());
    }

    private String nettoyer(String valeur) {
        return valeur == null ? "" : valeur.trim().toUpperCase(Locale.ROOT);
    }
}