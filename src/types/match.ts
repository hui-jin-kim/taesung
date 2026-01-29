export type MatchEntry = {
  id: string;
  score: number;
  strict?: boolean;
};

export type MatchListing = {
  id: string;
  type?: string;
  area_py?: number;
  price?: number;
  deposit?: number;
  monthly?: number;
  status?: string;
  closedByUs?: boolean;
  deletedAt?: number;
  updatedAt?: number;
  ownershipType?: "our" | "partner";
  urgent?: boolean;
  matchedBuyerIds?: string[];
  matchedBuyers?: MatchEntry[];
  matchesUpdatedAt?: number;
};

export type MatchBuyer = {
  id: string;
  typePrefs?: string[];
  budgetMin?: number;
  budgetMax?: number;
  monthlyMax?: number;
  areaMinPy?: number;
  areaMaxPy?: number;
  areaPrefsPy?: number[];
  status?: string;
  deletedAt?: number;
  updatedAt?: number;
};

export type BuyerMatchSnapshot = {
  id: string;
  listingIds: string[];
  matches?: MatchEntry[];
  updatedAt?: number;
};
