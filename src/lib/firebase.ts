import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported as analyticsSupported } from "firebase/analytics";

const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
const requiredKeys = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

const missing = requiredKeys.filter((key) => !env[key]);
if (missing.length > 0) {
  throw new Error(`Missing Firebase environment variables: ${missing.join(", ")}`);
}

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY!,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN!,
  projectId: env.VITE_FIREBASE_PROJECT_ID!,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID!,
  appId: env.VITE_FIREBASE_APP_ID!,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

analyticsSupported().then((ok) => {
  if (ok) {
    try {
      getAnalytics(app);
    } catch {
      /* ignore in SSR / unsupported */
    }
  }
});
