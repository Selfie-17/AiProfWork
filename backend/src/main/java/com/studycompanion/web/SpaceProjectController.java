package com.studycompanion.web;

import com.studycompanion.common.ApiException;
import com.studycompanion.common.ApiResponse;
import com.studycompanion.domain.*;
import com.studycompanion.repo.*;
import com.studycompanion.security.UserPrincipal;
import com.studycompanion.service.AccessGuard;
import com.studycompanion.service.ActivityService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
public class SpaceProjectController {
    private final SpaceRepository spaceRepository;
    private final ProjectRepository projectRepository;
    private final ConceptRepository conceptRepository;
    private final RecommendationRepository recommendationRepository;
    private final MaterialRepository materialRepository;
    private final AccessGuard accessGuard;
    private final ActivityService activityService;

    public SpaceProjectController(SpaceRepository spaceRepository, ProjectRepository projectRepository, ConceptRepository conceptRepository, RecommendationRepository recommendationRepository, MaterialRepository materialRepository, AccessGuard accessGuard, ActivityService activityService) {
        this.spaceRepository = spaceRepository;
        this.projectRepository = projectRepository;
        this.conceptRepository = conceptRepository;
        this.recommendationRepository = recommendationRepository;
        this.materialRepository = materialRepository;
        this.accessGuard = accessGuard;
        this.activityService = activityService;
    }


    @GetMapping("/api/spaces")
    public ApiResponse<List<Space>> listSpaces(@AuthenticationPrincipal UserPrincipal user) {
        if (user != null && "ADMIN".equalsIgnoreCase(user.getRole())) {
            return ApiResponse.ok(spaceRepository.findAllByOrderByCreatedAtDesc());
        }
        return ApiResponse.ok(spaceRepository.findByUserIdOrderByCreatedAtDesc(user.getId()));
    }

    @PostMapping("/api/spaces")
    public ApiResponse<Space> createSpace(@AuthenticationPrincipal UserPrincipal user, @Valid @RequestBody SpaceReq req) {
        Space space = new Space();
        space.setUserId(user.getId());
        space.setName(req.getName().trim());
        space.setDescription(req.getDescription());
        space.setColorTheme(req.getColorTheme() == null ? "indigo" : req.getColorTheme());
        space.setCreatedAt(Instant.now());
        space = spaceRepository.save(space);
        activityService.record(user.getId(), null, "SPACE_CREATED", Map.of("spaceId", space.getId()), "space:" + space.getId());
        return ApiResponse.ok(space);
    }

    @GetMapping("/api/spaces/{id}")
    public ApiResponse<Map<String, Object>> spaceDashboard(@PathVariable String id) {
        Space space = accessGuard.requireSpace(id);
        List<Project> projects = projectRepository.findBySpaceIdOrderByCreatedAtDesc(id);
        return ApiResponse.ok(Map.of("space", space, "projects", projects));
    }

    @PutMapping("/api/spaces/{id}")
    public ApiResponse<Space> updateSpace(@PathVariable String id, @Valid @RequestBody SpaceReq req) {
        Space space = accessGuard.requireSpace(id);
        space.setName(req.getName().trim());
        space.setDescription(req.getDescription());
        if (req.getColorTheme() != null) space.setColorTheme(req.getColorTheme());
        return ApiResponse.ok(spaceRepository.save(space));
    }

    @DeleteMapping("/api/spaces/{id}")
    public ApiResponse<Void> deleteSpace(@PathVariable String id) {
        Space space = accessGuard.requireSpace(id);
        projectRepository.findBySpaceId(id).forEach(projectRepository::delete);
        spaceRepository.delete(space);
        return ApiResponse.ok(null);
    }

    @GetMapping("/api/projects")
    public ApiResponse<List<Project>> listProjects(@AuthenticationPrincipal UserPrincipal user,
                                                   @RequestParam(required = false) String spaceId) {
        if (spaceId != null) {
            accessGuard.requireSpace(spaceId);
            if (user != null && "ADMIN".equalsIgnoreCase(user.getRole())) {
                return ApiResponse.ok(projectRepository.findBySpaceIdOrderByCreatedAtDesc(spaceId));
            }
            return ApiResponse.ok(projectRepository.findBySpaceIdAndUserId(spaceId, user.getId()));
        }
        if (user != null && "ADMIN".equalsIgnoreCase(user.getRole())) {
            return ApiResponse.ok(projectRepository.findAllByOrderByCreatedAtDesc());
        }
        return ApiResponse.ok(projectRepository.findByUserIdOrderByCreatedAtDesc(user.getId()));
    }

    @PostMapping("/api/projects")
    public ApiResponse<Project> createProject(@AuthenticationPrincipal UserPrincipal user, @Valid @RequestBody ProjectReq req) {
        accessGuard.requireSpace(req.getSpaceId());
        Project project = new Project();
        project.setSpaceId(req.getSpaceId());
        project.setUserId(user.getId());
        project.setName(req.getName().trim());
        project.setDescription(req.getDescription());
        project.setGoal(req.getGoal());
        project.setStatus("ACTIVE");
        project.setCreatedAt(Instant.now());
        project = projectRepository.save(project);
        activityService.record(user.getId(), project.getId(), "PROJECT_CREATED",
                Map.of("name", project.getName()), "project:" + project.getId());
        return ApiResponse.ok(project);
    }

    @GetMapping("/api/projects/{id}")
    public ApiResponse<Map<String, Object>> projectDashboard(@PathVariable String id) {
        Project project = accessGuard.requireProject(id);
        List<Concept> concepts = conceptRepository.findByProjectId(id);
        List<Recommendation> recs = recommendationRepository.findByProjectIdAndStatusOrderByCreatedAtDesc(id, "ACTIVE");
        List<Material> materials = materialRepository.findByProjectIdOrderByUploadedAtDesc(id);
        double avgMastery = concepts.isEmpty() ? 0 : concepts.stream().mapToDouble(Concept::getMasteryScore).average().orElse(0);
        Map<String, Object> payload = new HashMap<>();
        payload.put("project", project);
        payload.put("concepts", concepts);
        payload.put("recommendations", recs);
        payload.put("materials", materials);
        payload.put("avgMastery", avgMastery);
        payload.put("attentionConcepts", concepts.stream().filter(c -> "ATTENTION".equals(c.getTrend()) || c.getMasteryScore() < 50).toList());
        return ApiResponse.ok(payload);
    }

    @PutMapping("/api/projects/{id}")
    public ApiResponse<Project> updateProject(@PathVariable String id, @Valid @RequestBody ProjectReq req) {
        Project project = accessGuard.requireProject(id);
        project.setName(req.getName().trim());
        project.setDescription(req.getDescription());
        project.setGoal(req.getGoal());
        return ApiResponse.ok(projectRepository.save(project));
    }

    @DeleteMapping("/api/projects/{id}")
    public ApiResponse<Void> deleteProject(@PathVariable String id) {
        Project project = accessGuard.requireProject(id);
        projectRepository.delete(project);
        return ApiResponse.ok(null);
    }

    public static class SpaceReq  {

        @NotBlank private String name;
        private String description;
        private String colorTheme;
    

        public SpaceReq() {}
        public String getName() { return this.name; }
    public void setName(String name) { this.name = name; }
        public String getDescription() { return this.description; }
    public void setDescription(String description) { this.description = description; }
        public String getColorTheme() { return this.colorTheme; }
    public void setColorTheme(String colorTheme) { this.colorTheme = colorTheme; }
    }

    public static class ProjectReq  {

        @NotBlank private String spaceId;
        @NotBlank private String name;
        private String description;
        private String goal;
    

        public ProjectReq() {}
        public String getSpaceId() { return this.spaceId; }
    public void setSpaceId(String spaceId) { this.spaceId = spaceId; }
        public String getName() { return this.name; }
    public void setName(String name) { this.name = name; }
        public String getDescription() { return this.description; }
    public void setDescription(String description) { this.description = description; }
        public String getGoal() { return this.goal; }
    public void setGoal(String goal) { this.goal = goal; }
    }
}