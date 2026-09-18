package com.studycompanion.web;

import com.studycompanion.common.ApiResponse;
import com.studycompanion.domain.Concept;
import com.studycompanion.domain.ConceptGraph;
import com.studycompanion.repo.ConceptGraphRepository;
import com.studycompanion.repo.ConceptRepository;
import com.studycompanion.service.AccessGuard;
import com.studycompanion.service.AiServiceClient;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
public class ConceptGraphController {
    private final AccessGuard accessGuard;
    private final ConceptRepository conceptRepository;
    private final ConceptGraphRepository conceptGraphRepository;
    private final AiServiceClient aiServiceClient;

    public ConceptGraphController(AccessGuard accessGuard, ConceptRepository conceptRepository, ConceptGraphRepository conceptGraphRepository, AiServiceClient aiServiceClient) {
        this.accessGuard = accessGuard;
        this.conceptRepository = conceptRepository;
        this.conceptGraphRepository = conceptGraphRepository;
        this.aiServiceClient = aiServiceClient;
    }

    @GetMapping("/api/projects/{projectId}/concepts/graph")
    public ApiResponse<Map<String, Object>> getGraph(
            @PathVariable String projectId,
            @RequestParam(name = "refresh", defaultValue = "false") boolean refresh) {
        accessGuard.requireProject(projectId);

        // 1. If not a forced refresh, return the persisted graph if one exists
        if (!refresh) {
            Optional<ConceptGraph> cached = conceptGraphRepository.findByProjectId(projectId);
            if (cached.isPresent() && cached.get().getNodes() != null && !cached.get().getNodes().isEmpty()) {
                Map<String, Object> result = new HashMap<>();
                result.put("edges", cached.get().getEdges());
                result.put("nodes", enrichNodesWithMastery(projectId, cached.get().getNodes()));
                result.put("cached", true);
                return ApiResponse.ok(result);
            }
        }

        // 2. Otherwise generate from AI service and persist
        return regenerateInternal(projectId);
    }

    @PostMapping("/api/projects/{projectId}/concepts/graph/regenerate")
    public ApiResponse<Map<String, Object>> regenerateGraph(@PathVariable String projectId) {
        accessGuard.requireProject(projectId);
        return regenerateInternal(projectId);
    }

    private ApiResponse<Map<String, Object>> regenerateInternal(String projectId) {
        List<Concept> concepts = conceptRepository.findByProjectId(projectId);

        List<Map<String, Object>> conceptPayload = concepts.stream().map(c -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", c.getId());
            m.put("name", c.getName());
            m.put("description", c.getDescription());
            m.put("masteryScore", c.getMasteryScore());
            m.put("trend", c.getTrend());
            return m;
        }).toList();

        Map<String, Object> ai = aiServiceClient.post("/growth/concept-graph", Map.of(
                "projectId", projectId,
                "concepts", conceptPayload
        ));

        Object rawData = ai.get("data");
        if (rawData instanceof Map<?, ?> dataMap) {
            Map<String, Object> resultMap = new HashMap<>();
            dataMap.forEach((k, v) -> resultMap.put(String.valueOf(k), v));

            Object rawNodes = resultMap.get("nodes");
            Object rawEdges = resultMap.get("edges");

            List<Map<String, Object>> nodesList = new ArrayList<>();
            if (rawNodes instanceof List<?> nl) {
                for (Object item : nl) {
                    if (item instanceof Map<?, ?> m) {
                        Map<String, Object> copy = new HashMap<>();
                        m.forEach((k, v) -> copy.put(String.valueOf(k), v));
                        nodesList.add(copy);
                    }
                }
            }

            List<Map<String, Object>> edgesList = new ArrayList<>();
            if (rawEdges instanceof List<?> el) {
                for (Object item : el) {
                    if (item instanceof Map<?, ?> m) {
                        Map<String, Object> copy = new HashMap<>();
                        m.forEach((k, v) -> copy.put(String.valueOf(k), v));
                        edgesList.add(copy);
                    }
                }
            }

            // Persist graph to database so it stays fixed across navigation
            ConceptGraph graph = conceptGraphRepository.findByProjectId(projectId).orElseGet(() -> {
                ConceptGraph cg = new ConceptGraph();
                cg.setProjectId(projectId);
                return cg;
            });
            graph.setNodes(nodesList);
            graph.setEdges(edgesList);
            graph.setUpdatedAt(Instant.now());
            conceptGraphRepository.save(graph);

            resultMap.put("nodes", enrichNodesWithMastery(projectId, nodesList));
            resultMap.put("edges", edgesList);
            resultMap.put("cached", false);
            return ApiResponse.ok(resultMap);
        }

        return ApiResponse.ok(Map.of("nodes", List.of(), "edges", List.of()));
    }

    private List<Map<String, Object>> enrichNodesWithMastery(String projectId, List<Map<String, Object>> nodesList) {
        List<Concept> concepts = conceptRepository.findByProjectId(projectId);
        Map<String, Concept> conceptByName = new HashMap<>();
        for (Concept c : concepts) {
            conceptByName.put(c.getName().toLowerCase(), c);
            if (c.getId() != null) conceptByName.put(c.getId(), c);
        }

        List<Map<String, Object>> enrichedNodes = new ArrayList<>();
        for (Map<String, Object> nm : nodesList) {
            Map<String, Object> enriched = new HashMap<>(nm);
            String label = String.valueOf(enriched.getOrDefault("label", enriched.get("name")));
            Concept match = conceptByName.get(label.toLowerCase());
            if (match == null && enriched.get("id") != null) {
                match = conceptByName.get(String.valueOf(enriched.get("id")));
            }
            enriched.put("masteryScore", match != null ? match.getMasteryScore() : 40.0);
            enriched.put("trend", match != null ? match.getTrend() : "STABLE");
            enrichedNodes.add(enriched);
        }
        return enrichedNodes;
    }
}
