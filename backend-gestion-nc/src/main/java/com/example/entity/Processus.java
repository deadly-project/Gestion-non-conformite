package com.example.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "processus")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Processus {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Long id;

@Column(name="code", nullable=false, unique=true, length=30) private String code;
@Column(name="libelle", nullable=false, unique=true, length=150) private String libelle;
@Column(name="description", columnDefinition="text") private String description;
@Column(name="actif", nullable=false) private Boolean actif = true;
}
