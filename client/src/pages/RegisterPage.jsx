import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:outline-none";

export default function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(name, email, password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-4xl font-bold">DevTrail</h1>
          <p className="text-slate-400">Create your account</p>
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>
        )}

        <div className="space-y-2">
          <label htmlFor="name" className="text-sm text-slate-300">Name</label>
          <input id="name" required value={name}
            onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Your name" />
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm text-slate-300">Email</label>
          <input id="email" type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@example.com" />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm text-slate-300">Password</label>
          <input id="password" type="password" required minLength={8} value={password}
            onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="At least 8 characters" />
        </div>

        <button type="submit" disabled={loading}
          className="w-full rounded-lg bg-emerald-500 py-3 font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60">
          {loading ? "Creating account…" : "Create account"}
        </button>

        <p className="text-center text-sm text-slate-400">
          Already have an account? <Link to="/login" className="text-emerald-400 hover:underline">Log in</Link>
        </p>
      </form>
    </main>
  );
}