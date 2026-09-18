package com.studycompanion.repo;

import com.studycompanion.domain.LearnerMistake;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LearnerMistakeRepository extends MongoRepository<LearnerMistake, String> {
    List<LearnerMistake> findByProjectIdAndUserIdOrderByCreatedAtDesc(String projectId, String userId);
    List<LearnerMistake> findByProjectIdOrderByCreatedAtDesc(String projectId);
    List<LearnerMistake> findTop10ByProjectIdAndUserIdOrderByCreatedAtDesc(String projectId, String userId);
}
