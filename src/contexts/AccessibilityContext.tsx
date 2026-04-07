import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

interface AccessibilityState {
  highContrast: boolean;
  largeText: boolean;
  reducedMotion: boolean;
  simplified: boolean;
  darkMode: boolean;
}

interface AccessibilityContextType extends AccessibilityState {
  toggleHighContrast: () => void;
  toggleLargeText: () => void;
  toggleReducedMotion: () => void;
  toggleSimplified: () => void;
  toggleDarkMode: () => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | null>(null);

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error("useAccessibility must be used within AccessibilityProvider");
  return ctx;
}

const STORAGE_KEY = "dgtg-accessibility";

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AccessibilityState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      highContrast: false,
      largeText: false,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      simplified: false,
      darkMode: window.matchMedia("(prefers-color-scheme: dark)").matches,
    };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const root = document.documentElement;
    
    root.classList.toggle("dark", state.darkMode && !state.highContrast);
    root.classList.toggle("high-contrast", state.highContrast);
    root.classList.toggle("large-text", state.largeText);
    root.classList.toggle("reduced-motion", state.reducedMotion);
    root.classList.toggle("simplified", state.simplified);
  }, [state]);

  const toggle = useCallback((key: keyof AccessibilityState) => {
    setState(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  return (
    <AccessibilityContext.Provider
      value={{
        ...state,
        toggleHighContrast: () => toggle("highContrast"),
        toggleLargeText: () => toggle("largeText"),
        toggleReducedMotion: () => toggle("reducedMotion"),
        toggleSimplified: () => toggle("simplified"),
        toggleDarkMode: () => toggle("darkMode"),
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}
