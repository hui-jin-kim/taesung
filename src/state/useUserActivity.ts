import React from "react";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "../lib/firebase";

const loginEventsCollection = collection(db, "loginEvents");

export type RecentListing = {
  id: string;
  complex?: string;
  title?: string;
  unit?: string;
  py?: number;
  type?: string;
  priceText?: string;
  price?: number;
  deposit?: number;
  monthly?: number;
  timestamp?: number;
};

export type ActivityRecord = {
  screen: string;
  action: string;
  detail?: string;
  at: number;
};

export type UserActivity = {
  uid: string;
  email?: string;
  name?: string;
  displayName?: string;
  nickname?: string;
  provider?: string;
  photoURL?: string;
  lastLoginAt?: number;
  lastActiveAt?: number;
  lastSearchAt?: number;
  recentSearches?: string[];
  lastScenarioAt?: number;
  recentScenarios?: any[];
  recentListings?: RecentListing[];
  recentActivity?: ActivityRecord[];
};

type Store = { activities: Record<string, UserActivity>; version: number };
const store: Store = { activities: {}, version: 0 };
const listeners = new Set<() => void>();

type ActivityProfilePayload = {
  email?: string;
  name?: string;
  provider?: string;
  displayName?: string;
  photoURL?: string;
  nickname?: string;
};

function emit() {
  store.version += 1;
  listeners.forEach((fn) => fn());
}

const RECENT_LIST_LIMIT = 5;
const RECENT_ACTIVITY_LIMIT = 5;

export async function recordRecentListingView(uid: string, listing: RecentListing) {
  if (!uid || !listing?.id) return;
  try {
    const ref = doc(db, "userActivity", uid);
    const snap = await getDoc(ref);
    const current = (snap?.data()?.recentListings || []) as RecentListing[];
    const filtered = current.filter((item) => item.id !== listing.id);
    const next: RecentListing[] = [{ ...listing, timestamp: Date.now() }, ...filtered].slice(0, RECENT_LIST_LIMIT);
    await setDoc(ref, { recentListings: next }, { merge: true });
  } catch {
    /* ignore */
  }
}

function normalizeTimestamp(value: any) {
  if (typeof value === "number") return value;
  if (value?.toMillis && typeof value.toMillis === "function") return value.toMillis();
  if (typeof value === "string" && value) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function normalizeOptionalText(value?: string) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function buildActivityProfile(payload: ActivityProfilePayload) {
  const out: ActivityProfilePayload = {};
  const email = normalizeOptionalText(payload.email);
  if (email) out.email = email;
  const name = normalizeOptionalText(payload.name);
  if (name) out.name = name;
  const provider = normalizeOptionalText(payload.provider);
  if (provider) out.provider = provider;
  const displayName = normalizeOptionalText(payload.displayName);
  if (displayName) out.displayName = displayName;
  const nickname = normalizeOptionalText(payload.nickname);
  if (nickname) out.nickname = nickname;
  const photoURL = normalizeOptionalText(payload.photoURL);
  if (photoURL) out.photoURL = photoURL;
  return out;
}

export async function logLoginEvent(uid: string, payload: ActivityProfilePayload) {
  if (!uid) return;
  const profile = buildActivityProfile(payload);
  const provider = normalizeOptionalText(payload.provider) || "unknown";
  const { provider: _provider, ...rest } = profile;
  try {
    await addDoc(loginEventsCollection, {
      uid,
      provider,
      ...rest,
      createdAt: serverTimestamp(),
    });
  } catch {
    // ignore
  }
}

export async function logUserActivity(uid: string, payload: { screen: string; action: string; detail?: string }) {
  if (!uid) return;
  try {
    const ref = doc(db, "userActivity", uid);
    const snap = await getDoc(ref);
    const current = (snap?.data()?.recentActivity ?? []) as ActivityRecord[];
    const timestamp = Date.now();
    const entry: ActivityRecord = {
      screen: payload.screen,
      action: payload.action,
      at: timestamp,
    };
    if (payload.detail) {
      entry.detail = payload.detail;
    }
    const next: ActivityRecord[] = [entry, ...current].slice(0, RECENT_ACTIVITY_LIMIT);
    await setDoc(ref, { lastActiveAt: serverTimestamp(), recentActivity: next }, { merge: true });
  } catch (err) {
    console.error("failed to log user activity", err);
  }
}

export type ListingViewLog = {
  listingId: string;
  complex?: string;
  title?: string;
  unit?: string;
  py?: number;
  type?: string;
  priceText?: string;
  timestamp?: number;
  screen?: string;
  action?: string;
};

export async function recordListingView(targetUid: string, payload: ListingViewLog) {
  if (!targetUid || !payload?.listingId) return;
  try {
    const logsRef = collection(db, "listingViews", targetUid, "logs");
    await addDoc(logsRef, {
      ...payload,
      timestamp: serverTimestamp(),
      screen: payload.screen ?? "listingDetail",
      action: payload.action ?? "view",
    });
  } catch {
    /* ignore */
  }
}

export function subscribeActivity(uid: string) {
  const ref = doc(db, "userActivity", uid);
  let unsub: Unsubscribe | null = null;
  unsub = onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
          const data = snap.data() as any;
          store.activities[uid] = {
            uid,
            ...data,
            lastLoginAt: data.lastLoginAt?.toMillis ? data.lastLoginAt.toMillis() : data.lastLoginAt,
            lastActiveAt: data.lastActiveAt?.toMillis ? data.lastActiveAt.toMillis() : data.lastActiveAt,
            lastSearchAt: data.lastSearchAt?.toMillis ? data.lastSearchAt.toMillis() : data.lastSearchAt,
            lastScenarioAt: data.lastScenarioAt?.toMillis ? data.lastScenarioAt.toMillis() : data.lastScenarioAt,
            recentListings: Array.isArray(data.recentListings) ? data.recentListings : [],
            recentActivity: Array.isArray(data.recentActivity)
              ? (data.recentActivity as any[]).map((item) => ({
                  screen: item.screen,
                  action: item.action,
                  detail: item.detail,
                  at: normalizeTimestamp(item.at) ?? 0,
                }))
              : [],
          };
      }
      emit();
    },
    (err) => {
      console.error("userActivity snapshot error", err);
    },
  );
  return () => {
    if (unsub) {
      unsub();
    }
  };
}

export function useUserActivity(uid: string | null) {
  React.useEffect(() => {
    if (!uid) return;
    const unsub = subscribeActivity(uid);
    return () => {
      unsub();
    };
  }, [uid]);

  const get = React.useCallback(() => ({ version: store.version, activity: uid ? store.activities[uid] : undefined }), [uid]);
  const [snap, setSnap] = React.useState(get);
  React.useEffect(() => {
    const l = () => setSnap(get());
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, [get]);
  return snap.activity;
}

// helpers to update single fields
export async function updateUserLogin(
  uid: string,
  payload: ActivityProfilePayload,
) {
  const ref = doc(db, "userActivity", uid);
  const profile = buildActivityProfile(payload);
  await setDoc(
    ref,
    {
      uid,
      ...profile,
      lastLoginAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function updateUserActive(uid: string) {
  const ref = doc(db, "userActivity", uid);
  await setDoc(
    ref,
    {
      lastActiveAt: serverTimestamp(),
    },
    { merge: true },
  );
}

// Ensure a document exists for this user (call on login)
export async function ensureUserActivity(
  uid: string,
  payload: ActivityProfilePayload,
) {
  const ref = doc(db, "userActivity", uid);
  const profile = buildActivityProfile(payload);
  await setDoc(
    ref,
    {
      uid,
      ...profile,
      lastLoginAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function appendUserSearch(uid: string, payload: { term: string; email?: string; name?: string; provider?: string }) {
  const ref = doc(db, "userActivity", uid);
  const profile = buildActivityProfile(payload);
  await setDoc(
    ref,
    {
      uid,
      ...profile,
      lastSearchAt: serverTimestamp(),
      recentSearches: arrayUnion(payload.term),
      lastActiveAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function appendUserScenario(uid: string, summary: any, payload: { email?: string; name?: string; provider?: string }) {
  const ref = doc(db, "userActivity", uid);
  const profile = buildActivityProfile(payload);
  await setDoc(
    ref,
    {
      uid,
      ...profile,
      lastScenarioAt: serverTimestamp(),
      recentScenarios: arrayUnion(summary),
      lastActiveAt: serverTimestamp(),
    },
    { merge: true },
  );
}

// 닉네임 설정: 중복 시 숫자 연번을 붙여서 userNicknames 컬렉션에 예약 후 userActivity에 저장
async function reserveNickname(uid: string, desired: string): Promise<string> {
  const base = desired.trim();
  if (!base) throw new Error("닉네임을 입력해주세요.");
  const normalized = base.toLowerCase();
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}${i + 1}`;
    const ref = doc(db, "userNicknames", candidate.toLowerCase());
    const snap = await getDoc(ref);
    if (!snap.exists() || (snap.data() as any)?.uid === uid) {
      await setDoc(
        ref,
        {
          uid,
          nickname: candidate,
          reservedAt: serverTimestamp(),
        },
        { merge: true },
      );
      return candidate;
    }
  }
  throw new Error("사용 가능한 닉네임을 찾지 못했습니다. 다른 닉네임을 입력해주세요.");
}

export async function setUserNickname(uid: string, desired: string) {
  const nickname = await reserveNickname(uid, desired);
  const ref = doc(db, "userActivity", uid);
  await setDoc(
    ref,
    {
      uid,
      nickname,
      lastActiveAt: serverTimestamp(),
    },
    { merge: true },
  );
  return nickname;
}
