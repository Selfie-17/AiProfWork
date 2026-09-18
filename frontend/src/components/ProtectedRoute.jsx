import { Navigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function ProtectedRoute({ children, role }) {
  const { user } = useAuth();
  if (!localStorage.getItem("accessToken")) return <Navigate to="/login" replace />;
  if (role && user && user.role !== role) return <Navigate to="/home" replace />;
  return children;
}
