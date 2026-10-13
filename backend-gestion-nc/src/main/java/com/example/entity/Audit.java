package com.example.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "audits")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Audit {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

@Column(name="titre", nullable=false, length=200) private String titre;
@Column(name="processus_id", nullable=false) private UUID processusId;
@Column(name="type_audit", nullable=false, length=10) private String typeAudit;
@Column(name="auditeur_id", nullable=false) private UUID auditeurId;
@Column(name="date_planifiee", nullable=false) private LocalDate datePlanifiee;
@Column(name="date_realisation") private LocalDate dateRealisation;
@Column(name="statut", nullable=false, length=10) private String statut = "PLANIFIE";
@Column(name="date_creation", nullable=false, updatable=false) private LocalDateTime dateCreation;
@Column(name="date_modification") private LocalDateTime dateModification;
}
