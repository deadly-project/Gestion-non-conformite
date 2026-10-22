package com.example.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/** Commentaire du responsable qualité sur un constat (table commentaires_constats). */
@Entity
@Table(name = "commentaires_constats")
@Getter @Setter @NoArgsConstructor
public class CommentaireConstat {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Long id;

    @Column(name = "constat_id", nullable = false) private Long constatId;
    @Column(name = "auteur_id", nullable = false) private Long auteurId;
    @Column(name = "commentaire", nullable = false, columnDefinition = "text") private String commentaire;
    @Column(name = "date_commentaire", nullable = false, updatable = false) private LocalDateTime dateCommentaire;

    @PrePersist
    void avantCreation() {
        if (dateCommentaire == null) dateCommentaire = LocalDateTime.now();
    }
}