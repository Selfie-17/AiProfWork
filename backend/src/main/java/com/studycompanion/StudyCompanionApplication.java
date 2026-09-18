package com.studycompanion;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class StudyCompanionApplication {
    public static void main(String[] args) {
        SpringApplication.run(StudyCompanionApplication.class, args);
    }
}
