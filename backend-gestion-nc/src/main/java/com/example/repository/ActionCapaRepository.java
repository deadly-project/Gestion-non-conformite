package com.example.repository;

import com.example.entity.ActionCapa;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ActionCapaRepository extends JpaRepository<ActionCapa, Long> {
    /** L'ordre des étapes = ordre de création (identifiant croissant). */
    List<ActionCapa> findByNcIdOrderByIdAsc(Long ncId);

    long countByNcId(Long ncId);
}
