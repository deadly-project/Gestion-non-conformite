package com.example.dto.notification;

import com.example.entity.Notification;

/**
 * Notification telle que lue par React, en REST comme en WebSocket.
 * La date est un texte ISO (même convention que NotificationTempsReel).
 */
public record NotificationDto(
        Long id,
        String type,
        String message,
        String entite,
        Long entiteId,
        boolean lue,
        String dateCreation
) {
    public static NotificationDto from(Notification n) {
        return new NotificationDto(
                n.getId(), n.getType(), n.getMessage(), n.getEntite(), n.getEntiteId(),
                Boolean.TRUE.equals(n.getLue()),
                n.getDateCreation() == null ? null : n.getDateCreation().toString());
    }
}
