import { useState } from "react";
import { applyTheme, getSavedTheme, saveTheme } from "../theme.js";

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getSavedTheme);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    saveTheme(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-line-strong text-sm transition-all hover:border-brand/50 hover:bg-brand/5"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
