package com.example.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Users {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Long id;
    @Column(name="date_modification") private LocalDateTime dateModification;

    @Column(name="nom", nullable=false, length=100) private String nom;
    @Column(name="prenom", nullable=false, length=100) private String prenom;
    @Column(name="email", nullable=false, unique=true, length=255) private String email;
    @Column(name="matricule", nullable=false, unique=true) private Integer matricule;
    @Column(name="mot_de_passe", nullable=false, length=255) private String motDePasse;
    @Column(name="role", nullable=false, length=20) private String role;
    @Builder.Default
    @Column(name="actif", nullable=false)
    private Boolean actif = true;
    @Column(name="date_creation", nullable=false, updatable=false) private LocalDateTime dateCreation;

    @PrePersist
    protected void avantCreation() {
        LocalDateTime maintenant = LocalDateTime.now();

        if (dateCreation == null) {
            dateCreation = maintenant;
        }

        if (dateModification == null) {
            dateModification = maintenant;
        }

        if (actif == null) {
            actif = true;
        }
    }

    @PreUpdate
    protected void avantModification() {
        dateModification = LocalDateTime.now();
    }
}