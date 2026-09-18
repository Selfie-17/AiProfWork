package com.studycompanion.web;

import com.studycompanion.common.ApiException;
import com.studycompanion.common.ApiResponse;
import com.studycompanion.domain.Job;
import com.studycompanion.domain.Material;
import com.studycompanion.domain.Project;
import com.studycompanion.repo.JobRepository;
import com.studycompanion.repo.MaterialRepository;
import com.studycompanion.security.UserPrincipal;
import com.studycompanion.service.AccessGuard;
import com.studycompanion.service.ActivityService;
import com.studycompanion.service.AiServiceClient;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
public class MaterialController {
    private static final Set<String> ALLOWED = Set.of("application/pdf", "application/octet-stream");
    private final AccessGuard accessGuard;
    private final MaterialRepository materialRepository;
    private final JobRepository jobRepository;
    private final ActivityService activityService;
    private final AiServiceClient aiServiceClient;

    private final MongoTemplate mongoTemplate;

    public MaterialController(AccessGuard accessGuard, MaterialRepository materialRepository, JobRepository jobRepository, ActivityService activityService, AiServiceClient aiServiceClient, MongoTemplate mongoTemplate) {
        this.accessGuard = accessGuard;
        this.materialRepository = materialRepository;
        this.jobRepository = jobRepository;
        this.activityService = activityService;
        this.aiServiceClient = aiServiceClient;
        this.mongoTemplate = mongoTemplate;
    }


    @Value("${app.storage.dir}")
    private String storageDir;

    @GetMapping("/api/materials")
    public ApiResponse<List<Material>> list(@RequestParam String projectId) {
        accessGuard.requireProject(projectId);
        return ApiResponse.ok(materialRepository.findByProjectIdOrderByUploadedAtDesc(projectId));
    }

    @GetMapping("/api/materials/{id}")
    public ApiResponse<Material> get(@PathVariable String id) {
        Material material = materialRepository.findById(id).orElseThrow(() -> ApiException.notFound("Material not found"));
        accessGuard.requireProject(material.getProjectId());
        return ApiResponse.ok(material);
    }

    @PostMapping("/api/materials/upload")
    public ApiResponse<Material> upload(@AuthenticationPrincipal UserPrincipal user,
                                        @RequestParam String projectId,
                                        @RequestParam("file") MultipartFile file) throws Exception {
        Project project = accessGuard.requireProject(projectId);
        if (file.isEmpty()) throw ApiException.badRequest("File required");
        String original = file.getOriginalFilename() == null ? "upload.pdf" : file.getOriginalFilename();
        if (!original.toLowerCase().endsWith(".pdf")) {
            throw ApiException.badRequest("Only PDF files are allowed");
        }
        String contentType = file.getContentType() == null ? "" : file.getContentType();
        if (!ALLOWED.contains(contentType) && !contentType.equals("application/pdf")) {
            throw ApiException.badRequest("Invalid content type");
        }
        if (file.getSize() > 20 * 1024 * 1024) {
            throw ApiException.badRequest("File exceeds 20MB");
        }

        Path dir = Path.of(storageDir, projectId).toAbsolutePath();
        Files.createDirectories(dir);
        String storedName = UUID.randomUUID() + ".pdf";
        Path dest = dir.resolve(storedName);
        try (var is = file.getInputStream()) {
            Files.copy(is, dest, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        }


        Material material = new Material();
        material.setProjectId(project.getId());
        material.setUserId(user.getId());
        material.setFileName(original);
        material.setStoragePath(dest.toAbsolutePath().toString());
        material.setStatus("QUEUED");
        material.setUploadedAt(Instant.now());
        material = materialRepository.save(material);

        Job job = activityService.enqueue("PROCESS_MATERIAL", material.getId());
        Map<String, Object> ai = aiServiceClient.post("/ingest", Map.of(
                "materialId", material.getId(),
                "projectId", projectId,
                "filePath", material.getStoragePath(),
                "fileName", original,
                "jobId", job.getId()
        ));
        if (Boolean.FALSE.equals(ai.get("ok"))) {
            material.setStatus("PROCESSING");
            materialRepository.save(material);
        }
        activityService.record(user.getId(), projectId, "MATERIAL_UPLOADED",
                Map.of("materialId", material.getId(), "fileName", original),
                "material:" + material.getId());
        return ApiResponse.ok(material);
    }

    @GetMapping("/api/jobs/{relatedId}")
    public ApiResponse<List<Job>> jobs(@PathVariable String relatedId) {
        return ApiResponse.ok(jobRepository.findByRelatedId(relatedId));
    }

    @PutMapping("/api/materials/{id}")
    public ApiResponse<Material> updateMaterial(
            @PathVariable String id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal UserPrincipal user) {
        Material material = materialRepository.findById(id).orElseThrow(() -> ApiException.notFound("Material not found"));
        accessGuard.requireProject(material.getProjectId());
        if (body.containsKey("fileName") && body.get("fileName") != null && !body.get("fileName").isBlank()) {
            material.setFileName(body.get("fileName").trim());
        }
        return ApiResponse.ok(materialRepository.save(material));
    }

    @DeleteMapping("/api/materials/{id}")
    public ApiResponse<Void> deleteMaterial(
            @PathVariable String id,
            @AuthenticationPrincipal UserPrincipal user) {
        Material material = materialRepository.findById(id).orElseThrow(() -> ApiException.notFound("Material not found"));
        accessGuard.requireProject(material.getProjectId());

        // 1. Delete physical file if exists
        if (material.getStoragePath() != null) {
            try {
                Path p = Path.of(material.getStoragePath());
                Files.deleteIfExists(p);
            } catch (Exception ex) {
                // Ignore file system errors
            }
        }

        // 2. Delete material chunks in MongoDB
        try {
            mongoTemplate.remove(
                org.springframework.data.mongodb.core.query.Query.query(
                    org.springframework.data.mongodb.core.query.Criteria.where("materialId").is(id)
                ),
                "material_chunks"
            );
        } catch (Exception ex) {
            // Ignore mongo delete errors
        }

        // 3. Delete material document
        materialRepository.delete(material);
        activityService.record(user.getId(), material.getProjectId(), "MATERIAL_DELETED",
                Map.of("materialId", id, "fileName", material.getFileName()), "material-del:" + id);
        return ApiResponse.ok(null);
    }
}