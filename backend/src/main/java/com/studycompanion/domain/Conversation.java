package com.studycompanion.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document("conversations")
public class Conversation {
    @Id private String id;
    private String projectId;
    private String userId;
    private String title;
    private Instant createdAt;

    public Conversation() {}
    public String getId() { return this.id; }
    public void setId(String id) { this.id = id; }
    public String getProjectId() { return this.projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public String getUserId() { return this.userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getTitle() { return this.title; }
    public void setTitle(String title) { this.title = title; }
    public Instant getCreatedAt() { return this.createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

}
