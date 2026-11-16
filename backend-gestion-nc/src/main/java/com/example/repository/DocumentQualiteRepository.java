package com.example.repository;

import com.example.entity.DocumentQualite;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface DocumentQualiteRepository extends JpaRepository<DocumentQualite, Long> {

    boolean existsByReferenceIgnoreCase(String reference);

    /**
     * Recherche filtrée. Valeurs « neutres » : -1 (processus), '' (type, statut, texte).
     * vue : ACTIFS (hors obsolètes), ARCHIVES (obsolètes seulement) ou TOUS.
     * texte : en minuscules, caractères % _ ! déjà échappés avec « ! ».
     */
    @Query(value = """
            select d from DocumentQualite d
            where (:processusId = -1L or d.processusId = :processusId)
              and (:typeDocument = '' or d.typeDocument = :typeDocument)
              and (:statut = '' or d.statut = :statut)
              and (:vue = 'TOUS'
                   or (:vue = 'ACTIFS' and d.statut <> 'OBSOLETE')
                   or (:vue = 'ARCHIVES' and d.statut = 'OBSOLETE'))
              and (:texte = ''
                   or lower(d.reference) like concat('%', :texte, '%') escape '!'
                   or lower(d.titre) like concat('%', :texte, '%') escape '!'
                   or lower(coalesce(d.description, '')) like concat('%', :texte, '%') escape '!'
                   or lower(coalesce(d.nomFichier, '')) like concat('%', :texte, '%') escape '!')
            order by coalesce(d.dateModification, d.dateCreation) desc, d.id desc
            """,
            countQuery = """
            select count(d) from DocumentQualite d
            where (:processusId = -1L or d.processusId = :processusId)
              and (:typeDocument = '' or d.typeDocument = :typeDocument)
              and (:statut = '' or d.statut = :statut)
              and (:vue = 'TOUS'
                   or (:vue = 'ACTIFS' and d.statut <> 'OBSOLETE')
                   or (:vue = 'ARCHIVES' and d.statut = 'OBSOLETE'))
              and (:texte = ''
                   or lower(d.reference) like concat('%', :texte, '%') escape '!'
                   or lower(d.titre) like concat('%', :texte, '%') escape '!'
                   or lower(coalesce(d.description, '')) like concat('%', :texte, '%') escape '!'
                   or lower(coalesce(d.nomFichier, '')) like concat('%', :texte, '%') escape '!')
            """)
    Page<DocumentQualite> rechercher(@Param("processusId") Long processusId,
                                     @Param("typeDocument") String typeDocument,
                                     @Param("statut") String statut,
                                     @Param("vue") String vue,
                                     @Param("texte") String texte,
                                     Pageable pageable);

    /** Répartition par statut : lignes {statut, nombre}. */
    @Query("select d.statut, count(d) from DocumentQualite d group by d.statut")
    List<Object[]> compterParStatut();
}