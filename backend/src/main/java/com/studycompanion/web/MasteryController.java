package com.studycompanion.web;

import com.studycompanion.common.ApiException;
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

    @DeleteMapping("/api/recommendations/{id}")
    public ApiResponse<Void> deleteRecommendation(@PathVariable String id) {
        Recommendation rec = recommendationRepository.findById(id).orElseThrow(() -> ApiException.notFound("Recommendation not found"));
        accessGuard.requireProject(rec.getProjectId());
        recommendationRepository.delete(rec);
        return ApiResponse.ok(null);
    }

    @PostMapping("/api/projects/{projectId}/concepts")
    public ApiResponse<Concept> createConcept(
            @PathVariable String projectId,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserPrincipal user) {
        accessGuard.requireProject(projectId);
        String name = String.valueOf(body.getOrDefault("name", "")).trim();
        String desc = String.valueOf(body.getOrDefault("description", ""));
        if (name.isBlank()) throw ApiException.badRequest("Concept name required");

        Concept c = new Concept();
        c.setProjectId(projectId);
        c.setName(name);
        c.setDescription(desc);
        c.setMasteryScore(body.containsKey("masteryScore") ? ((Number) body.get("masteryScore")).intValue() : 40);
        c.setTrend("STABLE");
        c.setLastUpdated(Instant.now());
        return ApiResponse.ok(conceptRepository.save(c));
    }

    @PutMapping("/api/concepts/{id}")
    public ApiResponse<Concept> updateConcept(
            @PathVariable String id,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserPrincipal user) {
        Concept c = conceptRepository.findById(id).orElseThrow(() -> ApiException.notFound("Concept not found"));
        accessGuard.requireProject(c.getProjectId());
        if (body.containsKey("name") && body.get("name") != null && !String.valueOf(body.get("name")).isBlank()) {
            c.setName(String.valueOf(body.get("name")).trim());
        }
        if (body.containsKey("description") && body.get("description") != null) {
            c.setDescription(String.valueOf(body.get("description")));
        }
        if (body.containsKey("masteryScore") && body.get("masteryScore") instanceof Number n) {
            c.setMasteryScore(Math.max(0, Math.min(100, n.intValue())));
        }
        if (body.containsKey("trend") && body.get("trend") != null) {
            c.setTrend(String.valueOf(body.get("trend")));
        }
        c.setLastUpdated(Instant.now());
        return ApiResponse.ok(conceptRepository.save(c));
    }

    @DeleteMapping("/api/concepts/{id}")
    public ApiResponse<Void> deleteConcept(
            @PathVariable String id,
            @AuthenticationPrincipal UserPrincipal user) {
        Concept c = conceptRepository.findById(id).orElseThrow(() -> ApiException.notFound("Concept not found"));
        accessGuard.requireProject(c.getProjectId());
        conceptRepository.delete(c);
        return ApiResponse.ok(null);
    }
}