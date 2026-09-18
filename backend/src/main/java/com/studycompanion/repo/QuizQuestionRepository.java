package com.studycompanion.repo;

import com.studycompanion.domain.QuizQuestion;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface QuizQuestionRepository extends MongoRepository<QuizQuestion, String> {
    List<QuizQuestion> findByQuizIdOrderByIdAsc(String quizId);
    List<QuizQuestion> findByProjectId(String projectId);
}
