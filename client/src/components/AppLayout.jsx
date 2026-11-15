import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/auth.js";
import ThemeToggle from "./ThemeToggle.jsx";

function linkClass({ isActive }) {
  return `rounded-full px-4 py-1.5 text-sm transition-all ${
    isActive ? "bg-brand/10 text-brand shadow-[0_0_16px_rgba(34,211,238,0.12)]" : "text-muted hover:text-ink"
  }`;
}

export default function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-page text-ink selection:bg-brand/30 selection:text-brand">
      {/* The same soft glowing orbs as the landing page */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-[-10%] top-[-10%] h-[600px] w-[600px] rounded-full bg-brand/5 blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[600px] w-[600px] rounded-full bg-mint/5 blur-[150px]" />
      </div>

      <header className="sticky top-0 z-20 border-b border-line bg-page/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-6">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-wider">
              <span className="h-2 w-2 animate-pulse rounded-full bg-brand" aria-hidden="true" />
              DEVTRAIL
            </Link>
            <nav className="flex gap-1" aria-label="App">
              <NavLink to="/library" className={linkClass}>Library</NavLink>
              <NavLink to="/chat" className={linkClass}>Chat</NavLink>
              <NavLink to="/study" className={linkClass}>Study</NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <span className="hidden text-sm text-muted sm:inline">Hi, {user.name}</span>
            <button
              onClick={logout}
              className="rounded-full border border-line-strong px-4 py-1.5 text-xs font-semibold transition-all hover:border-brand/50 hover:bg-brand/5"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
