package com.studycompanion.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.Duration;
import java.util.List;
import java.util.Map;

@Service
public class AiServiceClient {
    private static final Logger log = LoggerFactory.getLogger(AiServiceClient.class);
    private final WebClient.Builder builder;

    public AiServiceClient(WebClient.Builder builder) {
        this.builder = builder;
    }


    @Value("${app.ai-service.url}")
    private String baseUrl;

    @Value("${app.ai-service.secret}")
    private String secret;

    private WebClient client() {
        return builder.baseUrl(baseUrl).build();
    }

    public Map<String, Object> post(String path, Map<String, Object> body) {
        try {
            Map<String, Object> result = client().post()
                    .uri(path)
                    .header("X-Internal-Secret", secret)
                    .header("X-Trace-Id", MDC.get("traceId") == null ? "" : MDC.get("traceId"))
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                    .timeout(Duration.ofSeconds(90))
                    .block();
            return result == null ? Map.of("ok", false) : result;
        } catch (WebClientResponseException ex) {
            log.error("AI service error {} {}", path, ex.getResponseBodyAsString());
            return Map.of("ok", false, "error", ex.getResponseBodyAsString(), "status", ex.getStatusCode().value());
        } catch (Exception ex) {
            log.error("AI service unreachable {}", path, ex);
            return Map.of("ok", false, "error", ex.getMessage());
        }
    }

    public Map<String, Object> get(String path) {
        try {
            Map<String, Object> result = client().get()
                    .uri(path)
                    .header("X-Internal-Secret", secret)
                    .header("X-Trace-Id", MDC.get("traceId") == null ? "" : MDC.get("traceId"))
                    .retrieve()
                    .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                    .timeout(Duration.ofSeconds(30))
                    .block();
            return result == null ? Map.of("ok", false) : result;
        } catch (WebClientResponseException ex) {
            log.error("AI service GET error {} {}", path, ex.getResponseBodyAsString());
            return Map.of("ok", false, "error", ex.getResponseBodyAsString(), "status", ex.getStatusCode().value());
        } catch (Exception ex) {
            log.error("AI service GET unreachable {}", path, ex);
            return Map.of("ok", false, "error", ex.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getList(String path) {
        try {
            List<Map<String, Object>> result = client().get()
                    .uri(path)
                    .header("X-Internal-Secret", secret)
                    .header("X-Trace-Id", MDC.get("traceId") == null ? "" : MDC.get("traceId"))
                    .retrieve()
                    .bodyToMono(new ParameterizedTypeReference<List<Map<String, Object>>>() {})
                    .timeout(Duration.ofSeconds(30))
                    .block();
            return result == null ? List.of() : result;
        } catch (WebClientResponseException ex) {
            log.error("AI service GET list error {} {}", path, ex.getResponseBodyAsString());
            return List.of();
        } catch (Exception ex) {
            log.error("AI service GET list unreachable {}", path, ex);
            return List.of();
        }
    }

    public Map<String, Object> delete(String path) {
        try {
            Map<String, Object> result = client().delete()
                    .uri(path)
                    .header("X-Internal-Secret", secret)
                    .header("X-Trace-Id", MDC.get("traceId") == null ? "" : MDC.get("traceId"))
                    .retrieve()
                    .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                    .timeout(Duration.ofSeconds(30))
                    .block();
            return result == null ? Map.of("ok", false) : result;
        } catch (WebClientResponseException ex) {
            log.error("AI service DELETE error {} {}", path, ex.getResponseBodyAsString());
            return Map.of("ok", false, "error", ex.getResponseBodyAsString(), "status", ex.getStatusCode().value());
        } catch (Exception ex) {
            log.error("AI service DELETE unreachable {}", path, ex);
            return Map.of("ok", false, "error", ex.getMessage());
        }
    }

    public reactor.core.publisher.Flux<String> postStream(String path, Map<String, Object> body) {
        return client().post()
                .uri(path)
                .header("X-Internal-Secret", secret)
                .header("X-Trace-Id", MDC.get("traceId") == null ? "" : MDC.get("traceId"))
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.TEXT_EVENT_STREAM)
                .bodyValue(body)
                .retrieve()
                .bodyToFlux(String.class);
    }
}