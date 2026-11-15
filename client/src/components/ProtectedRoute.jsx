import { Navigate } from "react-router-dom";
import { useAuth } from "../context/auth.js";

export default function ProtectedRoute({ children }) {
  const { user, checking } = useAuth();

  if (checking) {
    return (
      <div className="min-h-screen grid place-items-center bg-page text-muted">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}