package com.example.repository;

import com.example.entity.CategorieNc;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CategorieNcRepository extends JpaRepository<CategorieNc, Long> {
    List<CategorieNc> findByActifTrueOrderByLibelleAsc();
}
