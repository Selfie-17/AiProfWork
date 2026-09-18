package com.studycompanion.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Document(collection = "study_plans")
public class StudyPlan {
    @Id
    private String id;
    private String projectId;
    private String userId;
    private String title;
    private String overview;
    private int targetCompletionDays = 14;
    private List<Map<String, Object>> milestones = new ArrayList<>();
    private List<Integer> completedMilestones = new ArrayList<>();
    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();

    public StudyPlan() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getOverview() { return overview; }
    public void setOverview(String overview) { this.overview = overview; }

    public int getTargetCompletionDays() { return targetCompletionDays; }
    public void setTargetCompletionDays(int targetCompletionDays) { this.targetCompletionDays = targetCompletionDays; }

    public List<Map<String, Object>> getMilestones() { return milestones; }
    public void setMilestones(List<Map<String, Object>> milestones) { this.milestones = milestones; }

    public List<Integer> getCompletedMilestones() { return completedMilestones; }
    public void setCompletedMilestones(List<Integer> completedMilestones) { this.completedMilestones = completedMilestones; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
