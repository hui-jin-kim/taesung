// src/context/SelectionContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

const LS_KEY = "rj_selected_ids";
const DEFAULT_SCOPE = "global";

type SelectionStore = Record<string, string[]>;

type SelectionContextValue = {
  scopes: SelectionStore;
  updateScope: (scope: string, updater: (prev: string[]) => string[]) => void;
  clearScope: (scope: string) => void;
  clearAll: () => void;
  removeIds: (ids: string[]) => void;
};

const SelectionCtx = createContext<SelectionContextValue | null>(null);

function normalizeStore(raw: unknown): SelectionStore {
  if (Array.isArray(raw)) {
    const filtered = raw.filter((item) => typeof item === "string") as string[];
    return filtered.length ? { [DEFAULT_SCOPE]: Array.from(new Set(filtered)) } : {};
  }
  if (raw && typeof raw === "object") {
    const result: SelectionStore = {};
    Object.entries(raw as Record<string, unknown>).forEach(([scope, value]) => {
      if (Array.isArray(value)) {
        const filtered = (value as unknown[]).filter((item) => typeof item === "string") as string[];
        if (filtered.length) result[scope] = Array.from(new Set(filtered));
      }
    });
    return result;
  }
  return {};
}

function dedupe(list: string[]) {
  return Array.from(new Set(list.filter((id) => typeof id === "string" && id.length > 0)));
}

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const initialRef = useRef<SelectionStore | null>(null);
  if (initialRef.current == null) {
    if (typeof window === "undefined") {
      initialRef.current = {};
    } else {
      try {
        const raw = window.localStorage.getItem(LS_KEY);
        initialRef.current = normalizeStore(raw ? JSON.parse(raw) : {});
      } catch {
        initialRef.current = {};
      }
    }
  }

  const [scopes, setScopes] = useState<SelectionStore>(initialRef.current ?? {});

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(scopes));
    } catch {
      /* ignore */
    }
  }, [scopes]);

  const updateScope = React.useCallback((scope: string, updater: (prev: string[]) => string[]) => {
    setScopes((prev) => {
      const current = prev[scope] ?? [];
      const nextList = dedupe(updater(current));
      if (nextList.length === 0) {
        if (!(scope in prev)) return prev;
        const copy = { ...prev };
        delete copy[scope];
        return copy;
      }
      if (current.length === nextList.length && current.every((value, idx) => value === nextList[idx])) {
        return prev;
      }
      return { ...prev, [scope]: nextList };
    });
  }, []);

  const clearScope = React.useCallback((scope: string) => {
    setScopes((prev) => {
      if (!(scope in prev)) return prev;
      const next = { ...prev };
      delete next[scope];
      return next;
    });
  }, []);

  const clearAll = React.useCallback(() => {
    setScopes({});
  }, []);

  const removeIds = React.useCallback((ids: string[]) => {
    const removeSet = new Set(ids.filter(Boolean));
    if (removeSet.size === 0) return;
    setScopes((prev) => {
      let changed = false;
      const next: SelectionStore = {};
      Object.entries(prev).forEach(([scope, list]) => {
        const filtered = list.filter((id) => !removeSet.has(id));
        if (filtered.length !== list.length) changed = true;
        if (filtered.length > 0) next[scope] = filtered;
      });
      return changed ? next : prev;
    });
  }, []);

  const value = useMemo<SelectionContextValue>(
    () => ({
      scopes,
      updateScope,
      clearScope,
      clearAll,
      removeIds,
    }),
    [scopes, updateScope, clearScope, clearAll, removeIds]
  );

  return <SelectionCtx.Provider value={value}>{children}</SelectionCtx.Provider>;
}

type ScopedSelection = {
  scope: string;
  selected: string[];
  toggle: (id: string) => void;
  setMany: (ids: string[]) => void;
  clear: () => void;
  isSelected: (id: string) => boolean;
  selectedAll: string[];
  clearAll: () => void;
  scopes: SelectionStore;
  removeIds: (ids: string[]) => void;
};

export function useSelection(scope: string): ScopedSelection {
  const ctx = useContext(SelectionCtx);
  if (!ctx) throw new Error("SelectionProvider is required");
  const { scopes, updateScope, clearScope, clearAll, removeIds } = ctx;
  const selected = scopes[scope] ?? [];

  const toggle = React.useCallback(
    (id: string) => {
      if (!id) return;
      updateScope(scope, (prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    },
    [scope, updateScope]
  );

  const setMany = React.useCallback(
    (ids: string[]) => {
      updateScope(scope, () => dedupe(ids));
    },
    [scope, updateScope]
  );

  const clear = React.useCallback(() => {
    clearScope(scope);
  }, [scope, clearScope]);

  const isSelected = React.useCallback((id: string) => selected.includes(id), [selected]);

  const selectedAll = React.useMemo(
    () => Array.from(new Set(Object.values(scopes).flat())),
    [scopes]
  );

  return useMemo(
    () => ({
      scope,
      selected,
      toggle,
      setMany,
      clear,
      isSelected,
      selectedAll,
      clearAll,
      scopes,
      removeIds,
    }),
    [scope, selected, toggle, setMany, clear, isSelected, selectedAll, clearAll, scopes, removeIds]
  );
}

export function useSelectionSummary() {
  const ctx = useContext(SelectionCtx);
  if (!ctx) throw new Error("SelectionProvider is required");
  const { scopes, updateScope, clearAll, clearScope, removeIds } = ctx;
  const selectedAll = React.useMemo(
    () => Array.from(new Set(Object.values(scopes).flat())),
    [scopes]
  );

  const setScope = React.useCallback(
    (scope: string, ids: string[]) => {
      updateScope(scope, () => dedupe(ids));
    },
    [updateScope]
  );

  return {
    scopes,
    selected: selectedAll,
    clearAll,
    setScope,
    clearScope,
    removeIds,
  };
}
