package com.example.entity;

import com.example.entity.enums.StatutDemande;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/** Demande de réinitialisation de mot de passe, à valider ou refuser par un administrateur. */
@Entity
@Table(name = "demandes_reinitialisation")
@Getter @Setter @NoArgsConstructor
public class DemandeReinitialisation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, updatable = false)
    private Users utilisateur;

    @Enumerated(EnumType.STRING)
    @Column(name = "statut", nullable = false, length = 10)
    private StatutDemande statut = StatutDemande.EN_ATTENTE;

    @Column(name = "date_demande", nullable = false, updatable = false)
    private LocalDateTime dateDemande;

    @Column(name = "date_traitement")
    private LocalDateTime dateTraitement;

    /** Administrateur ayant validé ou refusé la demande. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "traite_par")
    private Users traitePar;

    @PrePersist
    protected void avantCreation() {
        if (dateDemande == null) {
            dateDemande = LocalDateTime.now();
        }
    }
}
