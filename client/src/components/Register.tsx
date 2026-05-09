import { useState, FormEvent } from "react";
import api from "../api/axios";
import { User } from "../types";

interface Props {
  onSuccess: (token: string, user: User) => void;
}

export default function Register({ onSuccess }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/register", { name, email, password });
      const { data } = await api.post<{ token: string; user: User }>("/auth/login", {
        email,
        password,
      });
      onSuccess(data.token, data.user);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          "Registration failed",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      {error && (
        <div className="error-msg">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          {error}
        </div>
      )}

      <div className="auth-field">
        <label className="auth-label">Display name</label>
        <input
          className="auth-input"
          type="text"
          placeholder="John Doe"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
      </div>

      <div className="auth-field">
        <label className="auth-label">Email</label>
        <input
          className="auth-input"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="auth-field">
        <label className="auth-label">Password</label>
        <input
          className="auth-input"
          type="password"
          placeholder="Min. 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
      </div>

      <div className="auth-field">
        <label className="auth-label">Confirm password</label>
        <input
          className={`auth-input ${confirm && confirm !== password ? "auth-input-error" : ""}`}
          type="password"
          placeholder="Repeat your password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        {confirm && confirm !== password && (
          <span className="auth-field-hint">Passwords do not match</span>
        )}
      </div>

      <button type="submit" className="auth-submit" disabled={loading || (!!confirm && confirm !== password)}>
        {loading ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
