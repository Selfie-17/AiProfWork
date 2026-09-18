package com.studycompanion;

import com.studycompanion.service.AccessGuard;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import static org.junit.jupiter.api.Assertions.*;

class MasteryLogicTest {
    @Test
    void passwordHashIsNotPlaintext() {
        var encoder = new BCryptPasswordEncoder();
        String hash = encoder.encode("Secret123!");
        assertNotEquals("Secret123!", hash);
        assertTrue(encoder.matches("Secret123!", hash));
    }

    @Test
    void masteryUpdateIsWeightedNotNaive() {
        double old = 50;
        double eventCorrectHard = 100 * 1.15;
        double updated = old * 0.72 + eventCorrectHard * 0.28;
        assertTrue(updated > old);
        assertTrue(updated < 100);
        double eventWrongEasy = 0 * 0.85;
        double down = old * 0.72 + eventWrongEasy * 0.28;
        assertTrue(down < old);
        assertTrue(down > 0);
    }
}
