import { useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { logUserActivity } from "../state/useUserActivity";
import { closeViewerSession, ensureViewerSession, logViewerEvent, pingViewerSession } from "../state/useViewerEvents";

const HEARTBEAT_INTERVAL = 30_000;
const VIEWER_SESSION_PING_MS = 120_000;

export default function useUserActivityTracker() {
  const { user } = useAuth();
  const location = useLocation();
  const intervalRef = useRef<number | undefined>(undefined);
  const sessionPingRef = useRef<number | undefined>(undefined);
  const isViewerRoute =
    location.pathname.startsWith("/viewer") || location.pathname.startsWith("/viewer-");

  const track = useCallback(
    (action: string, detail?: string) => {
      if (!user) return;
      logUserActivity(user.uid, { screen: location.pathname, action, detail });
    },
    [user, location.pathname],
  );

  useEffect(() => {
    if (!user) return;
    track("navigate", location.pathname);
    if (isViewerRoute) {
      logViewerEvent(user.uid, { type: "navigate", screen: location.pathname }).catch(() => {});
    }
  }, [track, user, location.pathname, isViewerRoute]);

  useEffect(() => {
    if (!user) return;
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        track("visible");
      } else {
        track("hidden");
      }
    };
    const handleFocus = () => track("focus");
    const handleBlur = () => track("blur");
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, [user, track]);

  useEffect(() => {
    if (!user) return;
    const beat = () => track("heartbeat");
    beat();
    intervalRef.current = window.setInterval(beat, HEARTBEAT_INTERVAL);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    };
  }, [user, track]);

  useEffect(() => {
    if (!user || !isViewerRoute) return;
    ensureViewerSession(user.uid, {
      email: user.email ?? undefined,
      name: (user as any)?.name ?? (user as any)?.displayName ?? undefined,
      provider: (user as any)?.provider ?? undefined,
      displayName: (user as any)?.displayName ?? undefined,
      photoURL: (user as any)?.photoURL ?? undefined,
      nickname: (user as any)?.nickname ?? undefined,
      screen: location.pathname,
    }).catch(() => {});
    const ping = () => pingViewerSession(user.uid).catch(() => {});
    ping();
    sessionPingRef.current = window.setInterval(ping, VIEWER_SESSION_PING_MS);
    return () => {
      if (sessionPingRef.current) {
        clearInterval(sessionPingRef.current);
        sessionPingRef.current = undefined;
      }
      closeViewerSession(user.uid).catch(() => {});
    };
  }, [user, isViewerRoute]);

  useEffect(() => {
    if (!user) return;
    const onUnload = () => {
      track("tab-unload");
      if (isViewerRoute) closeViewerSession(user.uid).catch(() => {});
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [user, track, isViewerRoute]);
}
