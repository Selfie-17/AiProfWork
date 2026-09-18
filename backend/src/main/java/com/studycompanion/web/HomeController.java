package com.studycompanion.web;

import com.studycompanion.common.ApiResponse;
import com.studycompanion.domain.Project;
import com.studycompanion.repo.ConceptRepository;
import com.studycompanion.repo.ProjectRepository;
import com.studycompanion.repo.RecommendationRepository;
import com.studycompanion.security.UserPrincipal;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
public class HomeController {
    private final ProjectRepository projectRepository;
    private final ConceptRepository conceptRepository;
    private final RecommendationRepository recommendationRepository;

    public HomeController(ProjectRepository projectRepository, ConceptRepository conceptRepository, RecommendationRepository recommendationRepository) {
        this.projectRepository = projectRepository;
        this.conceptRepository = conceptRepository;
        this.recommendationRepository = recommendationRepository;
    }


    @GetMapping("/api/home")
    public ApiResponse<Map<String, Object>> home(@AuthenticationPrincipal UserPrincipal user) {
        List<Project> projects = (user != null && "ADMIN".equalsIgnoreCase(user.getRole()))
                ? projectRepository.findAllByOrderByCreatedAtDesc()
                : projectRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
        List<Map<String, Object>> attention = new java.util.ArrayList<>();
        double masterySum = 0;
        int n = 0;
        for (Project p : projects) {
            var concepts = conceptRepository.findByProjectId(p.getId());
            for (var c : concepts) {
                masterySum += c.getMasteryScore();
                n++;
                if (c.getMasteryScore() < 50 || "ATTENTION".equals(c.getTrend())) {
                    attention.add(Map.of("projectId", p.getId(), "projectName", p.getName(), "concept", c.getName(), "score", c.getMasteryScore()));
                }
            }
        }
        Map<String, Object> data = new HashMap<>();
        data.put("projects", projects);
        data.put("continueLearning", projects.isEmpty() ? null : projects.get(0));
        data.put("overallMastery", n == 0 ? 0 : masterySum / n);
        data.put("attention", attention);
        data.put("recommended", projects.stream().findFirst()
                .map(p -> recommendationRepository.findByProjectIdAndStatusOrderByCreatedAtDesc(p.getId(), "ACTIVE"))
                .filter(list -> !list.isEmpty())
                .map(list -> list.get(0))
                .orElse(null));
        return ApiResponse.ok(data);
    }
}