package com.studycompanion.auth;

import com.studycompanion.common.ApiException;
import com.studycompanion.common.ApiResponse;
import com.studycompanion.domain.User;
import com.studycompanion.repo.UserRepository;
import com.studycompanion.security.JwtService;
import com.studycompanion.security.UserPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthController(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }


    @PostMapping("/register")
    public ApiResponse<Map<String, Object>> register(@Valid @RequestBody RegisterRequest req) {
        if (userRepository.existsByEmail(req.getEmail().toLowerCase())) {
            throw ApiException.conflict("Email already registered");
        }
        User user = new User();
        user.setName(req.getName().trim());
        user.setEmail(req.getEmail().toLowerCase());
        user.setPasswordHash(passwordEncoder.encode(req.getPassword()));
        user.setRole("USER");
        user.setCreatedAt(Instant.now());
        user = userRepository.save(user);
        return ApiResponse.ok(tokens(user));
    }

    @PostMapping("/login")
    public ApiResponse<Map<String, Object>> login(@Valid @RequestBody LoginRequest req) {
        User user = userRepository.findByEmail(req.getEmail().toLowerCase())
                .orElseThrow(() -> ApiException.badRequest("Invalid credentials"));
        if (!passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
            throw ApiException.badRequest("Invalid credentials");
        }
        return ApiResponse.ok(tokens(user));
    }

    @PostMapping("/refresh")
    public ApiResponse<Map<String, Object>> refresh(@RequestBody Map<String, String> body) {
        String refresh = body.get("refreshToken");
        if (refresh == null) throw ApiException.badRequest("refreshToken required");
        var claims = jwtService.parse(refresh);
        if (!"refresh".equals(String.valueOf(claims.get("typ")))) {
            throw ApiException.badRequest("Invalid refresh token");
        }
        User user = userRepository.findById(claims.getSubject())
                .orElseThrow(() -> ApiException.badRequest("User not found"));
        return ApiResponse.ok(tokens(user));
    }

    @GetMapping("/me")
    public ApiResponse<Map<String, Object>> me(@AuthenticationPrincipal UserPrincipal principal) {
        User user = userRepository.findById(principal.getId()).orElseThrow();
        return ApiResponse.ok(Map.of(
                "id", user.getId(),
                "name", user.getName(),
                "email", user.getEmail(),
                "role", user.getRole()
        ));
    }

    private Map<String, Object> tokens(User user) {
        return Map.of(
                "accessToken", jwtService.createAccessToken(user.getId(), user.getEmail(), user.getRole()),
                "refreshToken", jwtService.createRefreshToken(user.getId()),
                "user", Map.of("id", user.getId(), "name", user.getName(), "email", user.getEmail(), "role", user.getRole())
        );
    }

    @Bean
    CommandLineRunner seedAdmin(PasswordEncoder encoder) {
        return args -> {
            if (userRepository.findByEmail("admin@studycompanion.local").isEmpty()) {
                User admin = new User();
                admin.setName("Admin");
                admin.setEmail("admin@studycompanion.local");
                admin.setPasswordHash(encoder.encode("Admin123!"));
                admin.setRole("ADMIN");
                admin.setCreatedAt(Instant.now());
                userRepository.save(admin);
            }
            if (userRepository.findByEmail("admin@gmail.com").isEmpty()) {
                User admin = new User();
                admin.setName("Admin");
                admin.setEmail("admin@gmail.com");
                admin.setPasswordHash(encoder.encode("Admin@123"));
                admin.setRole("ADMIN");
                admin.setCreatedAt(Instant.now());
                userRepository.save(admin);
            }
            if (userRepository.findByEmail("testuser@gmail.com").isEmpty()) {
                User testUser = new User();
                testUser.setName("Test User");
                testUser.setEmail("testuser@gmail.com");
                testUser.setPasswordHash(encoder.encode("Test@123"));
                testUser.setRole("USER");
                testUser.setCreatedAt(Instant.now());
                userRepository.save(testUser);
            }
        };
    }

    public static class RegisterRequest  {

        @NotBlank @Size(min = 2, max = 80) private String name;
        @Email @NotBlank private String email;
        @NotBlank @Size(min = 8, max = 72) private String password;
    

        public RegisterRequest() {}
        public String getName() { return this.name; }
    public void setName(String name) { this.name = name; }
        public String getEmail() { return this.email; }
    public void setEmail(String email) { this.email = email; }
        public String getPassword() { return this.password; }
    public void setPassword(String password) { this.password = password; }
    }

    public static class LoginRequest  {

        @Email @NotBlank private String email;
        @NotBlank private String password;
    

        public LoginRequest() {}
        public String getEmail() { return this.email; }
    public void setEmail(String email) { this.email = email; }
        public String getPassword() { return this.password; }
    public void setPassword(String password) { this.password = password; }
    }
}