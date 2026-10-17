package com.example.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import com.fasterxml.jackson.databind.JsonNode;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "historique_actions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class HistoriqueAction {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Long id;

@Column(name="utilisateur_id") private Long utilisateurId;
@Column(name="action_type", nullable=false, length=40) private String actionType;
@Column(name="entite" +
        "_concernee", nullable=false, length=30) private String entiteConcernee;
@Column(name="entite_id") private Long entiteId;
@JdbcTypeCode(SqlTypes.JSON) @Column(name="details_modification", columnDefinition="jsonb") private JsonNode detailsModification;
@Column(name="date_action", nullable=false, updatable=false) private LocalDateTime dateAction;
}
