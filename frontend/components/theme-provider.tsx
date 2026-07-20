"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "dark",
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  // Apply the stored theme on mount (dark is the default, set on <html> in the
  // server-rendered markup, so the common case never flashes).
  useEffect(() => {
    let stored: Theme = "dark";
    try {
      stored = (localStorage.getItem("negotiator-theme") as Theme) || "dark";
    } catch {
      /* ignore */
    }
    document.documentElement.setAttribute("data-theme", stored);
    setTheme(stored);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem("negotiator-theme", next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

/** Inline script string injected in <head> to set the theme before first paint
 *  (prevents a light/dark flash). Dark is the default. */
export const themeInitScript = `
(function(){
  try {
    var t = localStorage.getItem('negotiator-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;
