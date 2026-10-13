package com.example.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "notifications")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Notification {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

@Column(name="user_id", nullable=false) private UUID userId;
@Column(name="type", nullable=false, length=30) private String type;
@Column(name="message", nullable=false, columnDefinition="text") private String message;
@Column(name="entite", length=30) private String entite;
@Column(name="entite_id") private UUID entiteId;
@Column(name="lue", nullable=false) private Boolean lue = false;
@Column(name="date_creation", nullable=false, updatable=false) private LocalDateTime dateCreation;
}
