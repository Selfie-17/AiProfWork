package com.studycompanion.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Document("learning_context")
public class LearningContext {
    @Id private String id;
    private String projectId;
    private String userId;
    private String goals;
    private List<String> strengths = new ArrayList<>();
    private List<String> weaknesses = new ArrayList<>();
    private List<String> repeatedMistakes = new ArrayList<>();
    private Instant lastUpdated;

    public LearningContext() {}
    public String getId() { return this.id; }
    public void setId(String id) { this.id = id; }
    public String getProjectId() { return this.projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public String getUserId() { return this.userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getGoals() { return this.goals; }
    public void setGoals(String goals) { this.goals = goals; }
    public Instant getLastUpdated() { return this.lastUpdated; }
    public void setLastUpdated(Instant lastUpdated) { this.lastUpdated = lastUpdated; }


    public List<String> getStrengths() { return this.strengths; }
    public void setStrengths(List<String> strengths) { this.strengths = strengths; }
    public List<String> getWeaknesses() { return this.weaknesses; }
    public void setWeaknesses(List<String> weaknesses) { this.weaknesses = weaknesses; }
    public List<String> getRepeatedMistakes() { return this.repeatedMistakes; }
    public void setRepeatedMistakes(List<String> repeatedMistakes) { this.repeatedMistakes = repeatedMistakes; }

}
