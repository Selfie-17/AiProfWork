package com.studycompanion.web;

import com.studycompanion.common.ApiException;
import com.studycompanion.common.ApiResponse;
import com.studycompanion.domain.LearnerMistake;
import com.studycompanion.domain.LearningContext;
import com.studycompanion.domain.Project;
import com.studycompanion.repo.LearnerMistakeRepository;
import com.studycompanion.repo.LearningContextRepository;
import com.studycompanion.security.UserPrincipal;
import com.studycompanion.service.AccessGuard;
import com.studycompanion.service.ActivityService;
import com.studycompanion.service.AiServiceClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
public class MistakeController {
    private final AccessGuard accessGuard;
    private final LearnerMistakeRepository learnerMistakeRepository;
    private final LearningContextRepository learningContextRepository;
    private final AiServiceClient aiServiceClient;
    private final ActivityService activityService;

    public MistakeController(AccessGuard accessGuard, LearnerMistakeRepository learnerMistakeRepository, LearningContextRepository learningContextRepository, AiServiceClient aiServiceClient, ActivityService activityService) {
        this.accessGuard = accessGuard;
        this.learnerMistakeRepository = learnerMistakeRepository;
        this.learningContextRepository = learningContextRepository;
        this.aiServiceClient = aiServiceClient;
        this.activityService = activityService;
    }

    @GetMapping("/api/projects/{projectId}/mistakes")
    public ApiResponse<Map<String, Object>> getMistakes(@PathVariable String projectId, @AuthenticationPrincipal UserPrincipal user) {
        accessGuard.requireProject(projectId);
        List<LearnerMistake> mistakes = learnerMistakeRepository.findByProjectIdAndUserIdOrderByCreatedAtDesc(projectId, user.getId());
        LearningContext ctx = learningContextRepository.findByProjectIdAndUserId(projectId, user.getId()).orElse(null);

        return ApiResponse.ok(Map.of(
                "mistakes", mistakes,
                "totalCount", mistakes.size(),
                "repeatedMistakesContext", ctx != null ? ctx.getRepeatedMistakes() : List.of()
        ));
    }

    @PostMapping("/api/projects/{projectId}/mistakes/analyze")
    public ApiResponse<Map<String, Object>> analyze(@PathVariable String projectId, @AuthenticationPrincipal UserPrincipal user) {
        Project project = accessGuard.requireProject(projectId);
        List<LearnerMistake> mistakes = learnerMistakeRepository.findTop10ByProjectIdAndUserIdOrderByCreatedAtDesc(projectId, user.getId());

        Map<String, Object> ai = aiServiceClient.post("/growth/analyze-mistakes", Map.of(
                "projectId", projectId,
                "mistakes", mistakes
        ));

        Object rawData = ai.get("data");
        if (rawData instanceof Map<?, ?> dataMap) {
            @SuppressWarnings("unchecked")
            Map<String, Object> castMap = (Map<String, Object>) dataMap;
            Object patterns = castMap.get("patterns");
            if (patterns instanceof List<?> list) {
                LearningContext ctx = learningContextRepository.findByProjectIdAndUserId(projectId, user.getId())
                        .orElseGet(() -> {
                            LearningContext c = new LearningContext();
                            c.setProjectId(projectId);
                            c.setUserId(user.getId());
                            return c;
                        });

                List<String> newRepeated = new ArrayList<>(ctx.getRepeatedMistakes());
                for (Object p : list) {
                    if (p instanceof Map<?, ?> pm) {
                        String name = pm.get("patternName") != null ? String.valueOf(pm.get("patternName")) : "Pattern";
                        String misconception = pm.get("rootMisconception") != null ? String.valueOf(pm.get("rootMisconception")) : "";
                        String entry = name + ": " + misconception;
                        if (!newRepeated.contains(entry)) {
                            newRepeated.add(entry);
                        }
                    }
                }
                ctx.setRepeatedMistakes(newRepeated);
                learningContextRepository.save(ctx);
            }
        }

        activityService.record(user.getId(), projectId, "MISTAKES_ANALYZED",
                Map.of("mistakeCount", mistakes.size()), "mistakes:" + projectId);

        return ApiResponse.ok(ai);
    }

    @DeleteMapping("/api/mistakes/{id}")
    public ApiResponse<Void> deleteMistake(
            @PathVariable String id,
            @AuthenticationPrincipal UserPrincipal user) {
        LearnerMistake m = learnerMistakeRepository.findById(id).orElseThrow(() -> ApiException.notFound("Mistake not found"));
        accessGuard.requireProject(m.getProjectId());
        if (!m.getUserId().equals(user.getId())) throw ApiException.forbidden("Cannot delete this mistake");
        learnerMistakeRepository.delete(m);
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/api/projects/{projectId}/mistakes")
    public ApiResponse<Void> clearMistakes(
            @PathVariable String projectId,
            @AuthenticationPrincipal UserPrincipal user) {
        accessGuard.requireProject(projectId);
        List<LearnerMistake> list = learnerMistakeRepository.findByProjectIdAndUserIdOrderByCreatedAtDesc(projectId, user.getId());
        learnerMistakeRepository.deleteAll(list);
        return ApiResponse.ok(null);
    }
}
