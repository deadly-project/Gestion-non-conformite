package com.example.repository;

import com.example.entity.HistoriqueAction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface HistoriqueActionRepository extends JpaRepository<HistoriqueAction, Long> {


    @Query(value = """
        select h from HistoriqueAction h
        where (:utilisateurId = -1L or h.utilisateurId = :utilisateurId)
          and (:actionType = '' or h.actionType = :actionType)
          and (:entite = '' or h.entiteConcernee = :entite)
          and h.dateAction >= :debut
          and h.dateAction <= :fin
        order by h.dateAction desc, h.id desc
        """,
            countQuery = """
        select count(h) from HistoriqueAction h
        where (:utilisateurId = -1L or h.utilisateurId = :utilisateurId)
          and (:actionType = '' or h.actionType = :actionType)
          and (:entite = '' or h.entiteConcernee = :entite)
          and h.dateAction >= :debut
          and h.dateAction <= :fin
        """)
    Page<HistoriqueAction> rechercher(
            @Param("utilisateurId") Long utilisateurId,
            @Param("actionType") String actionType,
            @Param("entite") String entite,
            @Param("debut") LocalDateTime debut,
            @Param("fin") LocalDateTime fin,
            Pageable pageable);


    @Query("select distinct h.actionType from HistoriqueAction h order by h.actionType")
    List<String> listerTypesAction();

    @Query("select distinct h.entiteConcernee from HistoriqueAction h order by h.entiteConcernee")
    List<String> listerEntites();
}
