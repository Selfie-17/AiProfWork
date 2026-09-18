package com.studycompanion.web;

import com.studycompanion.common.ApiResponse;
import com.studycompanion.domain.AiUsageLog;
import com.studycompanion.domain.Job;
import com.studycompanion.domain.Material;
import com.studycompanion.repo.AiUsageLogRepository;
import com.studycompanion.repo.JobRepository;
import com.studycompanion.repo.MaterialRepository;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/internal")
public class InternalController {
    private final AiUsageLogRepository aiUsageLogRepository;
    private final MaterialRepository materialRepository;
    private final JobRepository jobRepository;

    public InternalController(AiUsageLogRepository aiUsageLogRepository, MaterialRepository materialRepository, JobRepository jobRepository) {
        this.aiUsageLogRepository = aiUsageLogRepository;
        this.materialRepository = materialRepository;
        this.jobRepository = jobRepository;
    }


    @PostMapping("/ai-usage")
    public ApiResponse<AiUsageLog> logUsage(@RequestBody Map<String, Object> body) {
        AiUsageLog log = new AiUsageLog();
        log.setFeature(str(body.get("feature")));
        log.setModel(str(body.get("model")));
        log.setProvider(str(body.get("provider")));
        log.setTokensIn(num(body.get("tokensIn")));
        log.setTokensOut(num(body.get("tokensOut")));
        Object lat = body.get("latencyMs");
        if (lat instanceof Number n) log.setLatencyMs(n.longValue());
        Object cost = body.get("costEstimate");
        if (cost instanceof Number n) log.setCostEstimate(n.doubleValue());
        log.setStatus(str(body.getOrDefault("status", "ok")));
        log.setErrorMsg(str(body.get("errorMsg")));
        log.setCreatedAt(Instant.now());
        return ApiResponse.ok(aiUsageLogRepository.save(log));
    }

    @PostMapping("/materials/{id}/status")
    public ApiResponse<Material> materialStatus(@PathVariable String id, @RequestBody Map<String, Object> body) {
        Material material = materialRepository.findById(id).orElseThrow();
        if (body.get("status") != null) material.setStatus(str(body.get("status")));
        if (body.get("pageCount") instanceof Number n) material.setPageCount(n.intValue());
        if (body.get("error") != null) material.setError(str(body.get("error")));
        return ApiResponse.ok(materialRepository.save(material));
    }

    @PostMapping("/jobs/{id}")
    public ApiResponse<Job> job(@PathVariable String id, @RequestBody Map<String, Object> body) {
        Job job = jobRepository.findById(id).orElseThrow();
        if (body.get("status") != null) job.setStatus(str(body.get("status")));
        if (body.get("error") != null) job.setError(str(body.get("error")));
        if (body.get("retryCount") instanceof Number n) job.setRetryCount(n.intValue());
        job.setUpdatedAt(Instant.now());
        return ApiResponse.ok(jobRepository.save(job));
    }

    @GetMapping("/materials/{id}/file")
    public org.springframework.http.ResponseEntity<org.springframework.core.io.Resource> materialFile(@PathVariable String id) {
        Material material = materialRepository.findById(id).orElseThrow();
        java.nio.file.Path path = java.nio.file.Path.of(material.getStoragePath());
        if (!java.nio.file.Files.exists(path)) {
            return org.springframework.http.ResponseEntity.notFound().build();
        }
        org.springframework.core.io.Resource resource = new org.springframework.core.io.FileSystemResource(path);
        return org.springframework.http.ResponseEntity.ok()
                .contentType(org.springframework.http.MediaType.APPLICATION_PDF)
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + material.getFileName() + "\"")
                .body(resource);
    }

    private String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private Integer num(Object o) {
        if (o instanceof Number n) return n.intValue();
        return null;
    }
}