import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "flameer_admin_theme";

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
}>({ theme: "dark", toggle: () => {} });

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  // SALA DE CONTROLE (17/08): o painel é dark-first — :root do index.css JÁ
  // é o tema escuro; o claro é opt-in via classe .light. A escolha persiste.
  const [theme, setTheme] = useState<Theme>(() =>
    (localStorage.getItem(STORAGE_KEY) as Theme) ?? "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
