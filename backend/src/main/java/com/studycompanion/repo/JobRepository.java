package com.studycompanion.repo;

import com.studycompanion.domain.Job;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface JobRepository extends MongoRepository<Job, String> {
    List<Job> findAllByOrderByCreatedAtDesc();
    List<Job> findByRelatedId(String relatedId);
}
