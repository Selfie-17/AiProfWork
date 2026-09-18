package com.studycompanion.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "flashcards")
public class Flashcard {
    @Id
    private String id;
    private String projectId;
    private String userId;
    private String conceptName;
    private String front;
    private String back;
    private int interval = 1;         // Days until next review
    private int repetitions = 0;      // Consecutive successful recalls
    private double easeFactor = 2.5;  // SM-2 ease factor (>= 1.3)
    private Instant nextReviewDate = Instant.now();
    private Instant lastReviewedAt;
    private Instant createdAt = Instant.now();

    public Flashcard() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getConceptName() { return conceptName; }
    public void setConceptName(String conceptName) { this.conceptName = conceptName; }

    public String getFront() { return front; }
    public void setFront(String front) { this.front = front; }

    public String getBack() { return back; }
    public void setBack(String back) { this.back = back; }

    public int getInterval() { return interval; }
    public void setInterval(int interval) { this.interval = interval; }

    public int getRepetitions() { return repetitions; }
    public void setRepetitions(int repetitions) { this.repetitions = repetitions; }

    public double getEaseFactor() { return easeFactor; }
    public void setEaseFactor(double easeFactor) { this.easeFactor = easeFactor; }

    public Instant getNextReviewDate() { return nextReviewDate; }
    public void setNextReviewDate(Instant nextReviewDate) { this.nextReviewDate = nextReviewDate; }

    public Instant getLastReviewedAt() { return lastReviewedAt; }
    public void setLastReviewedAt(Instant lastReviewedAt) { this.lastReviewedAt = lastReviewedAt; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
