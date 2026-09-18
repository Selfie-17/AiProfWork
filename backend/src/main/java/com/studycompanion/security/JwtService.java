package com.studycompanion.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.Map;

@Service
public class JwtService {
    private final SecretKey key;
    private final long accessMinutes;
    private final long refreshDays;

    public JwtService(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.access-minutes}") long accessMinutes,
            @Value("${app.jwt.refresh-days}") long refreshDays) {
        this.key = Keys.hmacShaKeyFor(pad(secret).getBytes(StandardCharsets.UTF_8));
        this.accessMinutes = accessMinutes;
        this.refreshDays = refreshDays;
    }

    private String pad(String secret) {
        if (secret.length() >= 32) return secret;
        return secret + "0".repeat(32 - secret.length());
    }

    public String createAccessToken(String userId, String email, String role) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(userId)
                .claims(Map.of("email", email, "role", role, "typ", "access"))
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(accessMinutes, ChronoUnit.MINUTES)))
                .signWith(key)
                .compact();
    }

    public String createRefreshToken(String userId) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(userId)
                .claim("typ", "refresh")
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(refreshDays, ChronoUnit.DAYS)))
                .signWith(key)
                .compact();
    }

    public Claims parse(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }
}
