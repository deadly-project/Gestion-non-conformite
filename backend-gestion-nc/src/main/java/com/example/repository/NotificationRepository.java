package com.example.repository;

import com.example.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    Page<Notification> findByUserIdOrderByDateCreationDescIdDesc(Long userId, Pageable pageable);

    long countByUserIdAndLueFalse(Long userId);

    /** Évite de renvoyer la même alerte (échéance, absence de traitement) à chaque exécution du planificateur. */
    boolean existsByUserIdAndTypeAndEntiteIdAndDateCreationAfter(
            Long userId, String type, Long entiteId, LocalDateTime depuis);

    @Modifying(clearAutomatically = true)
    @Query("update Notification n set n.lue = true where n.userId = :userId and n.lue = false")
    int marquerToutesLues(@Param("userId") Long userId);

    @Modifying(clearAutomatically = true)
    @Query("update Notification n set n.lue = true where n.id = :id and n.userId = :userId")
    int marquerLue(@Param("id") Long id, @Param("userId") Long userId);
}
