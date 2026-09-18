package com.studycompanion.repo;

import com.studycompanion.domain.Material;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface MaterialRepository extends MongoRepository<Material, String> {
    List<Material> findByProjectIdOrderByUploadedAtDesc(String projectId);
    List<Material> findByProjectId(String projectId);
}
