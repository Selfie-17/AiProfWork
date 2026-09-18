package com.studycompanion.repo;

import com.studycompanion.domain.Project;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ProjectRepository extends MongoRepository<Project, String> {
    List<Project> findByUserIdOrderByCreatedAtDesc(String userId);
    List<Project> findBySpaceIdAndUserId(String spaceId, String userId);
    List<Project> findByUserId(String userId);
    List<Project> findAllByOrderByCreatedAtDesc();
    List<Project> findBySpaceIdOrderByCreatedAtDesc(String spaceId);
    List<Project> findBySpaceId(String spaceId);
}
