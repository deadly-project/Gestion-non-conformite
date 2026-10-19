package com.example.repository;

import com.example.entity.Users;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.List;

/** Recherche par nom, prénom ou matricule (comptes actifs seulement). */
public interface UtilisateurRechercheRepository extends Repository<Users, Long> {

    @Query("""
            select u from Users u
            where u.actif = true
              and (:role = '' or u.role = :role)
              and (lower(u.nom) like :motif or lower(u.prenom) like :motif
                   or lower(concat(u.prenom, ' ', u.nom)) like :motif
                   or lower(concat(u.nom, ' ', u.prenom)) like :motif
                   or cast(u.matricule as string) like :motif)
            order by u.nom, u.prenom
            """)
    List<Users> rechercher(@Param("role") String role,
                           @Param("motif") String motif,
                           Pageable pageable);
}
