package com.example.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "audits")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Audit {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Long id;

    @Column(name="titre", nullable=false, length=200) private String titre;
    @Column(name="processus_id", nullable=false) private Long processusId;
    @Column(name="type_audit", nullable=false, length=10) private String typeAudit;
    @Column(name="auditeur_id", nullable=false) private Long auditeurId;
    /** Étape CAPA auditée (null pour un audit qui ne porte pas sur une étape CAPA). */
    @Column(name="action_capa_id") private Long actionCapaId;
    @Column(name="date_planifiee", nullable=false) private LocalDate datePlanifiee;
    @Column(name="date_realisation") private LocalDate dateRealisation;
    @Builder.Default
    @Column(name="statut", nullable=false, length=10) private String statut = "PLANIFIE";
    /** Description de l'audit réalisé (renseignée par l'auditeur). */
    @Column(name="compte_rendu", columnDefinition="text") private String compteRendu;
    /** Traitement constaté sur le terrain (renseigné par l'auditeur). */
    @Column(name="traitement_realise", columnDefinition="text") private String traitementRealise;
    /** REALISE, PARTIEL ou NON_REALISE : verdict de l'auditeur sur le traitement. */
    @Column(name="resultat_traitement", length=12) private String resultatTraitement;
    @Column(name="date_creation", nullable=false, updatable=false) private LocalDateTime dateCreation;
    @Column(name="date_modification") private LocalDateTime dateModification;

    @PrePersist
    void avantCreation() {
        if (dateCreation == null) dateCreation = LocalDateTime.now();
    }
}