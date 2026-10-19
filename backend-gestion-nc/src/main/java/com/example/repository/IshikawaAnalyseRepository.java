package com.example.repository;

import com.example.entity.IshikawaAnalyse;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface IshikawaAnalyseRepository extends JpaRepository<IshikawaAnalyse, Long> {
    List<IshikawaAnalyse> findByNcId(Long ncId);
}
