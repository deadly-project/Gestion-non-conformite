package com.example.repository;

import com.example.entity.NcAttachment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NcAttachmentRepository extends JpaRepository<NcAttachment, Long> {
    List<NcAttachment> findByNcIdOrderByIdAsc(Long ncId);
}
