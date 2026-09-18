package com.studycompanion.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document("materials")
public class Material {
    @Id private String id;
    @Indexed private String projectId;
    private String userId;
    private String fileName;
    private String storagePath;
    private String s3Url;
    private String status;
    private Integer pageCount;
    private String error;
    private Instant uploadedAt;

    public Material() {}
    public String getId() { return this.id; }
    public void setId(String id) { this.id = id; }
    public String getProjectId() { return this.projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public String getUserId() { return this.userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getFileName() { return this.fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
    public String getStoragePath() { return this.storagePath; }
    public void setStoragePath(String storagePath) { this.storagePath = storagePath; }
    public String getS3Url() { return this.s3Url; }
    public void setS3Url(String s3Url) { this.s3Url = s3Url; }
    public String getStatus() { return this.status; }
    public void setStatus(String status) { this.status = status; }
    public Integer getPageCount() { return this.pageCount; }
    public void setPageCount(Integer pageCount) { this.pageCount = pageCount; }
    public String getError() { return this.error; }
    public void setError(String error) { this.error = error; }
    public Instant getUploadedAt() { return this.uploadedAt; }
    public void setUploadedAt(Instant uploadedAt) { this.uploadedAt = uploadedAt; }

}
