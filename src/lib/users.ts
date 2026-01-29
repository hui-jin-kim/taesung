import { app, db } from './firebase';
import { initializeApp as initApp, getApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, doc, setDoc, getDocs, query, orderBy, updateDoc, deleteDoc } from 'firebase/firestore';

export type UserProfile = {
  uid: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'staff' | 'viewer';
  createdAt?: any;
};

export async function createUserAsAdmin(email: string, password: string, name: string, role: UserProfile['role']) {
  // Use or create a secondary app to avoid switching the current session
  const secondary = (()=>{
    try {
      return getApps().find(a=>a.name==='admin-helper') || initApp(app.options as any, 'admin-helper');
    } catch { return initApp(app.options as any, 'admin-helper'); }
  })();
  const auth2 = getAuth(secondary);
  try {
    const cred = await createUserWithEmailAndPassword(auth2, email, password);
    const uid = cred.user.uid;
    await setDoc(doc(db, 'users', uid), { uid, email, name, role, createdAt: serverTimestamp() });
  } finally {
    await signOut(auth2).catch(() => {});
  }
}

export async function listUserProfiles(): Promise<UserProfile[]> {
  const qs = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')));
  return qs.docs.map((d) => d.data() as any);
}

export async function updateUserRole(uid: string, role: UserProfile['role']) {
  await updateDoc(doc(db, 'users', uid), { role });
}

export async function deleteUserProfile(uid: string) {
  await deleteDoc(doc(db, 'users', uid));
}

export async function sendReset(email: string) { await sendPasswordResetEmail(getAuth(), email); }
