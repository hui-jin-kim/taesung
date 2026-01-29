import React, { createContext, useContext, useEffect, useState } from "react";

export type LabelColors = { active: string; completed: string; hidden: string; };
export type CategoryPrefix = { [key: string]: { prefix: string; next: number } };

export interface Settings {
  labelColors: LabelColors;
  watermark: string;
  dateFormat: string;
  showExportButtons: boolean;
  showWatermark: boolean;
  categoryPrefix: CategoryPrefix;
  includeDateInId: boolean; // YYMM 포함 여부
  agents?: string[]; // 담당자 프리셋
}

const defaultSettings: Settings = {
  labelColors: { active: "#2563eb", completed: "#dc2626", hidden: "#9ca3af" },
  watermark: "RJ REAL ESTATE © 2025",
  dateFormat: "YYYY.MM.DD",
  showExportButtons: true,
  showWatermark: true,
  categoryPrefix: {
    APT: { prefix: "APT", next: 1 },
    SHP: { prefix: "SHP", next: 1 },
    BLD: { prefix: "BLD", next: 1 },
    OFS: { prefix: "OFS", next: 1 },
    LND: { prefix: "LND", next: 1 },
  },
  includeDateInId: true,
  agents: ["공동"],
};

const SettingsContext = createContext<{
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => void;
  incrementCategory: (key: string) => string;
}>({
  settings: defaultSettings,
  updateSettings: () => {},
  incrementCategory: () => "",
});

const STORAGE_KEY = "rj_settings";

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  function updateSettings(partial: Partial<Settings>) {
    setSettings((prev) => ({ ...prev, ...partial }));
  }

  function incrementCategory(key: string): string {
    const nextNum = (settings.categoryPrefix[key]?.next || 1);
    const newPrefix = { ...settings.categoryPrefix };
    newPrefix[key].next = nextNum + 1;

    const seq = String(nextNum).padStart(4, "0");
    let newId = `${newPrefix[key].prefix}-${seq}`;
    if (settings.includeDateInId) {
      const d = new Date();
      const yy = String(d.getFullYear()).slice(-2);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      newId = `${newPrefix[key].prefix}-${yy}${mm}-${seq}`;
    }

    setSettings((prev) => ({ ...prev, categoryPrefix: newPrefix }));
    return newId;
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, incrementCategory }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
