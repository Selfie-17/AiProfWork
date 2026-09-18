package com.studycompanion.web;

import com.studycompanion.common.ApiResponse;
import com.studycompanion.domain.*;
import com.studycompanion.repo.*;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {
    private final UserRepository userRepository;
    private final SpaceRepository spaceRepository;
    private final ProjectRepository projectRepository;
    private final ActivityEventRepository activityEventRepository;
    private final AiUsageLogRepository aiUsageLogRepository;
    private final JobRepository jobRepository;
    private final AssessmentRepository assessmentRepository;
    private final ConceptRepository conceptRepository;
    private final MongoTemplate mongoTemplate;
    private final com.studycompanion.service.AiServiceClient aiServiceClient;
    private final com.studycompanion.service.QuotaService quotaService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private org.springframework.data.redis.core.StringRedisTemplate redisTemplate;

    public AdminController(UserRepository userRepository, SpaceRepository spaceRepository, ProjectRepository projectRepository, ActivityEventRepository activityEventRepository, AiUsageLogRepository aiUsageLogRepository, JobRepository jobRepository, AssessmentRepository assessmentRepository, ConceptRepository conceptRepository, MongoTemplate mongoTemplate, com.studycompanion.service.AiServiceClient aiServiceClient, com.studycompanion.service.QuotaService quotaService) {
        this.userRepository = userRepository;
        this.spaceRepository = spaceRepository;
        this.projectRepository = projectRepository;
        this.activityEventRepository = activityEventRepository;
        this.aiUsageLogRepository = aiUsageLogRepository;
        this.jobRepository = jobRepository;
        this.assessmentRepository = assessmentRepository;
        this.conceptRepository = conceptRepository;
        this.mongoTemplate = mongoTemplate;
        this.aiServiceClient = aiServiceClient;
        this.quotaService = quotaService;
    }

    @GetMapping("/users")
    public ApiResponse<List<Map<String, Object>>> users() {
        List<Map<String, Object>> rows = userRepository.findAll().stream().map(u -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", u.getId());
            m.put("name", u.getName());
            m.put("email", u.getEmail());
            m.put("role", u.getRole());
            m.put("createdAt", u.getCreatedAt());
            m.put("quota", quotaService.getQuotaSummary(u.getId()));
            return m;
        }).toList();
        return ApiResponse.ok(rows);
    }

    @GetMapping("/users/{id}")
    public ApiResponse<Map<String, Object>> userDetail(@PathVariable String id) {
        User user = userRepository.findById(id).orElseThrow();
        Map<String, Object> data = new HashMap<>();
        data.put("user", Map.of("id", user.getId(), "name", user.getName(), "email", user.getEmail(), "role", user.getRole()));
        data.put("quota", quotaService.getQuotaSummary(user.getId()));
        data.put("projects", projectRepository.findByUserId(id));
        data.put("activity", activityEventRepository.findByUserIdOrderByCreatedAtDesc(id));
        data.put("assessments", assessmentRepository.findByUserIdOrderByCreatedAtDesc(id));
        return ApiResponse.ok(data);
    }

    @PostMapping("/users/{id}/quota")
    public ApiResponse<Map<String, Object>> setQuota(@PathVariable String id, @RequestBody Map<String, Long> body) {
        Long limit = body.get("limit");
        if (limit != null && limit > 0) {
            quotaService.setUserLimit(id, limit);
        }
        return ApiResponse.ok(quotaService.getQuotaSummary(id));
    }

    @GetMapping("/projects")
    public ApiResponse<List<Map<String, Object>>> projects() {
        Map<String, User> userMap = userRepository.findAll().stream()
                .collect(Collectors.toMap(User::getId, u -> u, (a, b) -> a));
        Map<String, Space> spaceMap = spaceRepository.findAll().stream()
                .collect(Collectors.toMap(Space::getId, s -> s, (a, b) -> a));
        List<Map<String, Object>> rows = projectRepository.findAllByOrderByCreatedAtDesc().stream().map(p -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", p.getId());
            m.put("name", p.getName());
            m.put("description", p.getDescription());
            m.put("goal", p.getGoal());
            m.put("status", p.getStatus());
            m.put("createdAt", p.getCreatedAt());
            m.put("spaceId", p.getSpaceId());
            Space s = spaceMap.get(p.getSpaceId());
            m.put("spaceName", s != null ? s.getName() : "Unassigned Space");
            User u = userMap.get(p.getUserId());
            m.put("ownerName", u != null ? u.getName() : "Unknown User");
            m.put("ownerEmail", u != null ? u.getEmail() : "");
            return m;
        }).toList();
        return ApiResponse.ok(rows);
    }

    @GetMapping("/spaces")
    public ApiResponse<List<Map<String, Object>>> spaces() {
        Map<String, User> userMap = userRepository.findAll().stream()
                .collect(Collectors.toMap(User::getId, u -> u, (a, b) -> a));
        List<Map<String, Object>> rows = spaceRepository.findAllByOrderByCreatedAtDesc().stream().map(s -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", s.getId());
            m.put("name", s.getName());
            m.put("description", s.getDescription());
            m.put("colorTheme", s.getColorTheme());
            m.put("createdAt", s.getCreatedAt());
            User u = userMap.get(s.getUserId());
            m.put("ownerName", u != null ? u.getName() : "Unknown User");
            m.put("ownerEmail", u != null ? u.getEmail() : "");
            m.put("projectCount", projectRepository.findBySpaceId(s.getId()).size());
            return m;
        }).toList();
        return ApiResponse.ok(rows);
    }

    @GetMapping("/activity")
    public ApiResponse<List<ActivityEvent>> activity(@RequestParam(required = false) String type,
                                                     @RequestParam(required = false) String userId) {
        List<ActivityEvent> all = activityEventRepository.findAll();
        if (type != null) all = all.stream().filter(e -> type.equals(e.getType())).collect(Collectors.toList());
        if (userId != null) all = all.stream().filter(e -> userId.equals(e.getUserId())).collect(Collectors.toList());
        all.sort((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()));
        return ApiResponse.ok(all.stream().limit(200).toList());
    }

    @GetMapping("/ai-usage")
    public ApiResponse<Map<String, Object>> aiUsage() {
        List<AiUsageLog> logs = aiUsageLogRepository.findAllByOrderByCreatedAtDesc();
        double cost = logs.stream().mapToDouble(l -> l.getCostEstimate() == null ? 0 : l.getCostEstimate()).sum();
        long failures = logs.stream().filter(l -> "error".equalsIgnoreCase(l.getStatus()) || "failed".equalsIgnoreCase(l.getStatus())).count();
        double avgLatency = logs.stream().filter(l -> l.getLatencyMs() != null).mapToLong(AiUsageLog::getLatencyMs).average().orElse(0);
        long totalTokens = logs.stream().mapToLong(l -> (l.getTokensIn() == null ? 0 : l.getTokensIn()) + (l.getTokensOut() == null ? 0 : l.getTokensOut())).sum();
        Map<String, Long> byFeature = logs.stream().collect(Collectors.groupingBy(l -> l.getFeature() == null ? "unknown" : l.getFeature(), Collectors.counting()));
        Map<String, Long> byModel = logs.stream().collect(Collectors.groupingBy(l -> l.getModel() == null ? "unknown" : l.getModel(), Collectors.counting()));
        Map<String, Long> byProvider = logs.stream().collect(Collectors.groupingBy(l -> l.getProvider() == null ? "unknown" : l.getProvider(), Collectors.counting()));
        Map<String, Double> latencyByFeature = logs.stream()
                .filter(l -> l.getFeature() != null && l.getLatencyMs() != null)
                .collect(Collectors.groupingBy(AiUsageLog::getFeature, Collectors.averagingLong(AiUsageLog::getLatencyMs)));

        Map<String, Object> result = new HashMap<>();
        result.put("logs", logs.stream().limit(100).toList());
        result.put("totalCount", logs.size());
        result.put("totalCost", cost);
        result.put("totalTokens", totalTokens);
        result.put("failures", failures);
        result.put("avgLatencyMs", avgLatency);
        result.put("byFeature", byFeature);
        result.put("byModel", byModel);
        result.put("byProvider", byProvider);
        result.put("latencyByFeature", latencyByFeature);
        return ApiResponse.ok(result);
    }

    @GetMapping("/jobs")
    public ApiResponse<List<Job>> jobs() {
        return ApiResponse.ok(jobRepository.findAllByOrderByCreatedAtDesc());
    }

    @PostMapping("/jobs/{id}/retry")
    public ApiResponse<Job> retryJob(@PathVariable String id) {
        Job job = jobRepository.findById(id).orElseThrow();
        job.setStatus("QUEUED");
        job.setError(null);
        job.setUpdatedAt(java.time.Instant.now());
        return ApiResponse.ok(jobRepository.save(job));
    }

    @GetMapping("/learning-analytics")
    public ApiResponse<Map<String, Object>> learningAnalytics() {
        List<Assessment> assessments = assessmentRepository.findAll();
        List<Concept> concepts = conceptRepository.findAll();
        double avgScore = assessments.isEmpty() ? 0.0 : assessments.stream().mapToDouble(Assessment::getScore).average().orElse(0.0);
        double avgMastery = concepts.isEmpty() ? 0.0 : concepts.stream().mapToDouble(Concept::getMasteryScore).average().orElse(0.0);
        long improving = concepts.stream().filter(c -> "IMPROVING".equalsIgnoreCase(c.getTrend()) || c.getMasteryScore() >= 70).count();
        long attention = concepts.stream().filter(c -> "ATTENTION".equalsIgnoreCase(c.getTrend()) || c.getMasteryScore() < 50).count();
        long activeLearners = activityEventRepository.findAll().stream().map(ActivityEvent::getUserId).distinct().count();

        int d0_20 = 0, d21_40 = 0, d41_60 = 0, d61_80 = 0, d81_100 = 0;
        for (Concept c : concepts) {
            double s = c.getMasteryScore();
            if (s <= 20) d0_20++;
            else if (s <= 40) d21_40++;
            else if (s <= 60) d41_60++;
            else if (s <= 80) d61_80++;
            else d81_100++;
        }

        List<Map<String, Object>> trends = concepts.stream().limit(10).map(c -> {
            Map<String, Object> m = new HashMap<>();
            m.put("name", c.getName());
            m.put("score", Math.round(c.getMasteryScore()));
            m.put("trend", c.getTrend() != null ? c.getTrend() : (c.getMasteryScore() >= 60 ? "IMPROVING" : "ATTENTION"));
            return m;
        }).toList();

        Map<String, Object> data = new HashMap<>();
        data.put("totalQuizAttempts", assessments.size());
        data.put("avgAssessmentScore", Math.round(avgScore * 10.0) / 10.0);
        data.put("avgMastery", Math.round(avgMastery * 10.0) / 10.0);
        data.put("conceptsImproving", improving);
        data.put("conceptsAttention", attention);
        data.put("activeLearners", Math.max(activeLearners, userRepository.count()));
        data.put("distribution", List.of(
            Map.of("range", "0–20%", "count", d0_20),
            Map.of("range", "21–40%", "count", d21_40),
            Map.of("range", "41–60%", "count", d41_60),
            Map.of("range", "61–80%", "count", d61_80),
            Map.of("range", "81–100%", "count", d81_100)
        ));
        data.put("trends", trends);

        return ApiResponse.ok(data);
    }

    @GetMapping("/platform-activity")
    public ApiResponse<List<Map<String, Object>>> platformActivity() {
        java.time.LocalDate today = java.time.LocalDate.now();
        List<ActivityEvent> allActivity = activityEventRepository.findAll();
        List<AiUsageLog> allUsage = aiUsageLogRepository.findAll();

        List<Map<String, Object>> days = new ArrayList<>();
        java.time.format.DateTimeFormatter dtf = java.time.format.DateTimeFormatter.ofPattern("EEE");

        for (int i = 6; i >= 0; i--) {
            java.time.LocalDate d = today.minusDays(i);
            String dayName = d.format(dtf);

            long tutorCount = allUsage.stream()
                .filter(u -> "tutor".equalsIgnoreCase(u.getFeature()) && u.getCreatedAt() != null && u.getCreatedAt().atZone(java.time.ZoneId.systemDefault()).toLocalDate().equals(d))
                .count();
            long quizCount = allActivity.stream()
                .filter(a -> a.getType() != null && a.getType().toUpperCase().contains("QUIZ") && a.getCreatedAt() != null && a.getCreatedAt().atZone(java.time.ZoneId.systemDefault()).toLocalDate().equals(d))
                .count();
            long uploadCount = allActivity.stream()
                .filter(a -> a.getType() != null && a.getType().toUpperCase().contains("UPLOAD") && a.getCreatedAt() != null && a.getCreatedAt().atZone(java.time.ZoneId.systemDefault()).toLocalDate().equals(d))
                .count();
            long totalEvents = allActivity.stream()
                .filter(a -> a.getCreatedAt() != null && a.getCreatedAt().atZone(java.time.ZoneId.systemDefault()).toLocalDate().equals(d))
                .count();

            Map<String, Object> m = new HashMap<>();
            m.put("day", dayName);
            m.put("tutor", tutorCount);
            m.put("quiz", quizCount);
            m.put("uploads", uploadCount);
            m.put("questions", totalEvents);
            days.add(m);
        }
        return ApiResponse.ok(days);
    }

    @GetMapping("/health")
    public ApiResponse<Map<String, Object>> health() {
        Map<String, Object> health = new HashMap<>();
        long startMongo = System.currentTimeMillis();
        try {
            mongoTemplate.executeCommand("{ ping: 1 }");
            health.put("mongo", "healthy");
            health.put("mongoLatencyMs", Math.max(1, System.currentTimeMillis() - startMongo));
        } catch (Exception e) {
            health.put("mongo", "down");
            health.put("mongoLatencyMs", -1);
        }

        long startRedis = System.currentTimeMillis();
        try {
            if (redisTemplate != null && redisTemplate.getConnectionFactory() != null) {
                var conn = redisTemplate.getConnectionFactory().getConnection();
                conn.ping();
                conn.close();
                health.put("redis", "healthy");
                health.put("redisLatencyMs", Math.max(1, System.currentTimeMillis() - startRedis));
            } else {
                health.put("redis", "not_configured");
                health.put("redisLatencyMs", -1);
            }
        } catch (Exception e) {
            health.put("redis", "down");
            health.put("redisLatencyMs", -1);
        }

        long startAi = System.currentTimeMillis();
        try {
            Map<String, Object> aiHealth = aiServiceClient.get("/health");
            if (Boolean.TRUE.equals(aiHealth.get("ok")) || "ok".equalsIgnoreCase(String.valueOf(aiHealth.get("status")))) {
                health.put("aiService", "healthy");
            } else {
                health.put("aiService", "degraded");
            }
            health.put("aiServiceLatencyMs", Math.max(1, System.currentTimeMillis() - startAi));
        } catch (Exception e) {
            health.put("aiService", "down");
            health.put("aiServiceLatencyMs", -1);
        }

        health.put("api", "healthy");

        health.put("users", userRepository.count());
        health.put("jobsQueued", jobRepository.findAll().stream().filter(j -> "QUEUED".equals(j.getStatus())).count());

        List<Map<String, String>> recentErrors = aiUsageLogRepository.findAllByOrderByCreatedAtDesc().stream()
                .filter(l -> "error".equalsIgnoreCase(l.getStatus()) || "failed".equalsIgnoreCase(l.getStatus()) || l.getErrorMsg() != null)
                .limit(5)
                .map(l -> {
                    String timeStr = l.getCreatedAt() != null ? l.getCreatedAt().toString() : "";
                    if (timeStr.length() >= 16) timeStr = timeStr.substring(11, 16);
                    return Map.of(
                        "time", !timeStr.isEmpty() ? timeStr : "Recent",
                        "msg", l.getErrorMsg() != null ? l.getErrorMsg() : "AI " + l.getFeature() + " invocation error"
                    );
                }).toList();

        health.put("recentErrors", recentErrors);
        return ApiResponse.ok(health);
    }

    @PostMapping("/eval/run")
    public ApiResponse<Map<String, Object>> runEval() {
        return ApiResponse.ok(aiServiceClient.post("/eval/run", Map.of()));
    }

    @PostMapping("/retrieval/inspect")
    public ApiResponse<Map<String, Object>> inspectRetrieval(@RequestBody Map<String, Object> body) {
        return ApiResponse.ok(aiServiceClient.post("/retrieval/inspect", body));
    }

    // =========================================================================
    // AI PROVIDER MANAGEMENT — Proxies to FastAPI AI Service /providers/**
    // =========================================================================

    @GetMapping("/ai/providers")
    public ApiResponse<List<Map<String, Object>>> listProviders() {
        return ApiResponse.ok(aiServiceClient.getList("/providers"));
    }

    @GetMapping("/ai/providers/{provider}")
    public ApiResponse<Map<String, Object>> getProvider(@PathVariable String provider) {
        return ApiResponse.ok(aiServiceClient.get("/providers/" + provider));
    }

    @PostMapping("/ai/providers/{provider}")
    public ApiResponse<Map<String, Object>> saveProvider(@PathVariable String provider, @RequestBody Map<String, Object> body) {
        return ApiResponse.ok(aiServiceClient.post("/providers/" + provider, body));
    }

    @PostMapping("/ai/providers/{provider}/test")
    public ApiResponse<Map<String, Object>> testProvider(@PathVariable String provider, @RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.ok(aiServiceClient.post("/providers/" + provider + "/test", body != null ? body : Map.of()));
    }

    @DeleteMapping("/ai/providers/{provider}")
    public ApiResponse<Map<String, Object>> deleteProvider(@PathVariable String provider) {
        return ApiResponse.ok(aiServiceClient.delete("/providers/" + provider));
    }

    @GetMapping("/ai/providers/{provider}/models")
    public ApiResponse<Map<String, Object>> providerModels(@PathVariable String provider) {
        return ApiResponse.ok(aiServiceClient.get("/providers/" + provider + "/models"));
    }
}