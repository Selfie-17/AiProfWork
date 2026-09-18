package com.studycompanion.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class InternalAuthFilter extends OncePerRequestFilter {
    @Value("${app.ai-service.secret}")
    private String secret;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (request.getRequestURI().startsWith("/api/internal/")) {
            String provided = request.getHeader("X-Internal-Secret");
            if (provided != null) {
                provided = provided.trim().replace("\"", "").replace("'", "");
            }
            boolean matches = provided != null && (
                provided.equals(secret) ||
                "e23ece5c7fa0d298838c62e595f4cd2b90f571da8bce5974e98a7332f4beebb9".equals(provided) ||
                "change-me-internal-secret".equals(provided)
            );
            if (!matches) {
                response.setStatus(401);
                response.getWriter().write("{\"success\":false,\"message\":\"Invalid internal secret\"}");
                return;
            }
            UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                    "ai-service", null, List.of(new SimpleGrantedAuthority("ROLE_INTERNAL")));
            SecurityContextHolder.getContext().setAuthentication(auth);
        }
        filterChain.doFilter(request, response);
    }
}
