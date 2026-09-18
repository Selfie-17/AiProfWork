package com.studycompanion.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Document(collection = "concept_graphs")
public class ConceptGraph {
    @Id
    private String id;
    private String projectId;
    private List<Map<String, Object>> nodes = new ArrayList<>();
    private List<Map<String, Object>> edges = new ArrayList<>();
    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();

    public ConceptGraph() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }

    public List<Map<String, Object>> getNodes() { return nodes; }
    public void setNodes(List<Map<String, Object>> nodes) { this.nodes = nodes; }

    public List<Map<String, Object>> getEdges() { return edges; }
    public void setEdges(List<Map<String, Object>> edges) { this.edges = edges; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
