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

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface NonConformiteRepository extends JpaRepository<NonConformite, Long> {

    /** Recherche une non-conformité par sa référence unique. */
    Optional<NonConformite> findByReference(String reference);

    List<NonConformite> findByDeclarantIdOrderByDateCreationDescIdDesc(Long declarantId);

    /** Non clôturées dont l'échéance est dépassée (rappel au responsable qualité). */
    @Query("""
            select n from NonConformite n
            where n.statut <> 'CLOTUREE' and n.dateEcheance is not null and n.dateEcheance < :aujourdhui
            order by n.dateEcheance
            """)
    List<NonConformite> findEcheanceDepassee(@Param("aujourdhui") LocalDate aujourdhui);

    /** Déclarées avant la limite et toujours « En attente » : aucun traitement n'a démarré. */
    @Query("""
            select n from NonConformite n
            where n.statut = 'EN_ATTENTE' and n.dateCreation < :limite
            order by n.dateCreation
            """)
    List<NonConformite> findSansTraitementDepuis(@Param("limite") LocalDateTime limite);

    /** Verrou d'écriture : deux responsables ne peuvent pas traiter la même NC en même temps. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select n from NonConformite n where n.id = :id")
    Optional<NonConformite> findByIdForUpdate(@Param("id") Long id);

    /**
     * Liste paginée. Paramètres jamais null (statut = "" : tous ; motif = "%" : tout ;
     * responsableCapaId = -1 : toutes les NC, sinon seulement celles où cet utilisateur est
     * responsable d'au moins une action CAPA), ce qui évite les problèmes de typage des
     * paramètres null avec PostgreSQL.
     */
    @Query(value = """
            select new com.example.dto.nc.NcListeItem(
                n.id, n.reference, n.titre, n.statut, n.dateDetection, n.dateCreation,
                n.graviteDeclaree, n.gravite, u.nom, u.prenom, p.libelle)
            from NonConformite n, Users u, Processus p
            where u.id = n.declarantId and p.id = n.processusId
              and (:statut = '' or n.statut = :statut)
              and (:responsableCapaId = -1L or exists (
                     select a.id from ActionCapa a
                     where a.ncId = n.id and a.responsableActionId = :responsableCapaId))
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
              and (:responsableCapaId = -1L or exists (
                     select a.id from ActionCapa a
                     where a.ncId = n.id and a.responsableActionId = :responsableCapaId))
              and (lower(n.titre) like :motif or lower(n.reference) like :motif
                   or lower(u.nom) like :motif or lower(u.prenom) like :motif
                   or lower(p.libelle) like :motif)
            """)
    Page<NcListeItem> rechercher(@Param("statut") String statut,
                                 @Param("motif") String motif,
                                 @Param("responsableCapaId") Long responsableCapaId,
                                 Pageable pageable);
}