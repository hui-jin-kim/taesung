import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import React from "react";

export type AppSettings = {
  expiryAlertDays?: number; // 며칠 전부터 알림
};

const DEFAULTS: Required<AppSettings> = {
  expiryAlertDays: 90,
};

const SETTINGS_DOC = doc(db, "settings", "app");

export async function getSettings(): Promise<AppSettings> {
  const snap = await getDoc(SETTINGS_DOC);
  const data = (snap.exists() ? (snap.data() as any) : {}) as AppSettings;
  return { ...DEFAULTS, ...data };
}

export async function setSettings(patch: Partial<AppSettings>) {
  const cur = await getSettings();
  const next = { ...cur, ...patch } as AppSettings;
  await setDoc(SETTINGS_DOC, next, { merge: true });
  return next;
}

export function useSettings() {
  const [settings, setState] = React.useState<AppSettings>(DEFAULTS);
  React.useEffect(() => {
    getSettings().then(setState).catch(() => {});
  }, []);
  const save = React.useCallback(async (patch: Partial<AppSettings>) => {
    const next = await setSettings(patch);
    setState(next);
  }, []);
  return { settings, save } as const;
}

