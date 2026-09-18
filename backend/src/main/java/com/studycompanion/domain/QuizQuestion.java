package com.studycompanion.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Document("quiz_questions")
public class QuizQuestion {
    @Id private String id;
    private String quizId;
    private String projectId;
    private String type;
    private String conceptId;
    private String conceptName;
    private String difficulty;
    private String question;
    private List<String> options;
    private String correctAnswer;
    private String userAnswer;
    private Map<String, Object> evaluation;
    private Instant answeredAt;

    public QuizQuestion() {}
    public String getId() { return this.id; }
    public void setId(String id) { this.id = id; }
    public String getQuizId() { return this.quizId; }
    public void setQuizId(String quizId) { this.quizId = quizId; }
    public String getProjectId() { return this.projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public String getType() { return this.type; }
    public void setType(String type) { this.type = type; }
    public String getConceptId() { return this.conceptId; }
    public void setConceptId(String conceptId) { this.conceptId = conceptId; }
    public String getConceptName() { return this.conceptName; }
    public void setConceptName(String conceptName) { this.conceptName = conceptName; }
    public String getDifficulty() { return this.difficulty; }
    public void setDifficulty(String difficulty) { this.difficulty = difficulty; }
    public String getQuestion() { return this.question; }
    public void setQuestion(String question) { this.question = question; }
    public List<String> getOptions() { return this.options; }
    public void setOptions(List<String> options) { this.options = options; }
    public String getCorrectAnswer() { return this.correctAnswer; }
    public void setCorrectAnswer(String correctAnswer) { this.correctAnswer = correctAnswer; }
    public String getUserAnswer() { return this.userAnswer; }
    public void setUserAnswer(String userAnswer) { this.userAnswer = userAnswer; }
    public Map<String, Object> getEvaluation() { return this.evaluation; }
    public void setEvaluation(Map<String, Object> evaluation) { this.evaluation = evaluation; }
    public Instant getAnsweredAt() { return this.answeredAt; }
    public void setAnsweredAt(Instant answeredAt) { this.answeredAt = answeredAt; }

}
