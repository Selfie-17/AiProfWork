import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AppShell from "./components/AppShell";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Spaces from "./pages/Spaces";
import SpaceDashboard from "./pages/SpaceDashboard";
import ProjectDashboard from "./pages/ProjectDashboard";
import Materials from "./pages/Materials";
import Tutor from "./pages/Tutor";
import Quiz from "./pages/Quiz";
import Flashcards from "./pages/Flashcards";
import ConceptMap from "./pages/ConceptMap";
import StudyPlan from "./pages/StudyPlan";
import Mistakes from "./pages/Mistakes";
import Growth from "./pages/Growth";
import ProjectAnalytics, { GlobalAnalytics } from "./pages/Analytics";
import Admin, { AdminUser } from "./pages/Admin";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Login mode="register" />} />
      <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route index element={<Navigate to="/home" replace />} />
        <Route path="home" element={<Home />} />
        <Route path="spaces" element={<Spaces />} />
        <Route path="spaces/:id" element={<SpaceDashboard />} />
        <Route path="projects/:id" element={<ProjectDashboard />} />
        <Route path="projects/:id/materials" element={<Materials />} />
        <Route path="projects/:id/tutor" element={<Tutor />} />
        <Route path="projects/:id/quiz" element={<Quiz />} />
        <Route path="projects/:id/flashcards" element={<Flashcards />} />
        <Route path="projects/:id/concept-map" element={<ConceptMap />} />
        <Route path="projects/:id/study-plan" element={<StudyPlan />} />
        <Route path="projects/:id/mistakes" element={<Mistakes />} />
        <Route path="projects/:id/growth" element={<Growth />} />
        <Route path="projects/:id/analytics" element={<ProjectAnalytics />} />
        <Route path="analytics/global" element={<GlobalAnalytics />} />
        <Route path="admin" element={<ProtectedRoute role="ADMIN"><Admin /></ProtectedRoute>} />
        <Route path="admin/users/:id" element={<ProtectedRoute role="ADMIN"><AdminUser /></ProtectedRoute>} />
      </Route>
    </Routes>
  );
}
