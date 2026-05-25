import { useState } from "react";
import { useNavigate } from "react-router-dom";

export interface AuthUser {
  email: string;
  role: string;
  token: string;
}

export function useAuth() {
  // Read localStorage synchronously so the very first render already has
  // the correct auth state — prevents the Navbar from flashing between
  // logged-out and logged-in states (the actual root cause of FOUC).
  const [user, setUser] = useState<AuthUser | null>(() => {
    const token = localStorage.getItem("token");
    const email = localStorage.getItem("email");
    const role = localStorage.getItem("role");
    if (token && email) {
      return { email, role: role ?? "admin", token };
    }
    return null;
  });
  const [loading] = useState(false);

  const logout = (navigate?: ReturnType<typeof useNavigate>) => {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("role");
    localStorage.removeItem("email");
    setUser(null);
    if (navigate) navigate("/signin");
    else window.location.href = "/signin";
  };

  const isLoggedIn = !!user;

  return { user, loading, isLoggedIn, logout };
}
