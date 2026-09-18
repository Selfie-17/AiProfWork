package com.studycompanion.repo;

import com.studycompanion.domain.Conversation;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ConversationRepository extends MongoRepository<Conversation, String> {
    List<Conversation> findByProjectIdAndUserIdOrderByCreatedAtDesc(String projectId, String userId);
}
