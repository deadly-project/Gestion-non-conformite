package com.example.repository;

import com.example.entity.Users;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UtilisateurRepository extends JpaRepository<Users, Long> {
    Optional<Users> findByEmailIgnoreCase(String email);
    Optional<Users> findByMatricule(Integer matricule);
    boolean existsByEmailIgnoreCase(String email);
    boolean existsByMatricule(Integer matricule);

    /** Identifiants des comptes actifs d'un rôle (destinataires des notifications). */
    @Query("select u.id from Users u where u.role = :role and u.actif = true")
    List<Long> idsActifsParRole(@Param("role") String role);
}