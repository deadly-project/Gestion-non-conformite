package com.example.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "actions_capa")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ActionCapa {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

@Column(name="nc_id") private UUID ncId;
@Column(name="constat_id") private UUID constatId;
@Column(name="type_action", nullable=false, length=10) private String typeAction;
@Column(name="description", nullable=false, columnDefinition="text") private String description;
@Column(name="responsable_action_id", nullable=false) private UUID responsableActionId;
@Column(name="statut_action", nullable=false, length=10) private String statutAction = "A_FAIRE";
@Column(name="date_echeance", nullable=false) private LocalDate dateEcheance;
@Column(name="date_realisation") private LocalDate dateRealisation;
@Column(name="date_verification") private LocalDateTime dateVerification;
@Column(name="verificateur_id") private UUID verificateurId;
@Column(name="efficace") private Boolean efficace;
@Column(name="commentaire_efficacite", columnDefinition="text") private String commentaireEfficacite;
@Column(name="date_creation", nullable=false, updatable=false) private LocalDateTime dateCreation;
@Column(name="date_modification") private LocalDateTime dateModification;
}
