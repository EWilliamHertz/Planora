import { useEffect, useRef, useCallback } from "react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

export function useWebSocket(onMessage) {
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  const getWsUrl = useCallback(() => {
    const sessionToken = document.cookie
      .split("; ")
      .find((c) => c.startsWith("session_token="))
      ?.split("=")[1];
    if (!sessionToken) return null;
    const base = API_URL.replace(/^http/, "ws");
    return `${base}/api/ws/${sessionToken}`;
  }, []);

  const connect = useCallback(() => {
    const url = getWsUrl();
    if (!url) return;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage?.(data);
        } catch (e) {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        reconnectTimer.current = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      reconnectTimer.current = setTimeout(connect, 5000);
    }
  }, [getWsUrl, onMessage]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return wsRef;
}
