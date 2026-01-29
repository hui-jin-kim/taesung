import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./firebase";

const env: any = (import.meta as any)?.env || {};
const region = env.VITE_FUNCTIONS_REGION || 'us-central1';
const functions = getFunctions(app, region);

export async function ensureUserProfile(email: string, name?: string, role?: 'owner'|'admin'|'staff'|'viewer') {
  const fn = httpsCallable<any, any>(functions, 'ensureUserProfile');
  const res = await fn({ email, name, role });
  return res.data;
}

export async function listAuthUsers(limit = 1000) {
  const fn = httpsCallable<any, any>(functions, 'listAuthUsers');
  const res = await fn({ limit });
  return res.data?.users as Array<{ uid:string; email:string; displayName?:string; disabled?:boolean; metadata?: any }>;
}

export async function deleteAuthUser(uid: string, alsoDeleteProfile = true) {
  const fn = httpsCallable<any, any>(functions, 'deleteAuthUser');
  const res = await fn({ uid, alsoDeleteProfile });
  return res.data;
}
