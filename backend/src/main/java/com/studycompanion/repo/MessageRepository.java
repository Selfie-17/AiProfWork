package com.studycompanion.repo;

import com.studycompanion.domain.Message;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface MessageRepository extends MongoRepository<Message, String> {
    List<Message> findByConversationIdOrderByCreatedAtAsc(String conversationId);
    List<Message> findTop8ByConversationIdOrderByCreatedAtDesc(String conversationId);
}
