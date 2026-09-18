package com.studycompanion.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document("quizzes")
public class Quiz {
    @Id private String id;
    private String projectId;
    private String userId;
    private String status;
    private Instant startedAt;
    private Instant completedAt;
    private Double score;

    public Quiz() {}
    public String getId() { return this.id; }
    public void setId(String id) { this.id = id; }
    public String getProjectId() { return this.projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public String getUserId() { return this.userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getStatus() { return this.status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getStartedAt() { return this.startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }
    public Instant getCompletedAt() { return this.completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }
    public Double getScore() { return this.score; }
    public void setScore(Double score) { this.score = score; }

}
