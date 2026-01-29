import { addDoc, collection, doc, increment, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

const viewerEventsCollection = collection(db, "viewer_events");
const VIEWER_SESSION_KEY = "rj_viewer_session_id";
const VIEWER_SESSION_LAST_KEY = "rj_viewer_session_last";
const VIEWER_SESSION_TIMEOUT_MS = 30 * 60 * 1000;

export type ViewerEventType = "navigate" | "search" | "listing_view";

type ViewerProfile = {
  email?: string;
  name?: string;
  provider?: string;
  displayName?: string;
  photoURL?: string;
  nickname?: string;
};

type ViewerEventPayload = {
  type: ViewerEventType;
  term?: string;
  complex?: string;
  listingId?: string;
  screen?: string;
  sessionId?: string;
};

type StoredSession = { id: string; last: number };

function normalizeOptionalText(value?: string) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function buildProfile(payload?: ViewerProfile) {
  if (!payload) return {};
  return {
    email: normalizeOptionalText(payload.email),
    name: normalizeOptionalText(payload.name),
    provider: normalizeOptionalText(payload.provider),
    displayName: normalizeOptionalText(payload.displayName),
    photoURL: normalizeOptionalText(payload.photoURL),
    nickname: normalizeOptionalText(payload.nickname),
  };
}

function readStoredSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const id = window.sessionStorage.getItem(VIEWER_SESSION_KEY) || "";
    const last = Number(window.sessionStorage.getItem(VIEWER_SESSION_LAST_KEY) || 0);
    if (!id) return null;
    return { id, last };
  } catch {
    return null;
  }
}

function touchStoredSession(sessionId: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(VIEWER_SESSION_KEY, sessionId);
    window.sessionStorage.setItem(VIEWER_SESSION_LAST_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

export function getViewerSessionId() {
  return readStoredSession()?.id ?? null;
}

export async function ensureViewerSession(uid: string, profile?: ViewerProfile & { screen?: string }) {
  if (!uid) return null;
  const now = Date.now();
  const stored = readStoredSession();
  const isExpired = !stored || !stored.last || now - stored.last > VIEWER_SESSION_TIMEOUT_MS;
  const sessionId = isExpired
    ? `${now}-${Math.random().toString(36).slice(2, 8)}`
    : stored!.id;

  touchStoredSession(sessionId);

  if (isExpired) {
    const ref = doc(db, "viewerSessions", uid, "logs", sessionId);
    await setDoc(
      ref,
      {
        uid,
        sessionId,
        startedAt: serverTimestamp(),
        lastPingAt: serverTimestamp(),
        screen: profile?.screen,
        ...buildProfile(profile),
      },
      { merge: true }
    );
  }

  return sessionId;
}

export async function pingViewerSession(uid: string) {
  const sessionId = getViewerSessionId();
  if (!uid || !sessionId) return;
  touchStoredSession(sessionId);
  const ref = doc(db, "viewerSessions", uid, "logs", sessionId);
  await setDoc(
    ref,
    {
      lastPingAt: serverTimestamp(),
      endedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function closeViewerSession(uid: string) {
  const sessionId = getViewerSessionId();
  if (!uid || !sessionId) return;
  const ref = doc(db, "viewerSessions", uid, "logs", sessionId);
  await setDoc(
    ref,
    {
      endedAt: serverTimestamp(),
      closedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

function normalizeTerm(term?: string) {
  if (!term) return undefined;
  const trimmed = term.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, 80);
}

export async function logViewerEvent(uid: string, payload: ViewerEventPayload) {
  if (!uid) return;
  const sessionId = payload.sessionId ?? getViewerSessionId() ?? undefined;
  const term = normalizeTerm(payload.term);
  const data = {
    uid,
    sessionId,
    type: payload.type,
    term,
    complex: payload.complex,
    listingId: payload.listingId,
    screen: payload.screen,
    createdAt: serverTimestamp(),
  };
  await addDoc(viewerEventsCollection, data);

  if (sessionId) {
    const ref = doc(db, "viewerSessions", uid, "logs", sessionId);
    const updates: Record<string, any> = {
      lastEventAt: serverTimestamp(),
      endedAt: serverTimestamp(),
    };
    if (payload.type === "search") updates.searchCount = increment(1);
    if (payload.type === "listing_view") updates.detailCount = increment(1);
    if (payload.type === "navigate") updates.navigateCount = increment(1);
    await setDoc(ref, updates, { merge: true });
  }
}
