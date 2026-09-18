package com.studycompanion.repo;

import com.studycompanion.domain.LearningContext;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface LearningContextRepository extends MongoRepository<LearningContext, String> {
    Optional<LearningContext> findByProjectIdAndUserId(String projectId, String userId);
}
