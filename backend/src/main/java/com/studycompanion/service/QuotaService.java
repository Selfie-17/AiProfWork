package com.studycompanion.service;

import com.studycompanion.common.ApiException;
import com.studycompanion.domain.AiUsageLog;
import com.studycompanion.repo.AiUsageLogRepository;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class QuotaService {
    private static final long DEFAULT_MONTHLY_LIMIT = 500_000L; // 500k tokens / month
    private final StringRedisTemplate redis;
    private final AiUsageLogRepository aiUsageLogRepository;

    public QuotaService(StringRedisTemplate redis, AiUsageLogRepository aiUsageLogRepository) {
        this.redis = redis;
        this.aiUsageLogRepository = aiUsageLogRepository;
    }

    private String getMonthKey(String userId) {
        String month = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM"));
        return "quota:" + userId + ":" + month;
    }

    private String getLimitKey(String userId) {
        return "quota_limit:" + userId;
    }

    public long getUserLimit(String userId) {
        try {
            String val = redis.opsForValue().get(getLimitKey(userId));
            if (val != null) {
                return Long.parseLong(val);
            }
        } catch (Exception ignored) {}
        return DEFAULT_MONTHLY_LIMIT;
    }

    public void setUserLimit(String userId, long limit) {
        try {
            redis.opsForValue().set(getLimitKey(userId), String.valueOf(limit));
        } catch (Exception ignored) {}
    }

    public long getConsumedTokens(String userId) {
        try {
            String val = redis.opsForValue().get(getMonthKey(userId));
            if (val != null) {
                return Long.parseLong(val);
            }
        } catch (Exception ignored) {}
        return 0L;
    }

    public void recordTokens(String userId, long tokens) {
        if (tokens <= 0) return;
        try {
            String key = getMonthKey(userId);
            Long current = redis.opsForValue().increment(key, tokens);
            if (current != null && current == tokens) {
                redis.expire(key, Duration.ofDays(35));
            }
        } catch (Exception ignored) {}
    }

    public void checkQuota(String userId, long requestedEstimate) {
        long current = getConsumedTokens(userId);
        long limit = getUserLimit(userId);
        if (current + requestedEstimate > limit) {
            throw ApiException.status(429, "AI token quota exceeded for this billing period (" 
                    + current + " / " + limit + " tokens). Please contact an administrator.");
        }
    }

    public Map<String, Object> getQuotaSummary(String userId) {
        long used = getConsumedTokens(userId);
        long limit = getUserLimit(userId);
        double pct = limit > 0 ? ((double) used / limit) * 100.0 : 0.0;
        Map<String, Object> map = new HashMap<>();
        map.put("userId", userId);
        map.put("usedTokens", used);
        map.put("limitTokens", limit);
        map.put("percentUsed", Math.min(100.0, Math.round(pct * 10.0) / 10.0));
        map.put("hasCapacity", used < limit);
        return map;
    }
}
