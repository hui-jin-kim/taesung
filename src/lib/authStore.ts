export type UserRole = 'owner' | 'admin' | 'staff' | 'viewer';

export type UserRecord = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  password: string; // NOTE: demo only. For production, never store plain passwords.
};

const USERS_KEY = 'rj_users';
const SESSION_KEY = 'rj_current_user';

export function seedDefaultUsersIfEmpty() {
  const raw = localStorage.getItem(USERS_KEY);
  if (raw) return;
  const defaults: UserRecord[] = [
    { id: 'u_admin', email: 'admin@example.com', name: 'Admin', role: 'admin', password: 'admin123!' },
    { id: 'u_staff', email: 'staff@example.com', name: 'Staff', role: 'staff', password: 'staff123!' },
  ];
  localStorage.setItem(USERS_KEY, JSON.stringify(defaults));
}

export function listUsers(): UserRecord[] {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); } catch { return []; }
}

export function findUserByEmail(email: string): UserRecord | undefined {
  return listUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
}

export function verifyUser(email: string, password: string): UserRecord | null {
  const u = findUserByEmail(email);
  if (!u) return null;
  if (u.password !== password) return null;
  return u;
}

export function saveSession(u: UserRecord | null) {
  if (!u) localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY, JSON.stringify(u));
}

export function loadSession(): UserRecord | null {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}

function saveUsers(arr: UserRecord[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(arr));
}

export function isEmailTaken(email: string): boolean {
  return !!findUserByEmail(email);
}

export function createUser(data: Omit<UserRecord, 'id'>): UserRecord {
  const all = listUsers();
  if (isEmailTaken(data.email)) throw new Error('이미 사용 중인 이메일입니다.');
  const id = `u_${Date.now()}`;
  const rec: UserRecord = { id, ...data };
  saveUsers([...all, rec]);
  return rec;
}

export function deleteUser(id: string) {
  const next = listUsers().filter(u => u.id !== id);
  saveUsers(next);
}

export function updateUser(id: string, patch: Partial<Omit<UserRecord, 'id'>>) {
  const next = listUsers().map(u => u.id === id ? { ...u, ...patch } : u);
  saveUsers(next);
}
