import { createContext, useContext, useEffect, useState } from "react";
import api from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    if (localStorage.getItem("accessToken")) {
      api.get("/api/auth/me").then((r) => {
        setUser(r.data.data);
        localStorage.setItem("user", JSON.stringify(r.data.data));
      }).catch(() => {});
    }
  }, []);

  const login = (payload) => {
    localStorage.setItem("accessToken", payload.accessToken);
    localStorage.setItem("refreshToken", payload.refreshToken);
    localStorage.setItem("user", JSON.stringify(payload.user));
    setUser(payload.user);
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
