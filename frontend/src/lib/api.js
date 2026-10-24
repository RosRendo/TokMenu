import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";

export const api = axios.create({ baseURL: BACKEND_URL ? `${BACKEND_URL}/api` : "/api", withCredentials: true, timeout: 20000 });

const NO_REFRESH = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout", "/auth/forgot-password",
  "/auth/reset-password", "/auth/invites"];
let refreshing = null;

api.interceptors.response.use(
  (res) => {
    // Reject HTML responses from static SPA rewrites on API endpoints
    if (typeof res?.data === "string" && (res.data.trim().startsWith("<!DOCTYPE") || res.data.trim().startsWith("<html"))) {
      const err = new Error("API returned HTML fallback instead of JSON");
      err.response = { status: 404, data: { detail: "API endpoint not available" } };
      return Promise.reject(err);
    }
    return res;
  },
  async (error) => {
    const cfg = error.config;
    const skip = !cfg || cfg._retry || NO_REFRESH.some((p) => (cfg.url || "").startsWith(p));
    if (error.response?.status === 401 && !skip) {
      cfg._retry = true;
      try {
        refreshing = refreshing || api.post("/auth/refresh");
        await refreshing;
        refreshing = null;
        return api(cfg);
      } catch (e) {
        refreshing = null;
      }
    }
    return Promise.reject(error);
  },
);

export function errorCode(err) {
  return err?.response?.data?.detail?.code || (err?.response ? null : "NETWORK");
}

export function errorMessage(err, fallback = "Something went wrong. Please try again.") {
  const detail = err?.response?.data?.detail;
  if (!err?.response) return "Connection problem. Please check your internet and try again.";
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d?.msg || "").filter(Boolean).join(" ") || fallback;
  return detail.message || fallback;
}

export const imgUrl = (url) => (!url ? null : url.startsWith("/api/") ? `${BACKEND_URL}${url}` : url);

export const wsUrl = (path) => `${(BACKEND_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:8000")).replace(/^http/, "ws")}/api${path}`;

export const publicOrigin = () => window.location.origin;

export function uuid() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  const b = new Uint8Array(16);
  (window.crypto || window.msCrypto).getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("").replace(/^(.{8})(.{4})(.{4})(.{4})/, "$1-$2-$3-$4-");
}
