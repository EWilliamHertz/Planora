import { createContext, useContext, useState, useEffect, useCallback } from "react";

const API_URL = process.env.REACT_APP_BACKEND_URL;
const TOKEN_KEY = "planora_session_token";
const AuthContext = createContext(null);

// Safe Storage Helpers to prevent Private Window crashes
const getSafeToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
};
const setSafeToken = (token) => {
  try { if (token) localStorage.setItem(TOKEN_KEY, token); } catch (e) {}
};
const removeSafeToken = () => {
  try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
};

/** Authenticated fetch — attaches session token as Bearer header */
export async function authFetch(url, options = {}) {
  const token = getSafeToken();
  const headers = { ...(options.headers || {}) };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(url, { ...options, headers, credentials: "include" });
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    const token = getSafeToken();
    if (!token) {
      setLoading(false);
      setUser(null);
      return;
    }

    try {
      const res = await authFetch(`${API_URL}/api/auth/me`);
      const data = await res.json();
      
      if (res.ok && data && !data.detail) { 
        setUser(data);
      } else {
        removeSafeToken();
        setUser(null); 
      }
    } catch (error) {
      removeSafeToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
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
    setSafeToken(data.session_token);
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
    setSafeToken(data.session_token);
    setUser(data);
    return data;
  };

  const logout = async () => {
    try {
      await authFetch(`${API_URL}/api/auth/logout`, { method: "POST" });
    } catch {
      // Ignore
    }
    removeSafeToken();
    setUser(null);
  };

  const loginWithGoogle = () => {
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout, loginWithGoogle, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}