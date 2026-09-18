package com.studycompanion.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Map;

@Document("activity_events")
public class ActivityEvent {
    @Id private String id;
    @Indexed private String userId;
    private String projectId;
    private String type;
    private Map<String, Object> metadata;
    @Indexed(unique = true) private String idempotencyKey;
    private Instant createdAt;

    public ActivityEvent() {}
    public String getId() { return this.id; }
    public void setId(String id) { this.id = id; }
    public String getUserId() { return this.userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getProjectId() { return this.projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public String getType() { return this.type; }
    public void setType(String type) { this.type = type; }
    public Map<String, Object> getMetadata() { return this.metadata; }
    public void setMetadata(Map<String, Object> metadata) { this.metadata = metadata; }
    public String getIdempotencyKey() { return this.idempotencyKey; }
    public void setIdempotencyKey(String idempotencyKey) { this.idempotencyKey = idempotencyKey; }
    public Instant getCreatedAt() { return this.createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

}
