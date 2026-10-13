package com.example.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "categories_nc")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CategorieNc {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

@Column(name="code", nullable=false, unique=true, length=30) private String code;
@Column(name="libelle", nullable=false, unique=true, length=150) private String libelle;
@Column(name="actif", nullable=false) private Boolean actif = true;
}
