package com.example.repository;

import com.example.entity.Processus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ProcessusRepository extends JpaRepository<Processus, Long> {
    List<Processus> findByActifTrueOrderByLibelleAsc();

    /**
     * Doublon strict : même code, même libellé (sans tenir compte de la casse) ET même description.
     * Même règle que l'index unique uq_processus_code_libelle_description.
     */
    @Query("""
            select count(p) from Processus p
            where upper(p.code) = upper(:code)
              and lower(p.libelle) = lower(:libelle)
              and coalesce(p.description, '') = :description
            """)
    long compterDoublons(@Param("code") String code,
                         @Param("libelle") String libelle,
                         @Param("description") String description);

    default boolean existeDoublon(String code, String libelle, String description) {
        return compterDoublons(code, libelle, description) > 0;
    }
}