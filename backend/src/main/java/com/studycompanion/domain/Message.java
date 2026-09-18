package com.studycompanion.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Document("messages")
public class Message {
    @Id private String id;
    private String conversationId;
    private String projectId;
    private String role;
    private String content;
    private List<Map<String, Object>> citations = new ArrayList<>();
    private String evidenceStatus;
    private Instant createdAt;

    public Message() {}
    public String getId() { return this.id; }
    public void setId(String id) { this.id = id; }
    public String getConversationId() { return this.conversationId; }
    public void setConversationId(String conversationId) { this.conversationId = conversationId; }
    public String getProjectId() { return this.projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public String getRole() { return this.role; }
    public void setRole(String role) { this.role = role; }
    public String getContent() { return this.content; }
    public void setContent(String content) { this.content = content; }
    public String getEvidenceStatus() { return this.evidenceStatus; }
    public void setEvidenceStatus(String evidenceStatus) { this.evidenceStatus = evidenceStatus; }
    public Instant getCreatedAt() { return this.createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }


    public List<Map<String, Object>> getCitations() { return this.citations; }
    public void setCitations(List<Map<String, Object>> citations) { this.citations = citations; }

}
