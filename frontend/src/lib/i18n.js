import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const LangContext = createContext({ lang: "en", setLang: () => {}, applyDefault: () => {} });
const STORAGE_KEY = "tok_lang";

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem(STORAGE_KEY) || "en");
  const setLang = useCallback((l) => {
    localStorage.setItem(STORAGE_KEY, l);
    setLangState(l);
  }, []);
  const applyDefault = useCallback((l) => {
    if (!localStorage.getItem(STORAGE_KEY) && (l === "en" || l === "km")) setLangState(l);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang, applyDefault }), [lang, setLang, applyDefault]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useI18n() {
  const { lang, setLang, applyDefault } = useContext(LangContext);
  const tr = useCallback((en, km) => (lang === "km" && km ? km : en), [lang]);
  const loc = useCallback(
    (obj, field = "name") => {
      if (!obj) return "";
      const km = obj[`${field}_km`];
      return lang === "km" && km ? km : obj[field] || "";
    },
    [lang],
  );
  return { lang, setLang, applyDefault, tr, loc };
}

export const STATUS_LABELS = {
  PENDING: ["New", "ថ្មី"],
  ACCEPTED: ["Accepted", "បានទទួល"],
  PREPARING: ["Preparing", "កំពុងរៀបចំ"],
  READY: ["Ready", "រួចរាល់"],
  COMPLETED: ["Completed", "បានបញ្ចប់"],
  REJECTED: ["Rejected", "បានបដិសេធ"],
};

export const DAY_NAMES = [
  ["Mon", "ច័ន្ទ"], ["Tue", "អង្គារ"], ["Wed", "ពុធ"], ["Thu", "ព្រហស្បតិ៍"],
  ["Fri", "សុក្រ"], ["Sat", "សៅរ៍"], ["Sun", "អាទិត្យ"],
];

export function formatTime(iso, lang, tz = "Asia/Phnom_Penh") {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(lang === "km" ? "km-KH" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz });
}

export function formatDate(iso, lang, tz = "Asia/Phnom_Penh") {
  if (!iso) return "";
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  return d.toLocaleDateString(lang === "km" ? "km-KH" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: tz });
}

export function minutesAgo(iso) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}
