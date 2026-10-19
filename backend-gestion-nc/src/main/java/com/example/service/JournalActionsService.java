package com.example.service;

import com.example.entity.HistoriqueAction;
import com.example.repository.HistoriqueActionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
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
}
