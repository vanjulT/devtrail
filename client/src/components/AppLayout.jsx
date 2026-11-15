import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/auth.js";
import ThemeToggle from "./ThemeToggle.jsx";
import MadeBy from "./MadeBy.jsx";

function linkClass({ isActive }) {
  return `shrink-0 rounded-full px-4 py-1.5 text-sm transition-all ${
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
        {/* On a phone the menu moves to its own row under the logo (and scrolls sideways if needed) */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6 md:h-16 md:flex-nowrap md:py-0">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-wider">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand" aria-hidden="true" />
            DEVTRAIL
          </Link>
          <nav
            className="order-last -mx-1 flex w-full gap-1 overflow-x-auto px-1 md:order-none md:mx-0 md:w-auto md:flex-1 md:overflow-visible md:px-0"
            aria-label="App"
          >
            <NavLink to="/library" className={linkClass}>Library</NavLink>
            <NavLink to="/chat" className={linkClass}>Chat</NavLink>
            <NavLink to="/study" className={linkClass}>Study</NavLink>
            <NavLink to="/plan" className={linkClass}>Plan</NavLink>
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <span className="hidden text-sm text-muted lg:inline">Hi, {user.name}</span>
            <button
              onClick={logout}
              className="rounded-full border border-line-strong px-4 py-1.5 text-xs font-semibold transition-all hover:border-brand/50 hover:bg-brand/5"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="relative z-10 pb-8 pt-4">
        <MadeBy />
      </footer>
    </div>
  );
}