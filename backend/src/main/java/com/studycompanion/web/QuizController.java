package com.studycompanion.web;

import com.studycompanion.common.ApiException;
import com.studycompanion.common.ApiResponse;
import com.studycompanion.domain.*;
import com.studycompanion.repo.*;
import com.studycompanion.security.UserPrincipal;
import com.studycompanion.service.AccessGuard;
import com.studycompanion.service.ActivityService;
import com.studycompanion.service.AiServiceClient;
import com.studycompanion.service.QuotaService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;

@RestController
public class QuizController {
    private final AccessGuard accessGuard;
    private final QuizRepository quizRepository;
    private final QuizQuestionRepository quizQuestionRepository;
    private final ConceptRepository conceptRepository;
    private final AssessmentRepository assessmentRepository;
    private final MasteryHistoryRepository masteryHistoryRepository;
    private final LearningContextRepository learningContextRepository;
    private final RecommendationRepository recommendationRepository;
    private final AiServiceClient aiServiceClient;
    private final ActivityService activityService;
    private final LearnerMistakeRepository learnerMistakeRepository;
    private final QuotaService quotaService;

    public QuizController(AccessGuard accessGuard, QuizRepository quizRepository, QuizQuestionRepository quizQuestionRepository, ConceptRepository conceptRepository, AssessmentRepository assessmentRepository, MasteryHistoryRepository masteryHistoryRepository, LearningContextRepository learningContextRepository, RecommendationRepository recommendationRepository, AiServiceClient aiServiceClient, ActivityService activityService, LearnerMistakeRepository learnerMistakeRepository, QuotaService quotaService) {
        this.accessGuard = accessGuard;
        this.quizRepository = quizRepository;
        this.quizQuestionRepository = quizQuestionRepository;
        this.conceptRepository = conceptRepository;
        this.assessmentRepository = assessmentRepository;
        this.masteryHistoryRepository = masteryHistoryRepository;
        this.learningContextRepository = learningContextRepository;
        this.recommendationRepository = recommendationRepository;
        this.aiServiceClient = aiServiceClient;
        this.activityService = activityService;
        this.learnerMistakeRepository = learnerMistakeRepository;
        this.quotaService = quotaService;
    }


    @PostMapping("/api/quiz/start")
    public ApiResponse<Map<String, Object>> start(@AuthenticationPrincipal UserPrincipal user,
                                                  @RequestBody Map<String, String> body) {
        String projectId = body.get("projectId");
        accessGuard.requireProject(projectId);
        quizRepository.findFirstByProjectIdAndUserIdAndStatus(projectId, user.getId(), "IN_PROGRESS")
                .ifPresent(q -> {
                    q.setStatus("ABANDONED");
                    quizRepository.save(q);
                });
        Quiz quiz = new Quiz();
        quiz.setProjectId(projectId);
        quiz.setUserId(user.getId());
        quiz.setStatus("IN_PROGRESS");
        quiz.setStartedAt(Instant.now());
        quiz = quizRepository.save(quiz);
        activityService.record(user.getId(), projectId, "QUIZ_STARTED", Map.of("quizId", quiz.getId()), "quiz-start:" + quiz.getId());
        return nextQuestion(quiz);
    }

    @GetMapping("/api/quiz/{id}")
    public ApiResponse<Map<String, Object>> get(@PathVariable String id) {
        Quiz quiz = quizRepository.findById(id).orElseThrow(() -> ApiException.notFound("Quiz not found"));
        accessGuard.requireProject(quiz.getProjectId());
        List<QuizQuestion> questions = quizQuestionRepository.findByQuizIdOrderByIdAsc(id);
        Map<String, Object> data = new HashMap<>();
        data.put("quiz", quiz);
        data.put("questions", questions);
        return ApiResponse.ok(data);
    }

    @PostMapping("/api/quiz/{id}/answer")
    public ApiResponse<Map<String, Object>> answer(@PathVariable String id,
                                                   @AuthenticationPrincipal UserPrincipal user,
                                                   @Valid @RequestBody AnswerReq req) {
        Quiz quiz = quizRepository.findById(id).orElseThrow(() -> ApiException.notFound("Quiz not found"));
        accessGuard.requireProject(quiz.getProjectId());
        if (!"IN_PROGRESS".equals(quiz.getStatus())) throw ApiException.badRequest("Quiz is not active");
        QuizQuestion q = quizQuestionRepository.findById(req.getQuestionId())
                .orElseThrow(() -> ApiException.notFound("Question not found"));
        if (!q.getQuizId().equals(id)) throw ApiException.badRequest("Question does not belong to quiz");
        if (q.getUserAnswer() != null) throw ApiException.badRequest("Already answered");

        q.setUserAnswer(req.getAnswer());
        q.setAnsweredAt(Instant.now());

        Map<String, Object> evaluation;
        if ("MCQ".equals(q.getType())) {
            boolean correct = q.getCorrectAnswer() != null && q.getCorrectAnswer().trim().equalsIgnoreCase(req.getAnswer().trim());
            evaluation = new LinkedHashMap<>();
            evaluation.put("correct", correct);
            evaluation.put("score", correct ? 1.0 : 0.0);
            evaluation.put("correctAnswer", q.getCorrectAnswer());
            String explanation = "";
            if (q.getEvaluation() != null && q.getEvaluation().get("explanation") != null) {
                explanation = String.valueOf(q.getEvaluation().get("explanation"));
            }
            evaluation.put("explanation", explanation);
            evaluation.put("understood", correct ? List.of("Selected the correct principle: " + q.getCorrectAnswer()) : List.of());
            evaluation.put("missing", correct ? List.of() : List.of("Correct answer was: " + q.getCorrectAnswer()));
            String fb = correct
                    ? "✓ Correct! " + (explanation.isBlank() ? "Great job applying this concept from your notes." : explanation)
                    : "✗ Not quite. The correct answer is: \"" + q.getCorrectAnswer() + "\"." + (explanation.isBlank() ? "" : "\n\n" + explanation);
            evaluation.put("feedback", fb);
        } else {
            Map<String, Object> ai = aiServiceClient.post("/quiz/evaluate-open-ended", Map.of(
                    "projectId", quiz.getProjectId(),
                    "question", q.getQuestion(),
                    "expected", q.getCorrectAnswer() == null ? "" : q.getCorrectAnswer(),
                    "answer", req.getAnswer(),
                    "concept", q.getConceptName() == null ? "" : q.getConceptName()
            ));
            evaluation = new LinkedHashMap<>(ai);
            if (!ai.containsKey("score")) {
                evaluation.put("score", 0.4);
                evaluation.put("feedback", ai.getOrDefault("error", "Evaluation fallback used."));
                evaluation.put("understood", List.of());
                evaluation.put("missing", List.of("Could not fully grade this answer"));
            }

        }
        q.setEvaluation(evaluation);
        quizQuestionRepository.save(q);

        Object s = evaluation.get("score");
        double scoreVal = s instanceof Number n ? n.doubleValue() : 0.0;
        if (scoreVal < 0.7) {
            LearnerMistake lm = new LearnerMistake();
            lm.setProjectId(quiz.getProjectId());
            lm.setUserId(user.getId());
            lm.setQuizId(quiz.getId());
            lm.setQuestionId(q.getId());
            lm.setConceptName(q.getConceptName());
            lm.setQuestionText(q.getQuestion());
            lm.setSelectedAnswer(req.getAnswer());
            lm.setCorrectAnswer(q.getCorrectAnswer());
            lm.setExplanation(String.valueOf(evaluation.getOrDefault("explanation", evaluation.getOrDefault("feedback", ""))));
            lm.setScore(scoreVal);
            lm.setCreatedAt(Instant.now());
            learnerMistakeRepository.save(lm);
        }

        updateMastery(quiz, q, evaluation);
        activityService.record(user.getId(), quiz.getProjectId(), "QUIZ_ANSWERED",
                Map.of("quizId", quiz.getId(), "questionId", q.getId()),
                "quiz-ans:" + q.getId());
        return ApiResponse.ok(Map.of("question", q, "evaluation", evaluation));
    }

    @PostMapping("/api/quiz/{id}/next")
    public ApiResponse<Map<String, Object>> next(@PathVariable String id) {
        Quiz quiz = quizRepository.findById(id).orElseThrow(() -> ApiException.notFound("Quiz not found"));
        accessGuard.requireProject(quiz.getProjectId());
        if (!"IN_PROGRESS".equals(quiz.getStatus())) throw ApiException.badRequest("Quiz is not active");
        List<QuizQuestion> existing = quizQuestionRepository.findByQuizIdOrderByIdAsc(id);
        if (existing.size() >= 5) {
            return completeInternal(quiz);
        }
        return nextQuestion(quiz);
    }

    @PostMapping("/api/quiz/{id}/complete")
    public ApiResponse<Map<String, Object>> complete(@PathVariable String id, @AuthenticationPrincipal UserPrincipal user) {
        Quiz quiz = quizRepository.findById(id).orElseThrow(() -> ApiException.notFound("Quiz not found"));
        accessGuard.requireProject(quiz.getProjectId());
        return completeInternal(quiz);
    }

    private ApiResponse<Map<String, Object>> completeInternal(Quiz quiz) {
        List<QuizQuestion> questions = quizQuestionRepository.findByQuizIdOrderByIdAsc(quiz.getId());
        double score = questions.stream()
                .mapToDouble(q -> {
                    Object s = q.getEvaluation() == null ? 0 : q.getEvaluation().get("score");
                    if (s instanceof Number n) return n.doubleValue();
                    return 0;
                }).average().orElse(0);
        quiz.setStatus("COMPLETED");
        quiz.setCompletedAt(Instant.now());
        quiz.setScore(score * 100);
        quizRepository.save(quiz);

        List<String> strengths = new ArrayList<>();
        List<String> weaknesses = new ArrayList<>();
        for (QuizQuestion q : questions) {
            Object s = q.getEvaluation() == null ? 0 : q.getEvaluation().get("score");
            double val = s instanceof Number n ? n.doubleValue() : 0;
            if (val >= 0.7) strengths.add(q.getConceptName());
            else weaknesses.add(q.getConceptName());
        }
        Assessment assessment = new Assessment();
        assessment.setProjectId(quiz.getProjectId());
        assessment.setQuizId(quiz.getId());
        assessment.setUserId(quiz.getUserId());
        assessment.setScore(quiz.getScore());
        assessment.setStrengths(strengths.stream().filter(Objects::nonNull).distinct().toList());
        assessment.setWeaknesses(weaknesses.stream().filter(Objects::nonNull).distinct().toList());
        assessment.setCreatedAt(Instant.now());
        assessmentRepository.save(assessment);

        updateLearningContext(quiz, assessment);
        maybeRecommend(quiz, assessment);

        activityService.record(quiz.getUserId(), quiz.getProjectId(), "QUIZ_COMPLETED",
                Map.of("quizId", quiz.getId(), "score", quiz.getScore()),
                "quiz-complete:" + quiz.getId());
        return ApiResponse.ok(Map.of("quiz", quiz, "assessment", assessment, "questions", questions));
    }

    private ApiResponse<Map<String, Object>> nextQuestion(Quiz quiz) {
        List<Concept> concepts = conceptRepository.findByProjectId(quiz.getProjectId());
        Concept target = pickConcept(quiz, concepts);
        String difficulty = pickDifficulty(target);
        Map<String, Object> ai = aiServiceClient.post("/quiz/generate-question", Map.of(
                "projectId", quiz.getProjectId(),
                "concept", target == null ? "general" : target.getName(),
                "difficulty", difficulty,
                "mastery", target == null ? 40 : target.getMasteryScore()
        ));
        if (Boolean.FALSE.equals(ai.get("ok")) || "NO_MATERIALS".equals(String.valueOf(ai.get("code")))) {
            throw ApiException.badRequest("Upload a PDF and wait until it is Ready before starting a quiz.");
        }
        QuizQuestion q = new QuizQuestion();
        q.setQuizId(quiz.getId());
        q.setProjectId(quiz.getProjectId());
        q.setType(String.valueOf(ai.getOrDefault("type", "MCQ")));
        q.setConceptId(target == null ? null : target.getId());
        q.setConceptName(target == null ? String.valueOf(ai.getOrDefault("concept", "general")) : target.getName());
        q.setDifficulty(difficulty);
        q.setQuestion(String.valueOf(ai.getOrDefault("question", "What is the core idea of this material?")));
        Object opts = ai.get("options");
        if (opts instanceof List<?> list) {
            q.setOptions(list.stream().map(String::valueOf).toList());
        }
        q.setCorrectAnswer(ai.get("correctAnswer") == null ? null : String.valueOf(ai.get("correctAnswer")));
        Map<String, Object> initialEval = new LinkedHashMap<>();
        if (ai.get("explanation") != null) {
            initialEval.put("explanation", String.valueOf(ai.get("explanation")));
        }
        q.setEvaluation(initialEval);
        q = quizQuestionRepository.save(q);

        Map<String, Object> safe = new LinkedHashMap<>();
        safe.put("id", q.getId());
        safe.put("quizId", q.getQuizId());
        safe.put("type", q.getType());
        safe.put("conceptName", q.getConceptName());
        safe.put("difficulty", q.getDifficulty());
        safe.put("question", q.getQuestion());
        safe.put("options", q.getOptions());
        return ApiResponse.ok(Map.of("quiz", quiz, "question", safe));
    }

    private Concept pickConcept(Quiz quiz, List<Concept> concepts) {
        if (concepts.isEmpty()) return null;
        List<QuizQuestion> existing = quizQuestionRepository.findByQuizIdOrderByIdAsc(quiz.getId());
        Set<String> asked = new HashSet<>();
        for (QuizQuestion qq : existing) {
            if (qq.getConceptName() != null) {
                asked.add(qq.getConceptName().toLowerCase().trim());
            }
        }
        List<Concept> unasked = concepts.stream()
                .filter(c -> !asked.contains(c.getName().toLowerCase().trim()))
                .toList();

        List<Concept> pool = unasked.isEmpty() ? concepts : unasked;
        return pool.stream()
                .min(Comparator.comparingDouble(Concept::getMasteryScore)
                        .thenComparing(c -> "ATTENTION".equals(c.getTrend()) ? 0 : 1))
                .orElse(pool.get(0));
    }

    private String pickDifficulty(Concept concept) {
        if (concept == null) return "medium";
        if (concept.getMasteryScore() < 40) return "easy";
        if (concept.getMasteryScore() > 75) return "hard";
        return "medium";
    }

    private void updateMastery(Quiz quiz, QuizQuestion q, Map<String, Object> evaluation) {
        if (q.getConceptName() == null) return;
        Concept concept = conceptRepository.findByProjectIdAndNameIgnoreCase(quiz.getProjectId(), q.getConceptName())
                .orElseGet(() -> {
                    Concept c = new Concept();
                    c.setProjectId(quiz.getProjectId());
                    c.setName(q.getConceptName());
                    c.setMasteryScore(40);
                    c.setTrend("STABLE");
                    c.setLastUpdated(Instant.now());
                    return conceptRepository.save(c);
                });
        double eventScore = 0;
        Object s = evaluation.get("score");
        if (s instanceof Number n) eventScore = n.doubleValue() * 100;
        double diffW = switch (q.getDifficulty() == null ? "medium" : q.getDifficulty()) {
            case "easy" -> 0.85;
            case "hard" -> 1.15;
            default -> 1.0;
        };
        double updated = concept.getMasteryScore() * 0.72 + (eventScore * diffW) * 0.28;
        updated = Math.max(0, Math.min(100, updated));
        concept.setMasteryScore(updated);
        concept.setLastUpdated(Instant.now());
        conceptRepository.save(concept);

        MasteryHistory history = new MasteryHistory();
        history.setProjectId(quiz.getProjectId());
        history.setConceptId(concept.getId());
        history.setConceptName(concept.getName());
        history.setScore(updated);
        history.setSource("QUIZ");
        history.setTimestamp(Instant.now());
        masteryHistoryRepository.save(history);
        refreshTrend(concept);
    }

    private void refreshTrend(Concept concept) {
        List<MasteryHistory> hist = masteryHistoryRepository.findByProjectIdAndConceptIdOrderByTimestampAsc(
                concept.getProjectId(), concept.getId());
        if (hist.size() < 2) {
            concept.setTrend("STABLE");
        } else {
            double first = hist.get(Math.max(0, hist.size() - 4)).getScore();
            double last = hist.get(hist.size() - 1).getScore();
            double delta = last - first;
            if (delta >= 8) concept.setTrend("IMPROVING");
            else if (delta <= -5 || last < 45) concept.setTrend("ATTENTION");
            else concept.setTrend("STABLE");
        }
        conceptRepository.save(concept);
    }

    private void updateLearningContext(Quiz quiz, Assessment assessment) {
        LearningContext ctx = learningContextRepository.findByProjectIdAndUserId(quiz.getProjectId(), quiz.getUserId())
                .orElseGet(() -> {
                    LearningContext c = new LearningContext();
                    c.setProjectId(quiz.getProjectId());
                    c.setUserId(quiz.getUserId());
                    return c;
                });
        ctx.setGoals(accessGuard.requireProject(quiz.getProjectId()).getGoal());
        ctx.setStrengths(assessment.getStrengths());
        ctx.setWeaknesses(assessment.getWeaknesses());
        List<QuizQuestion> all = quizQuestionRepository.findByProjectId(quiz.getProjectId());
        Map<String, Integer> misses = new HashMap<>();
        for (QuizQuestion qq : all) {
            Object s = qq.getEvaluation() == null ? null : qq.getEvaluation().get("score");
            double val = s instanceof Number n ? n.doubleValue() : 1;
            if (val < 0.6 && qq.getConceptName() != null) {
                misses.merge(qq.getConceptName(), 1, Integer::sum);
            }
        }
        List<String> repeated = misses.entrySet().stream()
                .filter(e -> e.getValue() >= 2)
                .map(Map.Entry::getKey)
                .toList();
        ctx.setRepeatedMistakes(repeated);
        ctx.setLastUpdated(Instant.now());
        learningContextRepository.save(ctx);
    }

    private void maybeRecommend(Quiz quiz, Assessment assessment) {
        Map<String, Object> ai = aiServiceClient.post("/recommend/generate", Map.of(
                "projectId", quiz.getProjectId(),
                "weaknesses", assessment.getWeaknesses(),
                "strengths", assessment.getStrengths(),
                "score", assessment.getScore()
        ));
        Recommendation rec = new Recommendation();
        rec.setProjectId(quiz.getProjectId());
        rec.setUserId(quiz.getUserId());
        rec.setText(String.valueOf(ai.getOrDefault("text",
                "Review weaker concepts, then retry a short quiz focusing on missed ideas.")));
        rec.setReason(String.valueOf(ai.getOrDefault("reason", "Based on latest assessment")));
        rec.setStatus("ACTIVE");
        rec.setCreatedAt(Instant.now());
        recommendationRepository.save(rec);
    }

    public static class AnswerReq  {

        @NotBlank private String questionId;
        @NotBlank private String answer;
    

        public AnswerReq() {}
        public String getQuestionId() { return this.questionId; }
    public void setQuestionId(String questionId) { this.questionId = questionId; }
        public String getAnswer() { return this.answer; }
    public void setAnswer(String answer) { this.answer = answer; }
    }
}