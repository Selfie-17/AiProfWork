package com.studycompanion.repo;

import com.studycompanion.domain.Recommendation;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface RecommendationRepository extends MongoRepository<Recommendation, String> {
    List<Recommendation> findByProjectIdAndStatusOrderByCreatedAtDesc(String projectId, String status);
    List<Recommendation> findByProjectIdOrderByCreatedAtDesc(String projectId);
}
