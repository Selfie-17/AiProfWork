package com.studycompanion.repo;

import com.studycompanion.domain.Flashcard;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface FlashcardRepository extends MongoRepository<Flashcard, String> {
    List<Flashcard> findByProjectIdAndUserIdOrderByNextReviewDateAsc(String projectId, String userId);
    List<Flashcard> findByProjectIdAndUserIdAndNextReviewDateLessThanEqualOrderByNextReviewDateAsc(String projectId, String userId, Instant cutoff);
    long countByProjectIdAndUserId(String projectId, String userId);
    long countByProjectIdAndUserIdAndNextReviewDateLessThanEqual(String projectId, String userId, Instant cutoff);
}
