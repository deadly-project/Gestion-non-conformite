package com.example.repository;

import com.example.entity.Audit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

// Remplace la version précédente : les deux premières méthodes existaient déjà.
public interface AuditRepository extends JpaRepository<Audit, Long> {

    /** Audits planifiés sur les étapes CAPA d'une non-conformité. */
    @Query("""
            select a from Audit a
            where a.actionCapaId in (select c.id from ActionCapa c where c.ncId = :ncId)
            order by a.datePlanifiee, a.actionCapaId
            """)
    List<Audit> findByNcId(@Param("ncId") Long ncId);

    boolean existsByActionCapaIdAndDatePlanifiee(Long actionCapaId, LocalDate datePlanifiee);

    /** Calendrier d'un auditeur sur une période. */
    List<Audit> findByAuditeurIdAndDatePlanifieeBetweenOrderByDatePlanifieeAscIdAsc(
            Long auditeurId, LocalDate du, LocalDate au);

    /** Audits à traiter : statuts donnés, prévus au plus tard à la date limite (retards inclus). */
    List<Audit> findByAuditeurIdAndStatutInAndDatePlanifieeLessThanEqualOrderByDatePlanifieeAscIdAsc(
            Long auditeurId, Collection<String> statuts, LocalDate limite);

    List<Audit> findByActionCapaIdInOrderByDatePlanifieeAscIdAsc(Collection<Long> actionCapaIds);
}