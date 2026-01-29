import { auth } from "./firebase";
import { updateListing, removeListing, getListings } from "../state/useListings";
import { updateBuyer, removeBuyer } from "../state/useBuyers";

export async function softDeleteListings(ids: string[], reason?: string) {
  const user = auth.currentUser;
  const currentById = new Map(
    getListings()
      .filter((item: any) => ids.includes(item.id))
      .map((item: any) => [item.id, item])
  );

  for (const id of ids) {
    const current = currentById.get(id) as any;
    const prevStatus =
      current && current.status && current.status !== "deleted" ? current.status : undefined;

    await updateListing(id, {
      deletedAt: Date.now(),
      deletedByUid: user?.uid ?? undefined,
      deletedByEmail: user?.email ?? undefined,
      deletedReason: reason ?? undefined,
      deletedPrevStatus: prevStatus ?? undefined,
      status: "deleted" as any,
    } as any);
  }
}

export async function hardDeleteListings(ids: string[]) {
  for (const id of ids) {
    await removeListing(id);
  }
}

export async function softDeleteBuyers(ids: string[], reason?: string) {
  const user = auth.currentUser;
  for (const id of ids) {
    await updateBuyer(id, {
      deletedAt: Date.now(),
      deletedByUid: user?.uid ?? undefined,
      deletedByEmail: user?.email ?? undefined,
      deletedReason: reason ?? undefined,
      status: ("deleted" as any),
    } as any);
  }
}

export async function hardDeleteBuyers(ids: string[]) {
  for (const id of ids) {
    await removeBuyer(id);
  }
}
