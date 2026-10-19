package com.example.repository;

import com.example.entity.Processus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProcessusRepository extends JpaRepository<Processus, Long> {
    List<Processus> findByActifTrueOrderByLibelleAsc();
}
