package com.studycompanion.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document("spaces")
public class Space {
    @Id private String id;
    @Indexed private String userId;
    private String name;
    private String description;
    private String colorTheme;
    private Instant createdAt;

    public Space() {}
    public String getId() { return this.id; }
    public void setId(String id) { this.id = id; }
    public String getUserId() { return this.userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getName() { return this.name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return this.description; }
    public void setDescription(String description) { this.description = description; }
    public String getColorTheme() { return this.colorTheme; }
    public void setColorTheme(String colorTheme) { this.colorTheme = colorTheme; }
    public Instant getCreatedAt() { return this.createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

}
