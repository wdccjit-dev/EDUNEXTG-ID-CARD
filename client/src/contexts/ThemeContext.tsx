import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export function getSystemTheme(): ResolvedTheme {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

export function getStoredPreference(defaultPreference: ThemePreference = "light"): ThemePreference {
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // localStorage may be disabled or inaccessible
  }
  return defaultPreference;
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "system") {
    return getSystemTheme();
  }
  return preference;
}

export function applyThemeClass(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", resolved === "dark" ? "#102728" : "#f7f6f2");
  }
}

interface ThemeContextType {
  preference: ThemePreference;
  theme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  toggleTheme?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultPreference?: ThemePreference;
  defaultTheme?: ThemePreference; // backwards compatibility alias
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultPreference = "light",
  defaultTheme,
  switchable = true,
}: ThemeProviderProps) {
  const initialPref = defaultTheme || defaultPreference;

  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    return switchable ? getStoredPreference(initialPref) : initialPref;
  });

  const [theme, setTheme] = useState<ResolvedTheme>(() => resolveTheme(preference));

  const setPreference = (newPref: ThemePreference) => {
    setPreferenceState(newPref);
    if (switchable) {
      try {
        localStorage.setItem("theme", newPref);
      } catch {
        // ignore
      }
    }
    const nextResolved = resolveTheme(newPref);
    setTheme(nextResolved);
    applyThemeClass(nextResolved);
  };

  // Sync class and theme-color on mount and preference changes
  useEffect(() => {
    const nextResolved = resolveTheme(preference);
    setTheme(nextResolved);
    applyThemeClass(nextResolved);
  }, [preference]);

  // Live matchMedia listener when preference is "system"
  useEffect(() => {
    if (preference !== "system" || typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      const nextTheme: ResolvedTheme = e.matches ? "dark" : "light";
      setTheme(nextTheme);
      applyThemeClass(nextTheme);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    } else if ((mediaQuery as any).addListener) {
      // Safari < 14 fallback
      (mediaQuery as any).addListener(handleChange);
      return () => (mediaQuery as any).removeListener(handleChange);
    }
  }, [preference]);

  const toggleTheme = switchable
    ? () => {
        setPreference(theme === "light" ? "dark" : "light");
      }
    : undefined;

  return (
    <ThemeContext.Provider value={{ preference, theme, setPreference, toggleTheme, switchable }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

