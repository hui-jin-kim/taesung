type Flags = {
  enablePublicDistrict: boolean;
  enablePublicViewerMobile: boolean;
  showAdminToolbar: boolean;
  defaultDistrictQuery: string;
};

const KEY = "rj_feature_flags";
const DEFAULTS: Flags = {
  enablePublicDistrict: false,
  enablePublicViewerMobile: false,
  showAdminToolbar: true,
  defaultDistrictQuery: "",
};

function read(): Flags {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const val = JSON.parse(raw);
    return { ...DEFAULTS, ...(val || {}) } as Flags;
  } catch {
    return { ...DEFAULTS };
  }
}

function write(next: Flags) {
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
}

export function getFlag<K extends keyof Flags>(key: K): Flags[K] {
  return read()[key];
}

export function setFlag<K extends keyof Flags>(key: K, value: Flags[K]) {
  const cur = read();
  (cur as any)[key] = value;
  write(cur);
}

export function getAllFlags(): Flags { return read(); }

