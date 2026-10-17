package com.example.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "nc_statut_historique")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class NcStatutHistorique {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Long id;

@Column(name="nc_id", nullable=false) private Long ncId;
@Column(name="ancien_statut", length=20) private String ancienStatut;
@Column(name="nouveau_statut", nullable=false, length=20) private String nouveauStatut;
@Column(name="commentaire", columnDefinition="text") private String commentaire;
@Column(name="auteur_id") private Long auteurId;
@Column(name="date_changement", nullable=false, updatable=false) private LocalDateTime dateChangement;
}
