package com.example.repository;

import com.example.entity.Users;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UtilisateurRepository extends JpaRepository<Users, UUID> {
    Optional<Users> findByEmailIgnoreCase(String email);
    Optional<Users> findByMatriculeIgnoreCase(String matricule);
    boolean existsByEmailIgnoreCase(String email);
    boolean existsByMatriculeIgnoreCase(String matricule);
}
