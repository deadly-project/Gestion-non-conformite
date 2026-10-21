package com.example.repository;

import com.example.entity.Audit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

// Si votre projet a déjà un AuditRepository, ajoutez-y simplement ces deux méthodes.
public interface AuditRepository extends JpaRepository<Audit, Long> {

    /** Audits planifiés sur les étapes CAPA d'une non-conformité. */
    @Query("""
            select a from Audit a
            where a.actionCapaId in (select c.id from ActionCapa c where c.ncId = :ncId)
            order by a.datePlanifiee, a.actionCapaId
            """)
    List<Audit> findByNcId(@Param("ncId") Long ncId);

    boolean existsByActionCapaIdAndDatePlanifiee(Long actionCapaId, LocalDate datePlanifiee);
}