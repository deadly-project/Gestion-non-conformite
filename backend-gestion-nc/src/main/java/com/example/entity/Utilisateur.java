package com.example.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Utilisateur {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

@Column(name="nom", nullable=false, length=100) private String nom;
@Column(name="prenom", nullable=false, length=100) private String prenom;
@Column(name="date_naissance") private LocalDate dateNaissance;
@Column(name="email", nullable=false, unique=true, length=255) private String email;
@Column(name="matricule", nullable=false, unique=true, length=50) private String matricule;
@Column(name="mot_de_passe", nullable=false, length=255) private String motDePasse;
@Column(name="role", nullable=false, length=20) private String role;
@Column(name="actif", nullable=false) private Boolean actif = true;
@Column(name="date_creation", nullable=false, updatable=false) private LocalDateTime dateCreation;
@Column(name="date_modification") private LocalDateTime dateModification;
}
