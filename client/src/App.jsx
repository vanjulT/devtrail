import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AppLayout from "./components/AppLayout.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import LibraryPage from "./pages/LibraryPage.jsx";
import ChatPage from "./pages/ChatPage.jsx";
import StudyPage from "./pages/StudyPage.jsx";
import DeckPage from "./pages/DeckPage.jsx";
import QuizPage from "./pages/QuizPage.jsx";

function App() {
  return (
    <Routes>
      {/* Public pages */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Every page inside here needs a login and shares the top menu */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/chat/:chatId" element={<ChatPage />} />
        <Route path="/study" element={<StudyPage />} />
        <Route path="/study/deck/:deckId" element={<DeckPage />} />
        <Route path="/study/quiz/:quizId" element={<QuizPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
