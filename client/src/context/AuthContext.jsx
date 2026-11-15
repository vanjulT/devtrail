import { useEffect, useState } from "react";
import { apiFetch } from "../api.js";
import { AuthContext } from "./auth.js";

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
      } catch {
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
