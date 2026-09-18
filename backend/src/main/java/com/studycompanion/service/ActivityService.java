package com.studycompanion.service;

import com.studycompanion.common.ApiException;
import com.studycompanion.domain.ActivityEvent;
import com.studycompanion.domain.Job;
import com.studycompanion.repo.ActivityEventRepository;
import com.studycompanion.repo.JobRepository;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
public class ActivityService {
    private final ActivityEventRepository activityEventRepository;
    private final JobRepository jobRepository;

    public ActivityService(ActivityEventRepository activityEventRepository, JobRepository jobRepository) {
        this.activityEventRepository = activityEventRepository;
        this.jobRepository = jobRepository;
    }


    public ActivityEvent record(String userId, String projectId, String type, Map<String, Object> metadata, String idempotencyKey) {
        String key = idempotencyKey == null || idempotencyKey.isBlank()
                ? type + ":" + UUID.randomUUID()
                : idempotencyKey;
        return activityEventRepository.findByIdempotencyKey(key).orElseGet(() -> {
            ActivityEvent event = new ActivityEvent();
            event.setUserId(userId);
            event.setProjectId(projectId);
            event.setType(type);
            event.setMetadata(metadata);
            event.setIdempotencyKey(key);
            event.setCreatedAt(Instant.now());
            try {
                return activityEventRepository.save(event);
            } catch (DuplicateKeyException ex) {
                return activityEventRepository.findByIdempotencyKey(key).orElseThrow();
            }
        });
    }

    public Job enqueue(String type, String relatedId) {
        Job job = new Job();
        job.setType(type);
        job.setStatus("QUEUED");
        job.setRelatedId(relatedId);
        job.setRetryCount(0);
        job.setCreatedAt(Instant.now());
        job.setUpdatedAt(Instant.now());
        return jobRepository.save(job);
    }

    public Job updateJob(Job job, String status, String error) {
        job.setStatus(status);
        job.setError(error);
        job.setUpdatedAt(Instant.now());
        return jobRepository.save(job);
    }
}