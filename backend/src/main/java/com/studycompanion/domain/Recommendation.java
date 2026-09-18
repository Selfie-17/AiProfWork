package com.studycompanion.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document("recommendations")
public class Recommendation {
    @Id private String id;
    private String projectId;
    private String userId;
    private String text;
    private String reason;
    private String status;
    private Instant createdAt;

    public Recommendation() {}
    public String getId() { return this.id; }
    public void setId(String id) { this.id = id; }
    public String getProjectId() { return this.projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public String getUserId() { return this.userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getText() { return this.text; }
    public void setText(String text) { this.text = text; }
    public String getReason() { return this.reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getStatus() { return this.status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getCreatedAt() { return this.createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

}
