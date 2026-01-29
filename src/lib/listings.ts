import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { reloadListings } from "../state/useListings";

export type ListingStatus = "active" | "completed" | "ourDeal" | "pending" | string;
export type ListingType = "매매" | "전세" | "월세" | string;

export type ListingDoc = {
  id: string;
  title: string;
  status?: ListingStatus;
  isActive?: boolean;
  itemNo?: string;
  type?: ListingType;
  complex?: string;
  area_py?: number;
  areaSuffix?: string;
  dong?: string;
  ho?: string;
  typeSuffix?: string;
  direction?: string;
  moveInDate?: string;
  supplyAreaM2?: number;
  exclusiveAreaM2?: number;
  rooms?: number;
  bathrooms?: number;
  maintenanceFee?: string;
  totalFloors?: number;
  price?: number;
  deposit?: number;
  monthly?: number;
  receivedAt?: string;
  expiryAt?: string;
  owner?: string;
  agency?: string;
  phone?: string;
  memo?: string;
  mobileMemo?: string;
  assigneeUid?: string;
  assigneeName?: string;
  closedAt?: string;
  closedByUs?: boolean;
  contractTermMonths?: number;
  images?: string[];
  keywords?: string[];
  // surfaced latest comment for card display
  lastCommentText?: string;
  lastCommentAt?: any;
  lastCommentAuthor?: string;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
  updatedBy?: string;
  createdByUid?: string;
  createdByName?: string;
  createdByEmail?: string;
  updatedByUid?: string;
  updatedByName?: string;
  updatedByEmail?: string;
  lastSavedAt?: any;
  lastSavedBy?: string;
  lastSavedByUid?: string;
  lastSavedByName?: string;
  lastSavedByEmail?: string;
  deletedAt?: number;
  deletedByUid?: string;
  deletedByEmail?: string;
  deletedReason?: string;
  deletedPrevStatus?: string;
  ownershipType?: "our" | "partner";
  urgent?: boolean;
};

const listingsCollection = collection(db, "listings");

function sanitize<T extends Record<string, any>>(input: T): T {
  const output: Record<string, any> = {};
  Object.keys(input).forEach((key) => {
    const value = (input as any)[key];
    if (value !== undefined) output[key] = value;
  });
  return output as T;
}

// Safe keyword tokenizer for search (split by non [a-z0-9가-힣])
export function buildKeywords(snapshot: Partial<ListingDoc>) {
  const areaTokens: string[] = [];
  const py = snapshot.area_py;
  if (typeof py === "number" && Number.isFinite(py)) {
    areaTokens.push(String(py), `${py}평`);
  }

  const source = [
    snapshot.title,
    snapshot.itemNo,
    snapshot.type,
    snapshot.complex,
    snapshot.dong,
    snapshot.ho,
    snapshot.owner,
    snapshot.agency,
    snapshot.phone,
    snapshot.memo,
    snapshot.direction,
    snapshot.moveInDate,
    snapshot.maintenanceFee,
    snapshot.mobileMemo,
    snapshot.assigneeName,
    ...areaTokens,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return Array.from(new Set(source.split(/[^a-z0-9가-힣.]+/g).filter(Boolean)));
}


export async function createListing(input: Partial<ListingDoc> & { title: string }) {
  const user = auth.currentUser;
  const createdByUid = input.createdByUid ?? user?.uid ?? undefined;
  const createdByEmail = input.createdByEmail ?? user?.email ?? undefined;
  const createdByName = input.createdByName ?? user?.displayName ?? createdByEmail ?? undefined;
  const updatedByUid = input.updatedByUid ?? user?.uid ?? undefined;
  const updatedByEmail = input.updatedByEmail ?? user?.email ?? undefined;
  const updatedByName = input.updatedByName ?? user?.displayName ?? updatedByEmail ?? undefined;
  const updatedBy = input.updatedBy ?? updatedByName ?? updatedByEmail ?? undefined;

  const payload = sanitize({
    title: input.title,
    status: input.status ?? undefined,
    isActive: input.isActive ?? true,
    itemNo: input.itemNo ?? "",
    type: input.type ?? undefined,
    complex: input.complex ?? "",
    area_py: input.area_py ?? undefined,
    areaSuffix: input.areaSuffix ?? undefined,
    dong: input.dong ?? "",
    ho: input.ho ?? "",
    typeSuffix: input.typeSuffix ?? undefined,
    direction: input.direction ?? undefined,
    moveInDate: input.moveInDate ?? undefined,
    supplyAreaM2: input.supplyAreaM2 ?? undefined,
    exclusiveAreaM2: input.exclusiveAreaM2 ?? undefined,
    rooms: input.rooms ?? undefined,
    bathrooms: input.bathrooms ?? undefined,
    maintenanceFee: input.maintenanceFee ?? undefined,
    totalFloors: input.totalFloors ?? undefined,
    price: input.price ?? undefined,
    deposit: input.deposit ?? undefined,
    monthly: input.monthly ?? undefined,
    receivedAt: input.receivedAt ?? undefined,
    owner: input.owner ?? "",
    agency: input.agency ?? "",
    phone: input.phone ?? "",
    memo: input.memo ?? "",
    mobileMemo: input.mobileMemo ?? "",
    assigneeUid: input.assigneeUid ?? "",
    assigneeName: input.assigneeName ?? "",
    closedAt: input.closedAt ?? undefined,
    closedByUs: input.closedByUs ?? false,
    contractTermMonths: input.contractTermMonths ?? undefined,
    images: input.images ?? [],
    ownershipType: input.ownershipType ?? undefined,
    urgent: input.urgent ?? false,
    keywords: buildKeywords({
      title: input.title,
      itemNo: input.itemNo,
      type: input.type,
      complex: input.complex,
      dong: input.dong,
      ho: input.ho,
      owner: input.owner,
      agency: input.agency,
      phone: input.phone,
      memo: input.memo,
      assigneeName: input.assigneeName,
    }),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: input.createdBy ?? createdByName ?? createdByEmail ?? undefined,
    updatedBy,
    createdByUid,
    createdByName,
    createdByEmail,
    updatedByUid,
    updatedByName,
    updatedByEmail,
    lastSavedAt: serverTimestamp(),
    lastSavedBy: input.lastSavedBy ?? updatedBy ?? updatedByName ?? updatedByEmail ?? updatedByUid ?? undefined,
    lastSavedByUid: input.lastSavedByUid ?? updatedByUid,
    lastSavedByName: input.lastSavedByName ?? updatedByName,
    lastSavedByEmail: input.lastSavedByEmail ?? updatedByEmail,
  } as Partial<ListingDoc>);

  const ref = await addDoc(listingsCollection, payload);
  // ensure 최신 데이터 재로딩
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await reloadListings();
    }
  } catch {
    await reloadListings();
  }
  return ref.id;
}

export async function updateListing(id: string, patch: Partial<ListingDoc>) {
  const user = auth.currentUser;
  const ref = doc(db, "listings", id);

  const next: any = sanitize({
    ...patch,
    updatedAt: serverTimestamp(),
  });

  if (user) {
    next.updatedByUid = user.uid;
    next.updatedByEmail = user.email ?? undefined;
    next.updatedByName = user.displayName ?? user.email ?? undefined;
    next.updatedBy = next.updatedBy ?? next.updatedByName ?? next.updatedByEmail ?? user.uid;
  } else if (
    patch.updatedByUid != null ||
    patch.updatedByEmail != null ||
    patch.updatedByName != null ||
    patch.updatedBy != null
  ) {
    next.updatedByUid = patch.updatedByUid ?? undefined;
    next.updatedByEmail = patch.updatedByEmail ?? undefined;
    next.updatedByName = patch.updatedByName ?? undefined;
    next.updatedBy =
      patch.updatedBy ?? patch.updatedByName ?? patch.updatedByEmail ?? patch.updatedByUid ?? undefined;
  }

  if (
    patch.title ||
    patch.itemNo ||
    patch.type ||
    patch.complex ||
    patch.dong ||
    patch.ho ||
    patch.owner ||
    patch.agency ||
    patch.phone ||
    patch.memo ||
    patch.direction ||
    patch.moveInDate ||
    patch.maintenanceFee ||
    patch.assigneeName ||
    patch.assigneeUid
  ) {
    next.keywords = buildKeywords({
      title: patch.title,
      itemNo: patch.itemNo,
      type: patch.type,
      complex: patch.complex,
      dong: patch.dong,
      ho: patch.ho,
      owner: patch.owner,
      agency: patch.agency,
      phone: patch.phone,
      memo: patch.memo,
      direction: patch.direction,
      moveInDate: patch.moveInDate,
      maintenanceFee: patch.maintenanceFee,
      assigneeName: patch.assigneeName,
    });
  }

  await updateDoc(ref, next);
}

export async function toggleStatus(id: string, status: ListingDoc["status"]) {
  await updateListing(id, { status });
}

export async function removeListing(id: string) {
  await deleteDoc(doc(db, "listings", id));
}
