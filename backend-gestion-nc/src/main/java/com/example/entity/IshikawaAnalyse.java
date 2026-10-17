package com.example.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "ishikawa_analyses")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class IshikawaAnalyse {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Long id;

@Column(name="nc_id", nullable=false) private Long ncId;
@Column(name="branche", nullable=false, length=15) private String branche;
@Column(name="pourquoi_1", columnDefinition="text") private String pourquoi1;
@Column(name="pourquoi_2", columnDefinition="text") private String pourquoi2;
@Column(name="pourquoi_3", columnDefinition="text") private String pourquoi3;
@Column(name="pourquoi_4", columnDefinition="text") private String pourquoi4;
@Column(name="pourquoi_5", columnDefinition="text") private String pourquoi5;
@Column(name="cause_racine_validee", columnDefinition="text") private String causeRacineValidee;
@Column(name="auteur_id") private Long auteurId;
@Column(name="date_modification") private LocalDateTime dateModification;
}
