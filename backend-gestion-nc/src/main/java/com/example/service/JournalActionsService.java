package com.example.service;

import com.example.entity.HistoriqueAction;
import com.example.repository.HistoriqueActionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/** Journal des actions : toujours écrit dans la transaction de l'action journalisée. */
@Service
public class JournalActionsService {

    private final HistoriqueActionRepository repository;

    public JournalActionsService(HistoriqueActionRepository repository) {
        this.repository = repository;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void enregistrer(Long utilisateurId, String actionType, String entite,
                            Long entiteId, Map<String, Object> details) {
        HistoriqueAction h = new HistoriqueAction();
        h.setUtilisateurId(utilisateurId);
        h.setActionType(actionType);
        h.setEntiteConcernee(entite);
        h.setEntiteId(entiteId);
        h.setDetailsModification(details);
        h.setDateAction(LocalDateTime.now());
        repository.save(h);
    }

    /**
     * Journalise une modification avec l'état COMPLET de l'entité avant et après
     * (voir {@link Instantane#de(Object)}).
     * <ul>
     *   <li>création : {@code avant} = null ;</li>
     *   <li>suppression : {@code apres} = null ;</li>
     *   <li>{@code contexte} : informations complémentaires qui ne sont pas des champs de l'entité (facultatif).</li>
     * </ul>
     * Format stocké : {"avant": {...}, "apres": {...}, "contexte": {...}}.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void enregistrerModification(Long utilisateurId, String actionType, String entite, Long entiteId,
                                        Map<String, Object> avant, Map<String, Object> apres,
                                        Map<String, Object> contexte) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("avant", avant);
        details.put("apres", apres);
        if (contexte != null && !contexte.isEmpty()) {
            details.put("contexte", contexte);
        }
        enregistrer(utilisateurId, actionType, entite, entiteId, details);
    }
}