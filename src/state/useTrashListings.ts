// src/state/useTrashListings.ts
// Deleted listings (휴지통) 조회 전용 훅

import React from "react";
import type { Listing } from "../types/core";
import { db } from "../lib/firebase";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";

const listingsCollection = collection(db, "listings");

export function useTrashListings() {
  const [rows, setRows] = React.useState<Listing[]>([]);
  React.useEffect(() => {
    const qy = query(
      listingsCollection,
      where("deletedAt", ">", 0),
      orderBy("deletedAt", "desc") as any,
    );
    const unsub = onSnapshot(qy, (snap) => {
      const list: Listing[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as Record<string, any>;
        list.push({ id: docSnap.id, ...data } as Listing);
      });
      setRows(list);
    });
    return () => unsub();
  }, []);
  return rows;
}

