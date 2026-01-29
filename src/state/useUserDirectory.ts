// src/state/useUserDirectory.ts
// Firestore 사용자 프로필을 로컬에서 캐싱해 이름 매핑 제공

import React from "react";
import { listUserProfiles, type UserProfile } from "../lib/users";

type Directory = {
  byUid: Record<string, string>;
  byEmail: Record<string, string>;
};

type Snapshot = {
  directory: Directory;
  loaded: boolean;
  loading: boolean;
  error: string | null;
};

const store: Snapshot = {
  directory: { byUid: {}, byEmail: {} },
  loaded: false,
  loading: false,
  error: null,
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* no-op */
    }
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let inflight: Promise<void> | null = null;

async function loadDirectory(force = false) {
  if (store.loading) return inflight ?? undefined;
  if (!force && store.loaded) return;
  store.loading = true;
  store.error = null;
  emit();

  const job = listUserProfiles()
    .then((profiles) => {
      const next: Directory = { byUid: {}, byEmail: {} };
      profiles.forEach((profile) => applyProfileToDirectory(next, profile));
      store.directory = next;
      store.loaded = true;
    })
    .catch((error: any) => {
      store.error = error?.message || "사용자 목록을 불러오지 못했습니다.";
    })
    .finally(() => {
      store.loading = false;
      inflight = null;
      emit();
    });

  inflight = job;
  return job;
}

function applyProfileToDirectory(target: Directory, profile: UserProfile) {
  const name =
    profile.name?.trim() ||
    profile.email?.split("@")[0] ||
    profile.uid ||
    "";
  if (profile.uid) target.byUid[profile.uid] = name;
  if (profile.email) target.byEmail[profile.email.toLowerCase()] = name;
}

const snapshot = (): Snapshot => ({
  directory: store.directory,
  loaded: store.loaded,
  loading: store.loading,
  error: store.error,
});

export function useUserDirectory() {
  const [state, setState] = React.useState<Snapshot>(snapshot);

  React.useEffect(() => {
    const unsub = subscribe(() => setState(snapshot()));
    if (!store.loaded && !store.loading) {
      void loadDirectory();
    }
    return () => unsub();
  }, []);

  const getName = React.useCallback(
    (uid?: string | null, email?: string | null): string | undefined => {
      const byUid = state.directory.byUid;
      const byEmail = state.directory.byEmail;

      if (uid) {
        const direct = byUid[uid];
        if (direct) return direct;
      }

      if (email) {
        const key = email.trim().toLowerCase();
        const match = byEmail[key];
        if (match) return match;
      }

      return undefined;
    },
    [state.directory]
  );

  const refresh = React.useCallback(() => {
    void loadDirectory(true);
  }, []);

  return {
    namesByUid: state.directory.byUid,
    namesByEmail: state.directory.byEmail,
    loaded: state.loaded,
    loading: state.loading,
    error: state.error,
    getName,
    refresh,
  } as const;
}
