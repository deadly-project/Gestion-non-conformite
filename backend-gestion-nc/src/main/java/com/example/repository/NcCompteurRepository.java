package com.example.repository;

import com.example.entity.NcCompteur;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface NcCompteurRepository extends JpaRepository<NcCompteur, Integer> {

    /** Crée la ligne de l'année si besoin, sans erreur même si deux requêtes arrivent ensemble. */
    @Modifying(flushAutomatically = true)
    @Query(value = "INSERT INTO nc_compteurs (annee, dernier_numero) VALUES (:annee, 0) "
            + "ON CONFLICT (annee) DO NOTHING", nativeQuery = true)
    void creerSiAbsent(@Param("annee") int annee);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from NcCompteur c where c.annee = :annee")
    Optional<NcCompteur> findByAnneeForUpdate(@Param("annee") int annee);
}
