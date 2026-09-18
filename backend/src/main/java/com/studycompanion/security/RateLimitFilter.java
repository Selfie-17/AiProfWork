package com.studycompanion.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;

@Component
public class RateLimitFilter extends OncePerRequestFilter {
    private final StringRedisTemplate redis;

    public RateLimitFilter(StringRedisTemplate redis) {
        this.redis = redis;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        if (!path.startsWith("/api/") || path.startsWith("/api/internal") || path.equals("/actuator/health")) {
            filterChain.doFilter(request, response);
            return;
        }
        String keyPart = request.getRemoteAddr();
        if (request.getUserPrincipal() != null) {
            keyPart = request.getUserPrincipal().getName();
        }
        int limit = 500;
        String key = "rl:" + keyPart + ":" + (System.currentTimeMillis() / 60000);
        try {
            Long n = redis.opsForValue().increment(key);
            if (n != null && n == 1L) {
                redis.expire(key, Duration.ofMinutes(2));
            }
            if (n != null && n > limit) {
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.setContentType("application/json");
                response.getWriter().write("{\"success\":false,\"message\":\"Rate limit exceeded\"}");
                return;
            }
        } catch (Exception ignored) {
            // Redis optional in local/dev
        }
        filterChain.doFilter(request, response);
    }
}
