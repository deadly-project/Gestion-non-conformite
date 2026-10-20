package com.example.repository;

import com.example.dto.nc.NcListeItem;
import com.example.entity.NonConformite;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface NonConformiteRepository extends JpaRepository<NonConformite, Long> {

    /** Recherche une non-conformité par sa référence unique. */
    Optional<NonConformite> findByReference(String reference);

    List<NonConformite> findByDeclarantIdOrderByDateCreationDescIdDesc(Long declarantId);

    /** Verrou d'écriture : deux responsables ne peuvent pas traiter la même NC en même temps. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select n from NonConformite n where n.id = :id")
    Optional<NonConformite> findByIdForUpdate(@Param("id") Long id);

    /**
     * Liste paginée. Paramètres jamais null (statut = "" : tous ; motif = "%" : tout),
     * ce qui évite les problèmes de typage des paramètres null avec PostgreSQL.
     */
    @Query(value = """
            select new com.example.dto.nc.NcListeItem(
                n.id, n.reference, n.titre, n.statut, n.dateDetection, n.dateCreation,
                n.graviteDeclaree, n.gravite, u.nom, u.prenom, p.libelle)
            from NonConformite n, Users u, Processus p
            where u.id = n.declarantId and p.id = n.processusId
              and (:statut = '' or n.statut = :statut)
              and (lower(n.titre) like :motif or lower(n.reference) like :motif
                   or lower(u.nom) like :motif or lower(u.prenom) like :motif
                   or lower(p.libelle) like :motif)
            order by n.dateCreation desc, n.id desc
            """,
            countQuery = """
            select count(n)
            from NonConformite n, Users u, Processus p
            where u.id = n.declarantId and p.id = n.processusId
              and (:statut = '' or n.statut = :statut)
              and (lower(n.titre) like :motif or lower(n.reference) like :motif
                   or lower(u.nom) like :motif or lower(u.prenom) like :motif
                   or lower(p.libelle) like :motif)
            """)
    Page<NcListeItem> rechercher(@Param("statut") String statut,
                                 @Param("motif") String motif,
                                 Pageable pageable);
}