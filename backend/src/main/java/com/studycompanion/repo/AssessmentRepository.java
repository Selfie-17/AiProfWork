package com.studycompanion.repo;

import com.studycompanion.domain.Assessment;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface AssessmentRepository extends MongoRepository<Assessment, String> {
    List<Assessment> findByProjectIdOrderByCreatedAtDesc(String projectId);
    List<Assessment> findByUserIdOrderByCreatedAtDesc(String userId);
}
