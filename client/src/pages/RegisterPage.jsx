import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth.js";

const inputClass =
  "w-full rounded-md border border-line-strong bg-card px-4 py-3 text-ink placeholder-faint focus:border-brand focus:outline-none";

export default function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to="/library" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(name, email, password);
      navigate("/library");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-page text-ink flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-4xl font-bold">Dev<span className="text-brand">Trail</span></h1>
          <p className="text-muted">Create your account</p>
        </div>

        {error && (
          <p className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-danger">{error}</p>
        )}

        <div className="space-y-2">
          <label htmlFor="name" className="text-sm text-soft">Name</label>
          <input id="name" required value={name}
            onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Your name" />
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm text-soft">Email</label>
          <input id="email" type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@example.com" />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm text-soft">Password</label>
          <input id="password" type="password" required minLength={8} value={password}
            onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="At least 8 characters" />
        </div>

        <button type="submit" disabled={loading}
          className="w-full rounded-md bg-brand py-3 font-semibold text-on-brand glow hover:bg-brand-hover disabled:opacity-60">
          {loading ? "Creating account…" : "Create account"}
        </button>

        <p className="text-center text-sm text-muted">
          Already have an account? <Link to="/login" className="text-accent hover:underline">Log in</Link>
        </p>
      </form>
    </main>
  );
}