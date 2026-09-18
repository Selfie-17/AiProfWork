package com.studycompanion.repo;

import com.studycompanion.domain.AiUsageLog;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface AiUsageLogRepository extends MongoRepository<AiUsageLog, String> {
    List<AiUsageLog> findAllByOrderByCreatedAtDesc();
}
