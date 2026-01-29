let deferredPrompt: any = null;

export function setupInstallCapture() {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (e: any) => {
    e.preventDefault();
    deferredPrompt = e;
  });
}

export async function showInstallPrompt(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredPrompt) return "unavailable";
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return outcome === "accepted" ? "accepted" : "dismissed";
}

export function canPromptInstall() {
  return !!deferredPrompt;
}

const EVENT_NAME = "rj:pwa-installed";
export const INSTALL_FLAG_KEY = "viewer:pwa-installed";

export const isStandaloneDisplay = () => {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)");
  return Boolean(mq?.matches || (window.navigator as any)?.standalone);
};

export const hasInstalledPwa = () => {
  if (isStandaloneDisplay()) return true;
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(INSTALL_FLAG_KEY) === "1";
  } catch {
    return false;
  }
};

export const shouldShowInstallCTA = () => !hasInstalledPwa();

export const markPwaInstalled = () => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(INSTALL_FLAG_KEY, "1");
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(EVENT_NAME));
};

export const addPwaInstalledListener = (handler: () => void) => {
  if (typeof window === "undefined") return () => {};
  const wrapped = () => handler();
  window.addEventListener("appinstalled", wrapped);
  window.addEventListener(EVENT_NAME, wrapped);
  return () => {
    window.removeEventListener("appinstalled", wrapped);
    window.removeEventListener(EVENT_NAME, wrapped);
  };
};
