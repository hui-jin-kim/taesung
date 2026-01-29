import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  browserLocalPersistence,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { reloadListings } from "../state/useListings";
import { resetMatchSources } from "../state/useMatchSources";
import { updateUserLogin, updateUserActive, ensureUserActivity, logLoginEvent } from "../state/useUserActivity";

export type AppUser = {
  uid: string;
  email: string | null;
  name?: string;
  role?: "owner" | "admin" | "staff" | "viewer";
};

type AuthContextType = {
  user: AppUser | null;
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  initialized: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [initialized, setInitialized] = useState(false);
  const bcRef = useRef<BroadcastChannel | null>(null);

  const SYNC_KEY = "rj_auth_sync";
  const CHANNEL_NAME = "auth-sync";

  const emitSync = useCallback(
    (type: "login" | "logout") => {
      try {
        bcRef.current?.postMessage({ type });
      } catch {}
      try {
        localStorage.setItem(SYNC_KEY, JSON.stringify({ type, at: Date.now() }));
      } catch {}
    },
    [],
  );

  // Auth state listener
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => {});
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        resetMatchSources();
        setUser(null);
        setInitialized(true);
        return;
      }

      const ref = doc(db, "users", fbUser.uid);
      const base: AppUser = { uid: fbUser.uid, email: fbUser.email };

      // Admin allowlist (env)
      const env = (import.meta as any)?.env || {};
      const ownerEmails = String(env.VITE_SUPER_ADMIN_EMAILS || "")
        .split(",")
        .map((s: string) => s.trim().toLowerCase())
        .filter(Boolean);
      const adminEmails = String(env.VITE_ADMIN_EMAILS || "")
        .split(",")
        .map((s: string) => s.trim().toLowerCase())
        .filter(Boolean);
      const emailNorm = String(fbUser.email || "").toLowerCase();
      const shouldBeOwner = ownerEmails.includes(emailNorm);
      const shouldBeAdmin = adminEmails.includes(emailNorm);

      let snap = await getDoc(ref).catch(() => undefined);
      if (!snap?.exists()) {
        try {
          const nextRole = shouldBeOwner ? "owner" : shouldBeAdmin ? "admin" : "viewer";
          await setDoc(ref, {
            uid: fbUser.uid,
            email: fbUser.email,
            name: fbUser.displayName || "",
            role: nextRole,
            createdAt: serverTimestamp(),
          });
          snap = await getDoc(ref).catch(() => undefined);
        } catch {}
      } else if (shouldBeOwner && (snap.data() as any)?.role !== "owner") {
        try {
          await setDoc(ref, { ...(snap.data() as any), role: "owner" }, { merge: true });
          snap = await getDoc(ref).catch(() => undefined);
        } catch {}
      } else if (!shouldBeOwner && shouldBeAdmin && (snap.data() as any)?.role !== "admin") {
        try {
          await setDoc(ref, { ...(snap.data() as any), role: "admin" }, { merge: true });
          snap = await getDoc(ref).catch(() => undefined);
        } catch {}
      }

      const latest = snap ?? (await getDoc(ref).catch(() => undefined));
      const initial: AppUser = latest?.exists() ? { ...base, ...(latest.data() as any) } : base;
      setUser(initial);
      reloadListings().catch(() => {});
      onSnapshot(ref, (s) => {
        if (s.exists()) setUser({ uid: fbUser.uid, email: fbUser.email, ...(s.data() as any) });
      });
      setInitialized(true);

      // activity log
      try {
        const primary = fbUser.providerData?.[0];
        const userData = latest?.exists() ? (latest.data() as any) : {};
        const email = userData?.email || fbUser.email || primary?.email || undefined;
        const name = userData?.name || fbUser.displayName || primary?.displayName || undefined;
        const displayName = fbUser.displayName || primary?.displayName || userData?.name || undefined;
        const nickname = userData?.nickname || userData?.kakao?.nickname || primary?.displayName || undefined;
        const photoURL = fbUser.photoURL || primary?.photoURL || undefined;
        const provider = userData?.provider || primary?.providerId || fbUser.providerId || "password";
        await ensureUserActivity(fbUser.uid, { email, name, provider, displayName, nickname, photoURL });
        updateUserActive(fbUser.uid);
      } catch {}

      try {
        bcRef.current = new BroadcastChannel(CHANNEL_NAME);
      } catch {
        bcRef.current = null;
      }
      emitSync("login");
    });
    return () => unsub();
  }, [emitSync]);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        logLoginEvent(cred.user.uid, {
          provider: "password",
          email: cred.user.email || email,
          name: cred.user.displayName || undefined,
        }).catch(() => {});
        emitSync("login");
        return { ok: true as const };
      } catch (e) {
        return { ok: false as const, error: "이메일 또는 비밀번호가 올바르지 않습니다." };
      }
    },
    [emitSync],
  );

  const performLogout = useCallback(
    async (options?: { broadcast?: boolean }) => {
      const shouldBroadcast = options?.broadcast ?? true;
      if (shouldBroadcast) emitSync("logout");
      try {
        resetMatchSources();
        localStorage.removeItem(SYNC_KEY);
      } catch {}
      await signOut(auth).catch(() => {});
    },
    [emitSync],
  );

  const logout = useCallback(() => performLogout(), [performLogout]);
  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  }, []);

  const value = useMemo(
    () => ({ user, login, logout, resetPassword, initialized }),
    [user, login, logout, resetPassword, initialized],
  );

  // sync logout across tabs
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(CHANNEL_NAME);
      bc.onmessage = (ev) => {
        if (ev?.data?.type === "logout" && auth.currentUser) {
          performLogout({ broadcast: false });
        }
      };
    } catch {}

    const onStorage = (e: StorageEvent) => {
      if (e.key !== SYNC_KEY || !e.newValue) return;
      try {
        const payload = JSON.parse(e.newValue) as { type?: "login" | "logout" };
        if (payload?.type === "logout" && auth.currentUser) {
          performLogout({ broadcast: false });
        }
      } catch {}
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
      if (bc) bc.close();
    };
  }, [performLogout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
