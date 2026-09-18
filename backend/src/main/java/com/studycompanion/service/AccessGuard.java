package com.studycompanion.service;

import com.studycompanion.common.ApiException;
import com.studycompanion.domain.Project;
import com.studycompanion.domain.Space;
import com.studycompanion.repo.ProjectRepository;
import com.studycompanion.repo.SpaceRepository;
import com.studycompanion.security.UserPrincipal;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class AccessGuard {
    private final ProjectRepository projectRepository;
    private final SpaceRepository spaceRepository;

    public AccessGuard(ProjectRepository projectRepository, SpaceRepository spaceRepository) {
        this.projectRepository = projectRepository;
        this.spaceRepository = spaceRepository;
    }


    public UserPrincipal currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof UserPrincipal principal)) {
            throw ApiException.forbidden("Not authenticated");
        }
        return principal;
    }

    public Project requireProject(String projectId) {
        UserPrincipal user = currentUser();
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> ApiException.notFound("Project not found"));
        if (!project.getUserId().equals(user.getId()) && !"ADMIN".equals(user.getRole())) {
            throw ApiException.forbidden("Project isolation: access denied");
        }
        return project;
    }

    public Space requireSpace(String spaceId) {
        UserPrincipal user = currentUser();
        Space space = spaceRepository.findById(spaceId)
                .orElseThrow(() -> ApiException.notFound("Space not found"));
        if (!space.getUserId().equals(user.getId()) && !"ADMIN".equals(user.getRole())) {
            throw ApiException.forbidden("Space isolation: access denied");
        }
        return space;
    }
}