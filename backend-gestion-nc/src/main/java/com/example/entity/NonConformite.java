package com.example.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "non_conformites")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class NonConformite {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

@Column(name="reference", nullable=false, unique=true, length=20) private String reference;
@Column(name="titre", nullable=false, length=200) private String titre;
@Column(name="date_detection", nullable=false) private LocalDate dateDetection;
@Column(name="declarant_id", nullable=false) private UUID declarantId;
@Column(name="processus_id", nullable=false) private UUID processusId;
@Column(name="categorie_id") private UUID categorieId;
@Column(name="description_detaillee", nullable=false, columnDefinition="text") private String descriptionDetaillee;
@Column(name="gravite_declaree", nullable=false, length=10) private String graviteDeclaree;
@Column(name="gravite", length=10) private String gravite;
@Column(name="statut", nullable=false, length=20) private String statut = "EN_ATTENTE";
@Column(name="responsable_id") private UUID responsableId;
@Column(name="auditeur_id") private UUID auditeurId;
@Column(name="constat_origine_id") private UUID constatOrigineId;
@Column(name="delais_jours") private Integer delaisJours;
@Column(name="date_echeance") private LocalDate dateEcheance;
@Column(name="date_ouverture") private LocalDateTime dateOuverture;
@Column(name="date_commencement_traitement") private LocalDateTime dateCommencementTraitement;
@Column(name="date_cloturation") private LocalDateTime dateCloturation;
@Column(name="nb_reouvertures", nullable=false) private Integer nbReouvertures = 0;
@Column(name="date_creation", nullable=false, updatable=false) private LocalDateTime dateCreation;
@Column(name="date_modification") private LocalDateTime dateModification;
}
