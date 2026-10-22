package com.example.repository;

import com.example.entity.CommentaireConstat;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface CommentaireConstatRepository extends JpaRepository<CommentaireConstat, Long> {

    List<CommentaireConstat> findByConstatIdInOrderByDateCommentaireAscIdAsc(Collection<Long> constatIds);
}