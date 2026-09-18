package com.studycompanion.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Document("assessments")
public class Assessment {
    @Id private String id;
    private String projectId;
    private String quizId;
    private String userId;
    private double score;
    private List<String> strengths = new ArrayList<>();
    private List<String> weaknesses = new ArrayList<>();
    private Instant createdAt;

    public Assessment() {}
    public String getId() { return this.id; }
    public void setId(String id) { this.id = id; }
    public String getProjectId() { return this.projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public String getQuizId() { return this.quizId; }
    public void setQuizId(String quizId) { this.quizId = quizId; }
    public String getUserId() { return this.userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public double getScore() { return this.score; }
    public void setScore(double score) { this.score = score; }
    public Instant getCreatedAt() { return this.createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }


    public List<String> getStrengths() { return this.strengths; }
    public void setStrengths(List<String> strengths) { this.strengths = strengths; }
    public List<String> getWeaknesses() { return this.weaknesses; }
    public void setWeaknesses(List<String> weaknesses) { this.weaknesses = weaknesses; }

}
