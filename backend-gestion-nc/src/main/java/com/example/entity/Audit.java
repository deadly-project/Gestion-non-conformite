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
@Column(name="date_planifiee", nullable=false) private LocalDate datePlanifiee;
@Column(name="date_realisation") private LocalDate dateRealisation;
@Column(name="statut", nullable=false, length=10) private String statut = "PLANIFIE";
@Column(name="date_creation", nullable=false, updatable=false) private LocalDateTime dateCreation;
@Column(name="date_modification") private LocalDateTime dateModification;
}
