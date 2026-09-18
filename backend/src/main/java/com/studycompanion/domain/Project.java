package com.studycompanion.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document("projects")
public class Project {
    @Id private String id;
    private String spaceId;
    @Indexed private String userId;
    private String name;
    private String description;
    private String goal;
    private String status;
    private Instant createdAt;

    public Project() {}
    public String getId() { return this.id; }
    public void setId(String id) { this.id = id; }
    public String getSpaceId() { return this.spaceId; }
    public void setSpaceId(String spaceId) { this.spaceId = spaceId; }
    public String getUserId() { return this.userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getName() { return this.name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return this.description; }
    public void setDescription(String description) { this.description = description; }
    public String getGoal() { return this.goal; }
    public void setGoal(String goal) { this.goal = goal; }
    public String getStatus() { return this.status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getCreatedAt() { return this.createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

}
