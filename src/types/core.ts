// src/types/core.ts
// Shared type definitions used by listings and buyers

export type Comment = {
  id: string;
  parentType: "listing" | "buyer";
  parentId: string;
  replyToId?: string;
  authorId: string;
  authorName: string;
  authorEmail?: string;
  text: string;
  syncToNotes: boolean;
  createdAt: number;
  updatedAt?: number;
};

export type NotesSyncMode = "last" | "append";

export type ListingStatus = "active" | "completed" | "ourDeal" | "pending" | string;
export type ListingType = "매매" | "전세" | "월세" | string;

export type Buyer = {
  id: string;
  name: string;
  phone?: string;
  budgetMin?: number;
  budgetMax?: number;
  budgetText?: string;
  monthlyMax?: number;
  typePrefs?: Array<"매매" | "전세" | "월세">;
  areaPrefsPy?: number[];
  complexPrefs?: string[];
  floors?: string[];
  mustHaves?: string[];
  notes?: string;
  lastCommentText?: string;
  lastCommentAt?: number;
  lastCommentAuthor?: string;
  assignedTo?: string;
  ownerName?: string;
  assignedToName?: string;
  assignedToEmail?: string;
  status?: "active" | "hold" | "completed" | "archived" | "deleted";
  deletedAt?: number;
  deletedByUid?: string;
  deletedByEmail?: string;
  deletedReason?: string;
  deletedPrevStatus?: string;
  createdAt: number;
  updatedAt?: number;
  ownershipType?: "our" | "partner";
};

export type Listing = {
  id: string;
  title?: string;
  status?: ListingStatus;
  isActive?: boolean;
  itemNo?: string;
  type?: ListingType;
  complex?: string;
  area_py?: number; // 전용면적(평)
  areaSuffix?: string;
  dong?: string;
  ho?: string;
  typeSuffix?: string;
  floor?: string;
  direction?: string;
  moveInDate?: string;
  supplyAreaM2?: number;
  exclusiveAreaM2?: number;
  rooms?: number;
  bathrooms?: number;
  maintenanceFee?: string;
  totalFloors?: number;
  price?: number; // 매매가(만원)
  deposit?: number; // 보증금(만원)
  monthly?: number; // 월세(만원)
  memo?: string; // 메모
  owner?: string;
  agency?: string;
  phone?: string;
  assigneeUid?: string;
  assigneeName?: string;
  receivedAt?: string;
  expiryAt?: string;
  closedAt?: string;
  completedAt?: number | string;
  closedByUs?: boolean;
  contractTermMonths?: number;
  images?: string[];
  keywords?: string[];
  lastCommentText?: string;
  lastCommentAt?: number;
  lastCommentAuthor?: string;
  createdAt?: number;
  updatedAt?: number;
  createdBy?: string;
  updatedBy?: string;
  createdByUid?: string;
  createdByName?: string;
  createdByEmail?: string;
  updatedByUid?: string;
  updatedByName?: string;
  updatedByEmail?: string;
  lastSavedAt?: number;
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
  mobileFeatured?: boolean;
  mobileOrder?: number;
  mobileMemo?: string;
};
