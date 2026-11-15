import { useState } from "react";
import { applyTheme, getSavedTheme, saveTheme } from "../theme.js";

// An iPhone-style switch: the round knob slides left (light) or right (dark)
export default function ThemeToggle() {
  const [theme, setTheme] = useState(getSavedTheme);
  const isDark = theme === "dark";

  function toggle() {
    const next = isDark ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    saveTheme(next);
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Dark mode"
      title={isDark ? "Dark mode is on" : "Dark mode is off"}
      onClick={toggle}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 ${
        isDark ? "border-brand/40 bg-brand/80 shadow-[0_0_14px_rgba(34,211,238,0.35)]" : "border-line-strong bg-line-strong"
      }`}
    >
      {/* the sliding knob, with a small sun or moon inside */}
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-700 shadow-md transition-transform duration-300 ease-out ${
          isDark ? "translate-x-[1.35rem]" : "translate-x-0.5"
        }`}
      >
        {isDark ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-3.5 w-3.5" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        )}
      </span>
    </button>
  );
}
