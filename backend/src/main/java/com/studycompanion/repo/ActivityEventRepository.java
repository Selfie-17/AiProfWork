package com.studycompanion.repo;

import com.studycompanion.domain.ActivityEvent;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface ActivityEventRepository extends MongoRepository<ActivityEvent, String> {
    Optional<ActivityEvent> findByIdempotencyKey(String idempotencyKey);
    List<ActivityEvent> findByProjectIdOrderByCreatedAtDesc(String projectId);
    List<ActivityEvent> findByUserIdOrderByCreatedAtDesc(String userId);
}
