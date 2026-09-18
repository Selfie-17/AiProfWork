package com.studycompanion.web;

import com.studycompanion.common.ApiResponse;
import com.studycompanion.domain.Concept;
import com.studycompanion.domain.MasteryHistory;
import com.studycompanion.domain.Recommendation;
import com.studycompanion.repo.ConceptRepository;
import com.studycompanion.repo.MasteryHistoryRepository;
import com.studycompanion.repo.RecommendationRepository;
import com.studycompanion.security.UserPrincipal;
import com.studycompanion.service.AccessGuard;
import com.studycompanion.service.AiServiceClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
public class MasteryController {
    private final AccessGuard accessGuard;
    private final ConceptRepository conceptRepository;
    private final MasteryHistoryRepository masteryHistoryRepository;
    private final RecommendationRepository recommendationRepository;
    private final AiServiceClient aiServiceClient;

    public MasteryController(AccessGuard accessGuard, ConceptRepository conceptRepository, MasteryHistoryRepository masteryHistoryRepository, RecommendationRepository recommendationRepository, AiServiceClient aiServiceClient) {
        this.accessGuard = accessGuard;
        this.conceptRepository = conceptRepository;
        this.masteryHistoryRepository = masteryHistoryRepository;
        this.recommendationRepository = recommendationRepository;
        this.aiServiceClient = aiServiceClient;
    }


    @GetMapping("/api/mastery/{projectId}")
    public ApiResponse<Map<String, Object>> mastery(@PathVariable String projectId) {
        accessGuard.requireProject(projectId);
        List<Concept> concepts = conceptRepository.findByProjectId(projectId);
        List<MasteryHistory> history = masteryHistoryRepository.findByProjectIdOrderByTimestampAsc(projectId);
        return ApiResponse.ok(Map.of("concepts", concepts, "history", history));
    }

    @PostMapping("/api/mastery/{projectId}/analyze")
    public ApiResponse<Map<String, Object>> analyze(@PathVariable String projectId) {
        accessGuard.requireProject(projectId);
        List<Concept> concepts = conceptRepository.findByProjectId(projectId);
        Map<String, Object> ai = aiServiceClient.post("/growth/analyze", Map.of(
                "projectId", projectId,
                "concepts", concepts.stream().map(c -> Map.of(
                        "name", c.getName(),
                        "masteryScore", c.getMasteryScore(),
                        "trend", c.getTrend()
                )).toList()
        ));
        return ApiResponse.ok(ai);
    }

    @GetMapping("/api/recommendations/{projectId}")
    public ApiResponse<List<Recommendation>> recs(@PathVariable String projectId) {
        accessGuard.requireProject(projectId);
        return ApiResponse.ok(recommendationRepository.findByProjectIdOrderByCreatedAtDesc(projectId));
    }

    @PostMapping("/api/recommendations/{id}/done")
    public ApiResponse<Recommendation> done(@PathVariable String id, @AuthenticationPrincipal UserPrincipal user) {
        Recommendation rec = recommendationRepository.findById(id).orElseThrow();
        accessGuard.requireProject(rec.getProjectId());
        rec.setStatus("DONE");
        return ApiResponse.ok(recommendationRepository.save(rec));
    }

    @PostMapping("/api/recommendations/{projectId}/generate")
    public ApiResponse<Recommendation> generate(@PathVariable String projectId, @AuthenticationPrincipal UserPrincipal user) {
        accessGuard.requireProject(projectId);
        Map<String, Object> ai = aiServiceClient.post("/recommend/generate", Map.of("projectId", projectId));
        Recommendation rec = new Recommendation();
        rec.setProjectId(projectId);
        rec.setUserId(user.getId());
        rec.setText(String.valueOf(ai.getOrDefault("text", "Continue with a short quiz on weak concepts.")));
        rec.setReason(String.valueOf(ai.getOrDefault("reason", "Generated from current mastery")));
        rec.setStatus("ACTIVE");
        rec.setCreatedAt(Instant.now());
        return ApiResponse.ok(recommendationRepository.save(rec));
    }
}