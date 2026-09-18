package com.studycompanion.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document("jobs")
public class Job {
    @Id private String id;
    private String type;
    private String status;
    private String relatedId;
    private int retryCount;
    private String error;
    private Instant createdAt;
    private Instant updatedAt;

    public Job() {}
    public String getId() { return this.id; }
    public void setId(String id) { this.id = id; }
    public String getType() { return this.type; }
    public void setType(String type) { this.type = type; }
    public String getStatus() { return this.status; }
    public void setStatus(String status) { this.status = status; }
    public String getRelatedId() { return this.relatedId; }
    public void setRelatedId(String relatedId) { this.relatedId = relatedId; }
    public int getRetryCount() { return this.retryCount; }
    public void setRetryCount(int retryCount) { this.retryCount = retryCount; }
    public String getError() { return this.error; }
    public void setError(String error) { this.error = error; }
    public Instant getCreatedAt() { return this.createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return this.updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

}
