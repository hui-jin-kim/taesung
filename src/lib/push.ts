// Minimal push helper – no-ops unless wired to a provider (e.g., FCM)

export type PushPrefs = {
  segments?: string[];
};

export async function ensurePush(_prefs?: PushPrefs): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) return false;
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return false;
    // If a service worker is not registered, avoid hanging on ready.
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    await navigator.serviceWorker.ready;
    // TODO: plug FCM/Web Push subscription here
    return true;
  } catch {
    return false;
  }
}
