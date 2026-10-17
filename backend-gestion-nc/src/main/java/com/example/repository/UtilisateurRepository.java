package com.example.repository;

import com.example.entity.Users;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UtilisateurRepository extends JpaRepository<Users, Long> {
    Optional<Users> findByEmailIgnoreCase(String email);
    Optional<Users> findByMatricule(Integer matricule);
    boolean existsByEmailIgnoreCase(String email);
    boolean existsByMatricule(Integer matricule);
}
