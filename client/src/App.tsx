import { useState } from "react";
import Login from "./components/Login";
import Register from "./components/Register";
import ChatLayout from "./components/ChatLayout";
import { User } from "./types";
import "./App.css";

export default function App() {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem("token"),
  );
  const [user, setUser] = useState<User | null>(() => {
    const s = localStorage.getItem("user");
    return s ? (JSON.parse(s) as User) : null;
  });
  const [authView, setAuthView] = useState<"login" | "register">("login");

  const handleAuth = (token: string, user: User) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    setToken(token);
    setUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  if (!token || !user) {
    return (
      <div className="auth-page">
        <div className="auth-glow auth-glow-1" />
        <div className="auth-glow auth-glow-2" />
        <div className="auth-card">
          <div className="auth-logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <h1 className="auth-title">ChatApp</h1>
          <p className="auth-subtitle">
            {authView === "login" ? "Sign in to your account" : "Create a new account"}
          </p>

          <div className="auth-tabs">
            <button
              className={`tab ${authView === "login" ? "active" : ""}`}
              onClick={() => setAuthView("login")}
            >
              Login
            </button>
            <button
              className={`tab ${authView === "register" ? "active" : ""}`}
              onClick={() => setAuthView("register")}
            >
              Register
            </button>
          </div>

          {authView === "login" ? (
            <Login onSuccess={handleAuth} />
          ) : (
            <Register onSuccess={handleAuth} />
          )}
        </div>
      </div>
    );
  }

  return <ChatLayout user={user} token={token} onLogout={handleLogout} />;
}
