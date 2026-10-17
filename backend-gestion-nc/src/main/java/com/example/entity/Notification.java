package com.example.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "notifications")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Notification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Long id;

@Column(name="user_id", nullable=false) private Long userId;
@Column(name="type", nullable=false, length=30) private String type;
@Column(name="message", nullable=false, columnDefinition="text") private String message;
@Column(name="entite", length=30) private String entite;
@Column(name="entite_id") private Long entiteId;
@Column(name="lue", nullable=false) private Boolean lue = false;
@Column(name="date_creation", nullable=false, updatable=false) private LocalDateTime dateCreation;
}
