package com.studycompanion.repo;

import com.studycompanion.domain.Concept;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface ConceptRepository extends MongoRepository<Concept, String> {
    List<Concept> findByProjectId(String projectId);
    Optional<Concept> findByProjectIdAndNameIgnoreCase(String projectId, String name);
}
