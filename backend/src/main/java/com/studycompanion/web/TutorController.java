package com.studycompanion.web;

import com.studycompanion.common.ApiException;
import com.studycompanion.common.ApiResponse;
import com.studycompanion.domain.Conversation;
import com.studycompanion.domain.LearningContext;
import com.studycompanion.domain.Message;
import com.studycompanion.domain.Project;
import com.studycompanion.repo.ConversationRepository;
import com.studycompanion.repo.LearningContextRepository;
import com.studycompanion.repo.MessageRepository;
import com.studycompanion.security.UserPrincipal;
import com.studycompanion.service.AccessGuard;
import com.studycompanion.service.ActivityService;
import com.studycompanion.service.AiServiceClient;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

@RestController
public class TutorController {
    private final AccessGuard accessGuard;
    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final LearningContextRepository learningContextRepository;
    private final AiServiceClient aiServiceClient;
    private final ActivityService activityService;
    private final ObjectMapper objectMapper;

    public TutorController(AccessGuard accessGuard, ConversationRepository conversationRepository, MessageRepository messageRepository, LearningContextRepository learningContextRepository, AiServiceClient aiServiceClient, ActivityService activityService, ObjectMapper objectMapper) {
        this.accessGuard = accessGuard;
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.learningContextRepository = learningContextRepository;
        this.aiServiceClient = aiServiceClient;
        this.activityService = activityService;
        this.objectMapper = objectMapper;
    }


    @GetMapping("/api/tutor/conversations")
    public ApiResponse<List<Conversation>> conversations(@RequestParam String projectId,
                                                         @AuthenticationPrincipal UserPrincipal user) {
        accessGuard.requireProject(projectId);
        return ApiResponse.ok(conversationRepository.findByProjectIdAndUserIdOrderByCreatedAtDesc(projectId, user.getId()));
    }

    @PostMapping("/api/tutor/conversations")
    public ApiResponse<Conversation> create(@AuthenticationPrincipal UserPrincipal user, @RequestBody Map<String, String> body) {
        String projectId = body.get("projectId");
        accessGuard.requireProject(projectId);
        Conversation c = new Conversation();
        c.setProjectId(projectId);
        c.setUserId(user.getId());
        c.setTitle(body.getOrDefault("title", "New conversation"));
        c.setCreatedAt(Instant.now());
        return ApiResponse.ok(conversationRepository.save(c));
    }

    @GetMapping("/api/tutor/conversations/{id}/messages")
    public ApiResponse<List<Message>> messages(@PathVariable String id) {
        Conversation c = conversationRepository.findById(id).orElseThrow(() -> ApiException.notFound("Conversation not found"));
        accessGuard.requireProject(c.getProjectId());
        return ApiResponse.ok(messageRepository.findByConversationIdOrderByCreatedAtAsc(id));
    }

    @PutMapping("/api/tutor/conversations/{id}")
    public ApiResponse<Conversation> updateConversation(
            @PathVariable String id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal UserPrincipal user) {
        Conversation c = conversationRepository.findById(id).orElseThrow(() -> ApiException.notFound("Conversation not found"));
        accessGuard.requireProject(c.getProjectId());
        if (!c.getUserId().equals(user.getId())) throw ApiException.forbidden("Cannot modify conversation");
        if (body.containsKey("title") && body.get("title") != null && !body.get("title").isBlank()) {
            c.setTitle(body.get("title").trim());
        }
        return ApiResponse.ok(conversationRepository.save(c));
    }

    @DeleteMapping("/api/tutor/conversations/{id}")
    public ApiResponse<Void> deleteConversation(
            @PathVariable String id,
            @AuthenticationPrincipal UserPrincipal user) {
        Conversation c = conversationRepository.findById(id).orElseThrow(() -> ApiException.notFound("Conversation not found"));
        accessGuard.requireProject(c.getProjectId());
        if (!c.getUserId().equals(user.getId())) throw ApiException.forbidden("Cannot delete conversation");
        messageRepository.deleteByConversationId(id);
        conversationRepository.delete(c);
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/api/projects/{projectId}/tutor/conversations")
    public ApiResponse<Void> clearAllConversations(
            @PathVariable String projectId,
            @AuthenticationPrincipal UserPrincipal user) {
        accessGuard.requireProject(projectId);
        List<Conversation> convos = conversationRepository.findByProjectIdAndUserIdOrderByCreatedAtDesc(projectId, user.getId());
        for (Conversation c : convos) {
            messageRepository.deleteByConversationId(c.getId());
            conversationRepository.delete(c);
        }
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/api/tutor/messages/{id}")
    public ApiResponse<Void> deleteMessage(
            @PathVariable String id,
            @AuthenticationPrincipal UserPrincipal user) {
        Message m = messageRepository.findById(id).orElseThrow(() -> ApiException.notFound("Message not found"));
        Conversation c = conversationRepository.findById(m.getConversationId()).orElse(null);
        if (c != null) {
            accessGuard.requireProject(c.getProjectId());
            if (!c.getUserId().equals(user.getId())) throw ApiException.forbidden("Cannot delete message");
        }
        messageRepository.delete(m);
        return ApiResponse.ok(null);
    }

    @PostMapping("/api/tutor/ask")
    public ApiResponse<Map<String, Object>> ask(@AuthenticationPrincipal UserPrincipal user, @Valid @RequestBody AskReq req) {
        Project project = accessGuard.requireProject(req.getProjectId());
        String question = req.getQuestion().trim();
        if (question.length() > 4000) throw ApiException.badRequest("Question too long");

        Conversation conversation;
        if (req.getConversationId() != null && !req.getConversationId().isBlank()) {
            conversation = conversationRepository.findById(req.getConversationId())
                    .orElseThrow(() -> ApiException.notFound("Conversation not found"));
            if (!conversation.getProjectId().equals(project.getId())) {
                throw ApiException.forbidden("Conversation does not belong to project");
            }
        } else {
            conversation = new Conversation();
            conversation.setProjectId(project.getId());
            conversation.setUserId(user.getId());
            conversation.setTitle(question.length() > 48 ? question.substring(0, 48) : question);
            conversation.setCreatedAt(Instant.now());
            conversation = conversationRepository.save(conversation);
        }

        Message userMsg = new Message();
        userMsg.setConversationId(conversation.getId());
        userMsg.setProjectId(project.getId());
        userMsg.setRole("user");
        userMsg.setContent(question);
        userMsg.setCreatedAt(Instant.now());
        messageRepository.save(userMsg);

        List<Message> recent = messageRepository.findTop8ByConversationIdOrderByCreatedAtDesc(conversation.getId());
        LearningContext ctx = learningContextRepository.findByProjectIdAndUserId(project.getId(), user.getId()).orElse(null);

        Map<String, Object> ai = aiServiceClient.post("/tutor/answer", Map.of(
                "projectId", project.getId(),
                "question", question,
                "conversationId", conversation.getId(),
                "recentMessages", recent.stream().map(m -> Map.of("role", m.getRole(), "content", m.getContent())).toList(),
                "learningContext", ctx == null ? Map.of() : Map.of(
                        "goals", ctx.getGoals() == null ? "" : ctx.getGoals(),
                        "strengths", ctx.getStrengths(),
                        "weaknesses", ctx.getWeaknesses(),
                        "repeatedMistakes", ctx.getRepeatedMistakes()
                )
        ));

        boolean ok = !Boolean.FALSE.equals(ai.get("ok"));
        String answer = String.valueOf(ai.getOrDefault("answer",
                ok ? "" : "The tutor is temporarily unavailable. Please try again shortly."));
        Object citations = ai.getOrDefault("citations", List.of());
        String evidence = String.valueOf(ai.getOrDefault("evidenceStatus", "unknown"));

        Message assistant = new Message();
        assistant.setConversationId(conversation.getId());
        assistant.setProjectId(project.getId());
        assistant.setRole("assistant");
        assistant.setContent(answer);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> cites = citations instanceof List<?> list
                ? (List<Map<String, Object>>) list
                : new ArrayList<>();
        assistant.setCitations(cites);
        assistant.setEvidenceStatus(evidence);
        assistant.setCreatedAt(Instant.now());
        assistant = messageRepository.save(assistant);

        activityService.record(user.getId(), project.getId(), "TUTOR_ASK",
                Map.of("conversationId", conversation.getId()),
                "tutor:" + assistant.getId());

        return ApiResponse.ok(Map.of(
                "conversationId", conversation.getId(),
                "message", assistant,
                "ai", ai
        ));
    }

    @PostMapping(value = "/api/tutor/stream", produces = org.springframework.http.MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@AuthenticationPrincipal UserPrincipal user, @Valid @RequestBody AskReq req) {
        Project project = accessGuard.requireProject(req.getProjectId());
        String question = req.getQuestion().trim();
        if (question.length() > 4000) throw ApiException.badRequest("Question too long");

        Conversation conversation;
        if (req.getConversationId() != null && !req.getConversationId().isBlank()) {
            conversation = conversationRepository.findById(req.getConversationId())
                    .orElseThrow(() -> ApiException.notFound("Conversation not found"));
            if (!conversation.getProjectId().equals(project.getId())) {
                throw ApiException.forbidden("Conversation does not belong to project");
            }
        } else {
            conversation = new Conversation();
            conversation.setProjectId(project.getId());
            conversation.setUserId(user.getId());
            conversation.setTitle(question.length() > 48 ? question.substring(0, 48) : question);
            conversation.setCreatedAt(Instant.now());
            conversation = conversationRepository.save(conversation);
        }

        Message userMsg = new Message();
        userMsg.setConversationId(conversation.getId());
        userMsg.setProjectId(project.getId());
        userMsg.setRole("user");
        userMsg.setContent(question);
        userMsg.setCreatedAt(Instant.now());
        messageRepository.save(userMsg);

        List<Message> recent = messageRepository.findTop8ByConversationIdOrderByCreatedAtDesc(conversation.getId());
        LearningContext ctx = learningContextRepository.findByProjectIdAndUserId(project.getId(), user.getId()).orElse(null);

        Map<String, Object> payload = Map.of(
                "projectId", project.getId(),
                "question", question,
                "conversationId", conversation.getId(),
                "recentMessages", recent.stream().map(m -> Map.of("role", m.getRole(), "content", m.getContent())).toList(),
                "learningContext", ctx == null ? Map.of() : Map.of(
                        "goals", ctx.getGoals() == null ? "" : ctx.getGoals(),
                        "strengths", ctx.getStrengths(),
                        "weaknesses", ctx.getWeaknesses(),
                        "repeatedMistakes", ctx.getRepeatedMistakes()
                )
        );

        SseEmitter emitter = new SseEmitter(120_000L);
        StringBuilder fullAnswer = new StringBuilder();
        String finalConvId = conversation.getId();
        AtomicReference<List<Map<String, Object>>> citationsRef = new AtomicReference<>(new ArrayList<>());
        AtomicReference<String> evidenceRef = new AtomicReference<>("grounded");

        aiServiceClient.postStream("/tutor/stream", payload).subscribe(
                rawLine -> {
                    try {
                        emitter.send(SseEmitter.event().data(rawLine));
                        if (rawLine.contains("\"chunk\"")) {
                            Map<?, ?> parsed = objectMapper.readValue(rawLine, Map.class);
                            Object chunk = parsed.get("chunk");
                            if (chunk != null) fullAnswer.append(chunk);
                        }
                        if (rawLine.contains("\"done\": true") || rawLine.contains("\"done\":true")) {
                            Map<?, ?> parsed = objectMapper.readValue(rawLine, Map.class);
                            Object cites = parsed.get("citations");
                            if (cites instanceof List<?> l) {
                                @SuppressWarnings("unchecked")
                                List<Map<String, Object>> cast = (List<Map<String, Object>>) l;
                                citationsRef.set(cast);
                            }
                            if (parsed.get("evidenceStatus") != null) {
                                evidenceRef.set(String.valueOf(parsed.get("evidenceStatus")));
                            }
                        }
                    } catch (Exception ignored) {
                    }
                },
                error -> {
                    try {
                        emitter.send(SseEmitter.event().name("error").data(error.getMessage()));
                    } catch (Exception ignored) {}
                    emitter.completeWithError(error);
                },
                () -> {
                    try {
                        Message assistant = new Message();
                        assistant.setConversationId(finalConvId);
                        assistant.setProjectId(project.getId());
                        assistant.setRole("assistant");
                        assistant.setContent(fullAnswer.toString());
                        assistant.setCitations(citationsRef.get());
                        assistant.setEvidenceStatus(evidenceRef.get());
                        assistant.setCreatedAt(Instant.now());
                        assistant = messageRepository.save(assistant);

                        activityService.record(user.getId(), project.getId(), "TUTOR_STREAM",
                                Map.of("conversationId", finalConvId),
                                "tutor:" + assistant.getId());

                        emitter.send(SseEmitter.event().name("complete").data(Map.of(
                                "conversationId", finalConvId,
                                "messageId", assistant.getId()
                        )));
                        emitter.complete();
                    } catch (Exception e) {
                        emitter.completeWithError(e);
                    }
                }
        );

        return emitter;
    }

    public static class AskReq  {

        @NotBlank private String projectId;
        @NotBlank private String question;
        private String conversationId;
    

        public AskReq() {}
        public String getProjectId() { return this.projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
        public String getQuestion() { return this.question; }
    public void setQuestion(String question) { this.question = question; }
        public String getConversationId() { return this.conversationId; }
    public void setConversationId(String conversationId) { this.conversationId = conversationId; }
    }
}