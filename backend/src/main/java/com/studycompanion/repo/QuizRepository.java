package com.studycompanion.repo;

import com.studycompanion.domain.Quiz;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface QuizRepository extends MongoRepository<Quiz, String> {
    List<Quiz> findByProjectIdAndUserIdOrderByStartedAtDesc(String projectId, String userId);
    Optional<Quiz> findFirstByProjectIdAndUserIdAndStatus(String projectId, String userId, String status);
}
