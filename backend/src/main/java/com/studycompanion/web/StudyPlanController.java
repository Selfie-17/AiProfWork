package com.studycompanion.web;

import com.studycompanion.common.ApiException;
import com.studycompanion.common.ApiResponse;
import com.studycompanion.domain.Concept;
import com.studycompanion.domain.Material;
import com.studycompanion.domain.Project;
import com.studycompanion.domain.StudyPlan;
import com.studycompanion.repo.ConceptRepository;
import com.studycompanion.repo.MaterialRepository;
import com.studycompanion.repo.StudyPlanRepository;
import com.studycompanion.security.UserPrincipal;
import com.studycompanion.service.AccessGuard;
import com.studycompanion.service.ActivityService;
import com.studycompanion.service.AiServiceClient;
import com.studycompanion.service.QuotaService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
public class StudyPlanController {
    private final AccessGuard accessGuard;
    private final StudyPlanRepository studyPlanRepository;
    private final ConceptRepository conceptRepository;
    private final MaterialRepository materialRepository;
    private final AiServiceClient aiServiceClient;
    private final ActivityService activityService;
    private final QuotaService quotaService;

    public StudyPlanController(AccessGuard accessGuard, StudyPlanRepository studyPlanRepository, ConceptRepository conceptRepository, MaterialRepository materialRepository, AiServiceClient aiServiceClient, ActivityService activityService, QuotaService quotaService) {
        this.accessGuard = accessGuard;
        this.studyPlanRepository = studyPlanRepository;
        this.conceptRepository = conceptRepository;
        this.materialRepository = materialRepository;
        this.aiServiceClient = aiServiceClient;
        this.activityService = activityService;
        this.quotaService = quotaService;
    }

    @GetMapping("/api/projects/{projectId}/study-plan")
    public ApiResponse<StudyPlan> getPlan(@PathVariable String projectId, @AuthenticationPrincipal UserPrincipal user) {
        accessGuard.requireProject(projectId);
        StudyPlan plan = studyPlanRepository.findByProjectIdAndUserId(projectId, user.getId()).orElse(null);
        return ApiResponse.ok(plan);
    }

    @PostMapping("/api/projects/{projectId}/study-plan/generate")
    public ApiResponse<StudyPlan> generate(@PathVariable String projectId, @AuthenticationPrincipal UserPrincipal user) {
        Project project = accessGuard.requireProject(projectId);
        quotaService.checkQuota(user.getId(), 500);

        List<Concept> weak = conceptRepository.findByProjectId(projectId).stream()
                .filter(c -> c.getMasteryScore() < 60 || "ATTENTION".equalsIgnoreCase(c.getTrend()))
                .toList();
        List<String> weakNames = weak.stream().map(Concept::getName).limit(6).toList();
        List<String> materialNames = materialRepository.findByProjectId(projectId).stream().map(Material::getFileName).toList();

        Map<String, Object> ai = aiServiceClient.post("/growth/study-plan", Map.of(
                "projectId", projectId,
                "goal", project.getGoal() == null ? "Mastery" : project.getGoal(),
                "weakConcepts", weakNames,
                "materials", materialNames
        ));

        StudyPlan plan = studyPlanRepository.findByProjectIdAndUserId(projectId, user.getId())
                .orElseGet(() -> {
                    StudyPlan p = new StudyPlan();
                    p.setProjectId(projectId);
                    p.setUserId(user.getId());
                    return p;
                });

        Object rawData = ai.get("data");
        if (rawData instanceof Map<?, ?> map) {
            plan.setTitle(map.get("title") != null ? String.valueOf(map.get("title")) : "Personalized Learning Roadmap");
            plan.setOverview(map.get("overview") != null ? String.valueOf(map.get("overview")) : "Tailored study path based on your uploaded materials and current concept mastery.");
            Object days = map.get("targetCompletionDays");
            if (days instanceof Number n) plan.setTargetCompletionDays(n.intValue());
            Object ms = map.get("milestones");
            if (ms instanceof List<?> list) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> mList = (List<Map<String, Object>>) list;
                plan.setMilestones(mList);
            }
        }
        plan.setUpdatedAt(Instant.now());
        plan = studyPlanRepository.save(plan);

        quotaService.recordTokens(user.getId(), 500);
        activityService.record(user.getId(), projectId, "STUDY_PLAN_GENERATED",
                Map.of("milestoneCount", plan.getMilestones().size()), "plan:" + plan.getId());

        return ApiResponse.ok(plan);
    }

    @PostMapping("/api/projects/{projectId}/study-plan/milestones/{number}/toggle")
    public ApiResponse<StudyPlan> toggleMilestone(
            @PathVariable String projectId,
            @PathVariable int number,
            @AuthenticationPrincipal UserPrincipal user) {
        accessGuard.requireProject(projectId);
        StudyPlan plan = studyPlanRepository.findByProjectIdAndUserId(projectId, user.getId())
                .orElseThrow(() -> ApiException.notFound("Study plan not found"));

        List<Integer> completed = new ArrayList<>(plan.getCompletedMilestones());
        if (completed.contains(number)) {
            completed.remove(Integer.valueOf(number));
        } else {
            completed.add(number);
        }
        plan.setCompletedMilestones(completed);
        plan.setUpdatedAt(Instant.now());
        plan = studyPlanRepository.save(plan);

        return ApiResponse.ok(plan);
    }
}
