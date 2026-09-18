package com.studycompanion.web;

import com.studycompanion.common.ApiException;
import com.studycompanion.common.ApiResponse;
import com.studycompanion.domain.Concept;
import com.studycompanion.domain.Flashcard;
import com.studycompanion.domain.Project;
import com.studycompanion.repo.ConceptRepository;
import com.studycompanion.repo.FlashcardRepository;
import com.studycompanion.security.UserPrincipal;
import com.studycompanion.service.AccessGuard;
import com.studycompanion.service.ActivityService;
import com.studycompanion.service.AiServiceClient;
import com.studycompanion.service.QuotaService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
public class FlashcardController {
    private final AccessGuard accessGuard;
    private final FlashcardRepository flashcardRepository;
    private final ConceptRepository conceptRepository;
    private final AiServiceClient aiServiceClient;
    private final ActivityService activityService;
    private final QuotaService quotaService;

    public FlashcardController(AccessGuard accessGuard, FlashcardRepository flashcardRepository, ConceptRepository conceptRepository, AiServiceClient aiServiceClient, ActivityService activityService, QuotaService quotaService) {
        this.accessGuard = accessGuard;
        this.flashcardRepository = flashcardRepository;
        this.conceptRepository = conceptRepository;
        this.aiServiceClient = aiServiceClient;
        this.activityService = activityService;
        this.quotaService = quotaService;
    }

    @GetMapping("/api/projects/{projectId}/flashcards")
    public ApiResponse<Map<String, Object>> list(@PathVariable String projectId, @AuthenticationPrincipal UserPrincipal user) {
        accessGuard.requireProject(projectId);
        List<Flashcard> all = flashcardRepository.findByProjectIdAndUserIdOrderByNextReviewDateAsc(projectId, user.getId());
        Instant now = Instant.now();
        List<Flashcard> due = all.stream().filter(f -> f.getNextReviewDate() == null || !f.getNextReviewDate().isAfter(now)).toList();
        return ApiResponse.ok(Map.of(
                "cards", all,
                "dueCards", due,
                "totalCount", all.size(),
                "dueCount", due.size()
        ));
    }

    @PostMapping("/api/projects/{projectId}/flashcards/generate")
    public ApiResponse<List<Flashcard>> generate(@PathVariable String projectId, @AuthenticationPrincipal UserPrincipal user) {
        Project project = accessGuard.requireProject(projectId);
        quotaService.checkQuota(user.getId(), 500);

        List<Concept> concepts = conceptRepository.findByProjectId(projectId);
        List<String> conceptNames = concepts.stream().map(Concept::getName).limit(6).toList();

        Map<String, Object> ai = aiServiceClient.post("/quiz/flashcards/generate", Map.of(
                "projectId", projectId,
                "concepts", conceptNames
        ));

        List<Flashcard> created = new ArrayList<>();
        Object rawCards = ai.get("flashcards");
        if (rawCards instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> m) {
                    Flashcard fc = new Flashcard();
                    fc.setProjectId(projectId);
                    fc.setUserId(user.getId());
                    fc.setConceptName(m.get("conceptName") != null ? String.valueOf(m.get("conceptName")) : "Core Concept");
                    fc.setFront(m.get("front") != null ? String.valueOf(m.get("front")) : "Question");
                    fc.setBack(m.get("back") != null ? String.valueOf(m.get("back")) : "Answer");
                    fc.setInterval(1);
                    fc.setRepetitions(0);
                    fc.setEaseFactor(2.5);
                    fc.setNextReviewDate(Instant.now());
                    fc.setCreatedAt(Instant.now());
                    created.add(flashcardRepository.save(fc));
                }
            }
        }

        quotaService.recordTokens(user.getId(), 500);
        activityService.record(user.getId(), projectId, "FLASHCARDS_GENERATED",
                Map.of("count", created.size()), "deck:" + projectId);

        return ApiResponse.ok(created);
    }

    @PostMapping("/api/projects/{projectId}/flashcards/{id}/review")
    public ApiResponse<Flashcard> review(
            @PathVariable String projectId,
            @PathVariable String id,
            @RequestBody ReviewReq req,
            @AuthenticationPrincipal UserPrincipal user) {
        accessGuard.requireProject(projectId);
        Flashcard fc = flashcardRepository.findById(id).orElseThrow(() -> ApiException.notFound("Flashcard not found"));
        if (!fc.getProjectId().equals(projectId) || !fc.getUserId().equals(user.getId())) {
            throw ApiException.forbidden("Cannot review this flashcard");
        }

        int quality = Math.max(0, Math.min(5, req.quality)); // 0 to 5 (SM-2 scale)

        // SuperMemo SM-2 Algorithm
        int repetitions = fc.getRepetitions();
        int interval = fc.getInterval();
        double easeFactor = fc.getEaseFactor();

        if (quality >= 3) {
            if (repetitions == 0) {
                interval = 1;
            } else if (repetitions == 1) {
                interval = 6;
            } else {
                interval = (int) Math.round(interval * easeFactor);
            }
            repetitions++;
        } else {
            repetitions = 0;
            interval = 1;
        }

        // Calculate new ease factor
        easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
        if (easeFactor < 1.3) {
            easeFactor = 1.3;
        }

        fc.setRepetitions(repetitions);
        fc.setInterval(interval);
        fc.setEaseFactor(Math.round(easeFactor * 100.0) / 100.0);
        fc.setLastReviewedAt(Instant.now());
        fc.setNextReviewDate(Instant.now().plus(Duration.ofDays(interval)));

        fc = flashcardRepository.save(fc);

        activityService.record(user.getId(), projectId, "FLASHCARD_REVIEWED",
                Map.of("cardId", id, "quality", quality, "nextIntervalDays", interval), "fc-rev:" + id);

        return ApiResponse.ok(fc);
    }

    public static class ReviewReq {
        @Min(0) @Max(5)
        public int quality = 3;
    }
}
