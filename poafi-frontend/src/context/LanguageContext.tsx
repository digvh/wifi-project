"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

type Language = "sw" | "en";

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  t: (sw: string, en: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "sw",
  setLang: () => {},
  toggleLang: () => {},
  t: (sw) => sw,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("sw");

  useEffect(() => {
    const saved = localStorage.getItem("poafi_lang") as Language;
    if (saved === "sw" || saved === "en") {
      setLangState(saved);
      document.documentElement.lang = saved;
    } else {
      document.documentElement.lang = "sw";
    }
  }, []);

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem("poafi_lang", newLang);
    if (typeof document !== "undefined") {
      document.documentElement.lang = newLang;
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === "sw" ? "en" : "sw");
  }, [lang, setLang]);

  const t = useCallback((sw: string, en: string) => (lang === "sw" ? sw : en), [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
