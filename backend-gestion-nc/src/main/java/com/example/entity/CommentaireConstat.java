package com.example.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "commentaires_constats")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CommentaireConstat {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Long id;

@Column(name="constat_id", nullable=false) private Long constatId;
@Column(name="auteur_id", nullable=false) private Long auteurId;
@Column(name="commentaire", nullable=false, columnDefinition="text") private String commentaire;
@Column(name="date_commentaire", nullable=false, updatable=false) private LocalDateTime dateCommentaire;
}
