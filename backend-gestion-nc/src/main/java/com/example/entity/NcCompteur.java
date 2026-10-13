package com.example.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "nc_compteurs")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class NcCompteur {
@Id @Column(name="annee") private Integer annee;
@Column(name="dernier_numero", nullable=false) private Integer dernierNumero = 0;
}
