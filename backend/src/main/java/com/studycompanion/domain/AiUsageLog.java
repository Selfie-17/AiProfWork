package com.studycompanion.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document("ai_usage_logs")
public class AiUsageLog {
    @Id private String id;
    private String feature;
    private String model;
    private String provider;
    private Integer tokensIn;
    private Integer tokensOut;
    private Long latencyMs;
    private Double costEstimate;
    private String status;
    private String errorMsg;
    private String correlationId;
    private Instant createdAt;

    public AiUsageLog() {}
    public String getId() { return this.id; }
    public void setId(String id) { this.id = id; }
    public String getCorrelationId() { return this.correlationId; }
    public void setCorrelationId(String correlationId) { this.correlationId = correlationId; }
    public String getFeature() { return this.feature; }
    public void setFeature(String feature) { this.feature = feature; }
    public String getModel() { return this.model; }
    public void setModel(String model) { this.model = model; }
    public String getProvider() { return this.provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public Integer getTokensIn() { return this.tokensIn; }
    public void setTokensIn(Integer tokensIn) { this.tokensIn = tokensIn; }
    public Integer getTokensOut() { return this.tokensOut; }
    public void setTokensOut(Integer tokensOut) { this.tokensOut = tokensOut; }
    public Long getLatencyMs() { return this.latencyMs; }
    public void setLatencyMs(Long latencyMs) { this.latencyMs = latencyMs; }
    public Double getCostEstimate() { return this.costEstimate; }
    public void setCostEstimate(Double costEstimate) { this.costEstimate = costEstimate; }
    public String getStatus() { return this.status; }
    public void setStatus(String status) { this.status = status; }
    public String getErrorMsg() { return this.errorMsg; }
    public void setErrorMsg(String errorMsg) { this.errorMsg = errorMsg; }
    public Instant getCreatedAt() { return this.createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

}
