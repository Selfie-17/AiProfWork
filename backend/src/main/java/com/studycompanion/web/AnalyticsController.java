package com.studycompanion.web;

import com.studycompanion.common.ApiResponse;
import com.studycompanion.domain.*;
import com.studycompanion.repo.*;
import com.studycompanion.security.UserPrincipal;
import com.studycompanion.service.AccessGuard;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@RestController
public class AnalyticsController {
    private final AccessGuard accessGuard;
    private final ActivityEventRepository activityEventRepository;
    private final AssessmentRepository assessmentRepository;
    private final ConceptRepository conceptRepository;
    private final AiUsageLogRepository aiUsageLogRepository;
    private final ProjectRepository projectRepository;
    private final QuizRepository quizRepository;

    public AnalyticsController(AccessGuard accessGuard, ActivityEventRepository activityEventRepository, AssessmentRepository assessmentRepository, ConceptRepository conceptRepository, AiUsageLogRepository aiUsageLogRepository, ProjectRepository projectRepository, QuizRepository quizRepository) {
        this.accessGuard = accessGuard;
        this.activityEventRepository = activityEventRepository;
        this.assessmentRepository = assessmentRepository;
        this.conceptRepository = conceptRepository;
        this.aiUsageLogRepository = aiUsageLogRepository;
        this.projectRepository = projectRepository;
        this.quizRepository = quizRepository;
    }


    @GetMapping("/api/analytics/project/{id}")
    public ApiResponse<Map<String, Object>> project(@PathVariable String id) {
        accessGuard.requireProject(id);
        List<ActivityEvent> events = activityEventRepository.findByProjectIdOrderByCreatedAtDesc(id);
        List<Assessment> assessments = assessmentRepository.findByProjectIdOrderByCreatedAtDesc(id);
        List<Concept> concepts = conceptRepository.findByProjectId(id);
        Map<String, Long> byDay = events.stream().collect(Collectors.groupingBy(
                e -> e.getCreatedAt() == null ? "unknown" : e.getCreatedAt().truncatedTo(ChronoUnit.DAYS).toString(),
                Collectors.counting()));
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("activityByDay", byDay);
        data.put("assessments", assessments);
        data.put("concepts", concepts);
        data.put("eventCount", events.size());
        data.put("avgQuizScore", assessments.stream().mapToDouble(Assessment::getScore).average().orElse(0));
        return ApiResponse.ok(data);
    }

    @GetMapping("/api/analytics/global")
    public ApiResponse<Map<String, Object>> global(@AuthenticationPrincipal UserPrincipal user) {
        List<Project> projects = (user != null && "ADMIN".equalsIgnoreCase(user.getRole()))
                ? projectRepository.findAllByOrderByCreatedAtDesc()
                : projectRepository.findByUserId(user.getId());
        List<Map<String, Object>> rows = new ArrayList<>();
        int events = 0;
        double masterySum = 0;
        int masteryN = 0;
        for (Project p : projects) {
            List<Concept> concepts = conceptRepository.findByProjectId(p.getId());
            List<ActivityEvent> ev = activityEventRepository.findByProjectIdOrderByCreatedAtDesc(p.getId());
            events += ev.size();
            double avg = concepts.stream().mapToDouble(Concept::getMasteryScore).average().orElse(0);
            if (!concepts.isEmpty()) {
                masterySum += avg;
                masteryN++;
            }
            rows.add(Map.of(
                    "projectId", p.getId(),
                    "name", p.getName(),
                    "avgMastery", avg,
                    "activity", ev.size()
            ));
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("projects", rows);
        data.put("totalProjects", projects.size());
        data.put("totalEvents", events);
        data.put("overallMastery", masteryN == 0 ? 0 : masterySum / masteryN);
        return ApiResponse.ok(data);
    }

    @GetMapping("/api/activity/{projectId}")
    public ApiResponse<List<ActivityEvent>> activity(@PathVariable String projectId) {
        accessGuard.requireProject(projectId);
        return ApiResponse.ok(activityEventRepository.findByProjectIdOrderByCreatedAtDesc(projectId));
    }
}