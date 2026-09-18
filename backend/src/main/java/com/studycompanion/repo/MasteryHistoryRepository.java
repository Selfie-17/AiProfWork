package com.studycompanion.repo;

import com.studycompanion.domain.MasteryHistory;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface MasteryHistoryRepository extends MongoRepository<MasteryHistory, String> {
    List<MasteryHistory> findByProjectIdOrderByTimestampAsc(String projectId);
    List<MasteryHistory> findByProjectIdAndConceptIdOrderByTimestampAsc(String projectId, String conceptId);
}
