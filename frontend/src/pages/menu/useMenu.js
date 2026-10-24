import { useCallback, useEffect, useState } from "react";
import { api, errorCode } from "@/lib/api";
import { MOCK_DEMO_MENU } from "@/lib/mockDemoMenu";
import { DAY_NAMES } from "@/lib/i18n";

export function useMenu(slug) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/public/menu/${encodeURIComponent(slug)}`);
      if (data && Array.isArray(data.categories) && Array.isArray(data.items)) {
        setState({ loading: false, data, error: null });
        return data;
      }
      if (slug === "demo") {
        setState({ loading: false, data: MOCK_DEMO_MENU, error: null });
        return MOCK_DEMO_MENU;
      }
      setState({ loading: false, data: null, error: "NOT_FOUND" });
      return null;
    } catch (e) {
      if (slug === "demo") {
        setState({ loading: false, data: MOCK_DEMO_MENU, error: null });
        return MOCK_DEMO_MENU;
      }
      setState({ loading: false, data: null, error: errorCode(e) || "ERROR" });
      return null;
    }
  }, [slug]);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, reload: load };
}

const WEEKDAY = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

export function todayHours(settings, tr) {
  const hours = settings?.opening_hours || [];
  if (!hours.length) return tr("Open every day", "បើករាល់ថ្ងៃ");
  const name = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: settings.timezone || "Asia/Phnom_Penh" }).format(new Date());
  const today = hours.find((h) => h.day === WEEKDAY[name]);
  if (!today || today.closed) return tr("Closed today", "បិទថ្ងៃនេះ");
  if (today.open === today.close) return tr("Open 24 hours", "បើក ២៤ ម៉ោង");
  return `${tr("Today", "ថ្ងៃនេះ")} ${today.open}–${today.close}`;
}

export const dayLabel = (day, tr) => tr(...DAY_NAMES[day]);

export function closedMessage(reason, tr) {
  switch (reason) {
    case "CLOSED":
      return tr("We're closed right now. You can still browse the menu.", "ពេលនេះយើងបិទ។ អ្នកនៅតែអាចមើលម៉ឺនុយបាន។");
    case "TEMP_CLOSED":
      return tr("Ordering is paused for a moment. Please ask our staff.", "ការកុម្ម៉ង់ត្រូវបានផ្អាកបណ្ដោះអាសន្ន។ សូមសួរបុគ្គលិក។");
    case "ORDERING_PAUSED":
      return tr("Online ordering is unavailable. Please order with our staff.", "ការកុម្ម៉ង់តាមអនឡាញមិនទាន់អាចប្រើបាន។ សូមកុម្ម៉ង់ជាមួយបុគ្គលិក។");
    default:
      return tr("This restaurant is not taking orders right now.", "ភោជនីយដ្ឋាននេះមិនទទួលការកុម្ម៉ង់ទេពេលនេះ។");
  }
}
