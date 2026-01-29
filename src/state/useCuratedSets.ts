import React from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";

export type CuratedSet = {
  id: string;
  title: string;
  subtitle?: string;
  items: string[];
  status?: string;
  updatedAt?: number;
  updatedBy?: string;
};

export function useCuratedSets() {
  const [sets, setSets] = React.useState<CuratedSet[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const col = collection(db, "curated_sets");
    const q = query(col, orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: CuratedSet[] = [];
        snap.forEach((doc) => {
          const data = doc.data() || {};
          const items = Array.isArray(data.items) ? data.items.map((v: any) => String(v)).filter(Boolean) : [];
          const status = typeof data.status === "string" ? data.status : undefined;
          const updatedAt =
            (data.updatedAt && typeof data.updatedAt.toMillis === "function" && data.updatedAt.toMillis()) ||
            (typeof data.updatedAt === "number" ? data.updatedAt : undefined);
          next.push({
            id: doc.id,
            title: String(data.title || doc.id),
            subtitle: data.subtitle ? String(data.subtitle) : undefined,
            items,
            status,
            updatedAt,
            updatedBy: data.updatedBy ? String(data.updatedBy) : undefined,
          });
        });
        setSets(next);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, []);

  return { sets, loading };
}
