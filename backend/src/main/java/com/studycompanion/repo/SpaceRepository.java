package com.studycompanion.repo;

import com.studycompanion.domain.Space;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface SpaceRepository extends MongoRepository<Space, String> {
    List<Space> findByUserIdOrderByCreatedAtDesc(String userId);
    List<Space> findAllByOrderByCreatedAtDesc();
}
