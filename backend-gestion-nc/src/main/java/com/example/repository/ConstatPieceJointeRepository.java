package com.example.repository;

import com.example.entity.ConstatPieceJointe;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface ConstatPieceJointeRepository extends JpaRepository<ConstatPieceJointe, Long> {
    List<ConstatPieceJointe> findByConstatIdInOrderByIdAsc(Collection<Long> constatIds);
    List<ConstatPieceJointe> findByConstatIdOrderByIdAsc(Long constatId);
}
