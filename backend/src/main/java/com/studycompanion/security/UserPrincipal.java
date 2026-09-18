package com.studycompanion.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

public class UserPrincipal implements UserDetails {
    private final String id;
    private final String email;
    private final String role;
    private final String passwordHash;

    public UserPrincipal(String id, String email, String role, String passwordHash) {
        this.id = id;
        this.email = email;
        this.role = role;
        this.passwordHash = passwordHash;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role));
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() { return true; }
    @Override
    public boolean isAccountNonLocked() { return true; }
    @Override
    public boolean isCredentialsNonExpired() { return true; }
    @Override
    public boolean isEnabled() { return true; }

    public String getId() { return id; }
    public String getEmail() { return email; }
    public String getRole() { return role; }
    public String getPasswordHash() { return passwordHash; }

}
