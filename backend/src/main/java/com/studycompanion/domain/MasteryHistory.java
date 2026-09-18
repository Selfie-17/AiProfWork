package com.studycompanion.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document("mastery_history")
public class MasteryHistory {
    @Id private String id;
    private String projectId;
    private String conceptId;
    private String conceptName;
    private double score;
    private String source;
    private Instant timestamp;

    public MasteryHistory() {}
    public String getId() { return this.id; }
    public void setId(String id) { this.id = id; }
    public String getProjectId() { return this.projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public String getConceptId() { return this.conceptId; }
    public void setConceptId(String conceptId) { this.conceptId = conceptId; }
    public String getConceptName() { return this.conceptName; }
    public void setConceptName(String conceptName) { this.conceptName = conceptName; }
    public double getScore() { return this.score; }
    public void setScore(double score) { this.score = score; }
    public String getSource() { return this.source; }
    public void setSource(String source) { this.source = source; }
    public Instant getTimestamp() { return this.timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }

}
