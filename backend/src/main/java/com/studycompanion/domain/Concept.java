package com.studycompanion.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document("concepts")
public class Concept {
    @Id private String id;
    private String projectId;
    private String name;
    private String description;
    private double masteryScore;
    private String trend;
    private Instant lastUpdated;

    public Concept() {}
    public String getId() { return this.id; }
    public void setId(String id) { this.id = id; }
    public String getProjectId() { return this.projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public String getName() { return this.name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return this.description; }
    public void setDescription(String description) { this.description = description; }
    public double getMasteryScore() { return this.masteryScore; }
    public void setMasteryScore(double masteryScore) { this.masteryScore = masteryScore; }
    public String getTrend() { return this.trend; }
    public void setTrend(String trend) { this.trend = trend; }
    public Instant getLastUpdated() { return this.lastUpdated; }
    public void setLastUpdated(Instant lastUpdated) { this.lastUpdated = lastUpdated; }

}
