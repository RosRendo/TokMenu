import { useCallback, useEffect, useRef, useState } from "react";
import { api, wsUrl } from "@/lib/api";

export function useLiveSocket(path, onMessage, enabled = true) {
  const [connected, setConnected] = useState(false);
  const handler = useRef(onMessage);
  handler.current = onMessage;

  useEffect(() => {
    if (!enabled || !path) return undefined;
    let ws;
    let ping;
    let retry;
    let closed = false;
    let attempt = 0;

    const schedule = async (code) => {
      attempt += 1;
      if (code === 4401) {
        try {
          await api.get("/auth/me");
        } catch (e) {
          /* session refresh failed; keep polling fallback */
        }
      }
      if (!closed) retry = setTimeout(connect, Math.min(30000, 1000 * 2 ** Math.min(attempt, 5)));
    };

    function connect() {
      try {
        ws = new WebSocket(wsUrl(path));
      } catch (e) {
        schedule();
        return;
      }
      ws.onopen = () => {
        attempt = 0;
        setConnected(true);
        ping = setInterval(() => {
          if (ws.readyState === 1) ws.send("ping");
        }, 25000);
      };
      ws.onmessage = (event) => {
        if (event.data === "pong") return;
        try {
          handler.current?.(JSON.parse(event.data));
        } catch (e) {
          /* ignore malformed frames */
        }
      };
      ws.onclose = (event) => {
        setConnected(false);
        clearInterval(ping);
        if (!closed) schedule(event.code);
      };
      ws.onerror = () => {
        try {
          ws.close();
        } catch (e) {
          /* already closed */
        }
      };
    }

    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      clearInterval(ping);
      try {
        if (ws) ws.close();
      } catch (e) {
        /* noop */
      }
    };
  }, [path, enabled]);

  return connected;
}

export function useInterval(fn, ms, enabled = true) {
  const saved = useRef(fn);
  saved.current = fn;
  useEffect(() => {
    if (!enabled || !ms) return undefined;
    const id = setInterval(() => saved.current(), ms);
    return () => clearInterval(id);
  }, [ms, enabled]);
}

let audioCtx = null;

export function useOrderSound() {
  const [enabled, setEnabled] = useState(false);
  const enable = useCallback(() => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    audioCtx.resume();
    setEnabled(true);
  }, []);
  const disable = useCallback(() => setEnabled(false), []);
  const play = useCallback(() => {
    if (!enabled || !audioCtx) return;
    [0, 0.22].forEach((offset, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = i ? 1046 : 880;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.0001, audioCtx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.3, audioCtx.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + offset + 0.2);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(audioCtx.currentTime + offset);
      osc.stop(audioCtx.currentTime + offset + 0.22);
    });
  }, [enabled]);
  return { enabled, enable, disable, play };
}
