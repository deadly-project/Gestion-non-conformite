package com.example.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** Document du système documentaire qualité (table documents_qualite). */
@Entity
@Table(name = "documents_qualite")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DocumentQualite {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Long id;

    @Column(name = "reference", nullable = false, unique = true, length = 50) private String reference;
    @Column(name = "titre", nullable = false, length = 255) private String titre;
    @Column(name = "description", columnDefinition = "text") private String description;
    @Column(name = "type_document", nullable = false, length = 15) private String typeDocument;
    @Builder.Default
    @Column(name = "statut", nullable = false, length = 12) private String statut = "EN_VIGUEUR";
    @Builder.Default
    @Column(name = "version", nullable = false, length = 10) private String version = "1.0";
    @Column(name = "nom_fichier", length = 255) private String nomFichier;
    @Column(name = "chemin_fichier", nullable = false, length = 500) private String cheminFichier;
    @Column(name = "mime_type", length = 100) private String mimeType;
    @Column(name = "taille_octets") private Long tailleOctets;
    @Column(name = "processus_id", nullable = false) private Long processusId;
    @Column(name = "createur_id", nullable = false) private Long createurId;
    @Column(name = "date_application") private LocalDate dateApplication;
    @Column(name = "date_creation", nullable = false, updatable = false) private LocalDateTime dateCreation;
    @Column(name = "date_modification") private LocalDateTime dateModification;
}