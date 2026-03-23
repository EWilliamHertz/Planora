import { createContext, useContext, useState, useEffect, useCallback } from "react";

const API_URL = process.env.REACT_APP_BACKEND_URL;
const TOKEN_KEY = "planora_session_token";
const AuthContext = createContext(null);

/** Authenticated fetch — attaches session token as Bearer header */
export async function authFetch(url, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = { ...(options.headers || {}) };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(url, { ...options, headers, credentials: "include" });
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const storeToken = (token) => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
  };

  const clearToken = () => {
    localStorage.removeItem(TOKEN_KEY);
  };

  const checkAuth = useCallback(async () => {
    // Handle Google OAuth callback — the redirect lands with #session_id=XXXX in the hash
    if (window.location.hash?.includes("session_id=")) {
      const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const sessionId = params.get("session_id");
      if (sessionId) {
        try {
          const res = await fetch(`${API_URL}/api/auth/session?session_id=${sessionId}`, {
            credentials: "include",
          });
          if (res.ok) {
            const data = await res.json();
            if (data.session_token) {
              storeToken(data.session_token);
              setUser(data);
            }
          }
        } catch {
          // ignore network errors
        }
        // Clean the hash from the URL so it doesn't re-trigger
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      setLoading(false);
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await authFetch(`${API_URL}/api/auth/me`);
      if (res.ok) {
        setUser(await res.json());
      } else {
        clearToken();
      }
    } catch {
      // Not authenticated
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Login failed");
    }
    const data = await res.json();
    storeToken(data.session_token);
    setUser(data);
    return data;
  };

  const register = async (name, email, password) => {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Registration failed");
    }
    const data = await res.json();
    storeToken(data.session_token);
    setUser(data);
    return data;
  };

  const logout = async () => {
    try {
      await authFetch(`${API_URL}/api/auth/logout`, { method: "POST" });
    } catch {
      // Ignore
    }
    clearToken();
    setUser(null);
  };

  const loginWithGoogle = () => {
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout, loginWithGoogle, storeToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
