const THEME_KEY = "devtrail-theme";

// Reads the saved choice (dark is the default)
export function getSavedTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

// Remembers the choice (private browsing may block this: then it just isn't remembered)
export function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // nothing to do
  }
}

// Puts the class "light" on <html> or removes it; index.css does the rest
export function applyTheme(theme) {
  document.documentElement.classList.toggle("light", theme === "light");
}
