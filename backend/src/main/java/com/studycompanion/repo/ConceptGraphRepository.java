package com.studycompanion.repo;

import com.studycompanion.domain.ConceptGraph;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ConceptGraphRepository extends MongoRepository<ConceptGraph, String> {
    Optional<ConceptGraph> findByProjectId(String projectId);
}
