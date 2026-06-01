"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "dark",
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getDefaultTheme(): Theme {
  const hour = new Date().getHours();
  // Light mode 7am–7pm, dark otherwise
  return hour >= 7 && hour < 19 ? "light" : "dark";
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const saved = localStorage.getItem("yeah-theme") as Theme | null;
    const resolved = saved ?? getDefaultTheme();
    apply(resolved);
    setTheme(resolved);
  }, []);

  function apply(t: Theme) {
    document.documentElement.classList.toggle("light", t === "light");
  }

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    apply(next);
    localStorage.setItem("yeah-theme", next);
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
