package com.example.service;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Temps réel du suivi des CAPA : chaque action de l'auditeur ou du responsable qualité
 * est diffusée sur /topic/admin/capa, une fois la transaction validée.
 * Le responsable qualité filtre sur ncId et recharge le suivi.
 */
@Service
public class CapaEvenementService {

    public static final String TOPIC = "/topic/admin/capa";

    private final SimpMessagingTemplate messagingTemplate;

    public CapaEvenementService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    /** etapeId et auditId peuvent être null (ex. clôture de la NC). */
    public void publier(Long ncId, Long etapeId, Long auditId, String type, String message) {
        if (ncId == null) return;     // audit sans étape CAPA : rien à suivre côté qualité

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", type);
        payload.put("ncId", ncId);
        if (etapeId != null) payload.put("etapeId", etapeId);
        if (auditId != null) payload.put("auditId", auditId);
        payload.put("message", message);
        payload.put("date", LocalDateTime.now().toString());

        Runnable envoi = () -> messagingTemplate.convertAndSend(TOPIC, (Object) payload);

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    envoi.run();
                }
            });
        } else {
            envoi.run();
        }
    }
}