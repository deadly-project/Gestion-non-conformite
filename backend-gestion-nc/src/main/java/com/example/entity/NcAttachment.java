package com.example.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "nc_attachments")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class NcAttachment {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

@Column(name="nc_id", nullable=false) private UUID ncId;
@Column(name="file_url", nullable=false, length=500) private String fileUrl;
@Column(name="nom_original", length=255) private String nomOriginal;
@Column(name="file_type", nullable=false, length=5) private String fileType;
@Column(name="mime_type", nullable=false, length=100) private String mimeType;
@Column(name="taille_octets", nullable=false) private Long tailleOctets;
@Column(name="uploaded_by") private UUID uploadedBy;
@Column(name="date_creation", nullable=false, updatable=false) private LocalDateTime dateCreation;
}
