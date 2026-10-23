package com.example.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/** Pièce jointe (preuve) facultative déposée sur un constat d'audit. */
@Entity
@Table(name = "constat_pieces_jointes")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ConstatPieceJointe {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Long id;

    @Column(name="constat_id", nullable=false) private Long constatId;
    @Column(name="file_url", nullable=false, length=500) private String fileUrl;
    @Column(name="nom_original", length=255) private String nomOriginal;
    @Column(name="file_type", nullable=false, length=5) private String fileType;
    @Column(name="mime_type", nullable=false, length=100) private String mimeType;
    @Column(name="taille_octets", nullable=false) private Long tailleOctets;
    @Column(name="uploaded_by") private Long uploadedBy;
    @Column(name="date_creation", nullable=false, updatable=false) private LocalDateTime dateCreation;
}
