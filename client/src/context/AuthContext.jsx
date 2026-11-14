import { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from "../api.js";

const AuthContext = createContext(null);
const TOKEN_KEY = "devtrail-token";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true); // true while we check a saved token

  // When the page opens: if a token is saved, ask the server who it belongs to
  useEffect(() => {
    async function loadUser() {
      if (!localStorage.getItem(TOKEN_KEY)) {
        setChecking(false);
        return;
      }
      try {
        const data = await apiFetch("/api/auth/me");
        setUser(data.user);
      } catch (error) {
        localStorage.removeItem(TOKEN_KEY); // token is old or broken: forget it
      } finally {
        setChecking(false);
      }
    }
    loadUser();
  }, []);

  function saveSession(data) {
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
  }

  async function login(email, password) {
    const data = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    saveSession(data);
  }

  async function register(name, email, password) {
    const data = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    saveSession(data);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, checking, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}