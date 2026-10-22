package com.example.repository;

import com.example.entity.ConstatAudit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface ConstatAuditRepository extends JpaRepository<ConstatAudit, Long> {

    List<ConstatAudit> findByAuditIdInOrderByDateConstatAscIdAsc(Collection<Long> auditIds);

    /** Lignes {auditId, nombre de constats}. */
    @Query("select c.auditId, count(c) from ConstatAudit c where c.auditId in :ids group by c.auditId")
    List<Object[]> compterParAudit(@Param("ids") Collection<Long> ids);
}