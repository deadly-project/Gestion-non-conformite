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
    n.graviteDeclaree, n.gravite,
    u.id, u.nom, u.prenom, cast(u.matricule as string), u.role, u.email,
    p.id, p.libelle,
    n.dateEcheance)
from NonConformite n
  left join Users u on u.id = n.declarantId
  left join Processus p on p.id = n.processusId
where (:statut = '' or n.statut = :statut)
  and (:gravite = '' or n.gravite = :gravite)
  and (lower(coalesce(n.titre,''))     like :motif
    or lower(coalesce(n.reference,'')) like :motif
    or lower(coalesce(u.nom,''))       like :motif
    or lower(coalesce(u.prenom,''))    like :motif
    or lower(coalesce(p.libelle,''))   like :motif)
  and (:reference = '%' or lower(coalesce(n.reference,'')) like :reference)
  and (:declarant = '%'
    or lower(coalesce(u.nom,''))    like :declarant
    or lower(coalesce(u.prenom,'')) like :declarant
    or lower(cast(u.matricule as string)) like :declarant)
  and (:filtrerDateDetection = false or n.dateDetection = :dateDetection)
  and (n.dateDetection >= :dateDebut)
  and (n.dateDetection <= :dateFin)
  and (:responsableCapaId = -1L or exists (
         select a.id from ActionCapa a
         where a.ncId = n.id and a.responsableActionId = :responsableCapaId))
order by n.dateCreation desc, n.id desc
""",
            countQuery = """
select count(n)
from NonConformite n
  left join Users u on u.id = n.declarantId
  left join Processus p on p.id = n.processusId
where (:statut = '' or n.statut = :statut)
  and (:gravite = '' or n.gravite = :gravite)
  and (lower(coalesce(n.titre,''))     like :motif
    or lower(coalesce(n.reference,'')) like :motif
    or lower(coalesce(u.nom,''))       like :motif
    or lower(coalesce(u.prenom,''))    like :motif
    or lower(coalesce(p.libelle,''))   like :motif)
  and (:reference = '%' or lower(coalesce(n.reference,'')) like :reference)
  and (:declarant = '%'
    or lower(coalesce(u.nom,''))    like :declarant
    or lower(coalesce(u.prenom,'')) like :declarant
    or lower(cast(u.matricule as string)) like :declarant)
  and (:filtrerDateDetection = false or n.dateDetection = :dateDetection)
  and (n.dateDetection >= :dateDebut)
  and (n.dateDetection <= :dateFin)
  and (:responsableCapaId = -1L or exists (
         select a.id from ActionCapa a
         where a.ncId = n.id and a.responsableActionId = :responsableCapaId))
""")
    Page<NcListeItem> rechercher(@Param("statut") String statut,
                                 @Param("gravite") String gravite,
                                 @Param("motif") String motif,
                                 @Param("reference") String reference,
                                 @Param("declarant") String declarant,
                                 @Param("dateDetection") LocalDate dateDetection,
                                 @Param("filtrerDateDetection") boolean filtrerDateDetection,
                                 @Param("dateDebut") LocalDate dateDebut,
                                 @Param("dateFin") LocalDate dateFin,
                                 @Param("responsableCapaId") Long responsableCapaId,
                                 Pageable pageable);
}