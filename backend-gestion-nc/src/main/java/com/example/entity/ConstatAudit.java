package com.example.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "constats_audit")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ConstatAudit {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Long id;

@Column(name="audit_id", nullable=false) private Long auditId;
@Column(name="type_constat", nullable=false, length=15) private String typeConstat;
@Column(name="description_constat", nullable=false, columnDefinition="text") private String descriptionConstat;
@Column(name="auteur_id", nullable=false) private Long auteurId;
@Column(name="date_constat", nullable=false, updatable=false) private LocalDateTime dateConstat;
}
