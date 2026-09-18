package com.studycompanion.repo;

import com.studycompanion.domain.StudyPlan;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface StudyPlanRepository extends MongoRepository<StudyPlan, String> {
    Optional<StudyPlan> findByProjectIdAndUserId(String projectId, String userId);
}
