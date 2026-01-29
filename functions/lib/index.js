import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { getFirestore } from "firebase-admin/firestore";
import { createRequire } from "module";
const MOLIT_SERVICE_KEY = defineSecret("MOLIT_SERVICE_KEY");
const MATCH_REBUILD_KEY = defineSecret("MATCH_REBUILD_KEY");
const KAKAO_REST_KEY = defineSecret("KAKAO_REST_KEY");
const KAKAO_CLIENT_SECRET = defineSecret("KAKAO_CLIENT_SECRET");
const DEFAULT_KAKAO_REDIRECT_URI = process.env.KAKAO_REDIRECT_URI || "https://www.samusildoo.com/kakao/callback";
function resolveKakaoRedirectUri(requested) {
    if (requested && requested.trim())
        return requested.trim();
    if (process.env.KAKAO_REDIRECT_URI && process.env.KAKAO_REDIRECT_URI.trim()) {
        return process.env.KAKAO_REDIRECT_URI.trim();
    }
    return DEFAULT_KAKAO_REDIRECT_URI;
}
const app = getApps().length ? getApps()[0] : initializeApp();
const storage = getStorage(app);
const firestore = getFirestore(app);
const authAdmin = getAuth(app);
// Seocho-gu (11650). Allow Jamwon-dong and Banpo-dong only
const LAWD_CD = "11650";
const ALLOWED_DONGS = new Set(["잠원동", "반포동"]);
// Simple per-instance cache for on-demand API (24h)
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map();
const MATCH_COLLECTION = "match_listings";
const MATCH_BUYERS_COLLECTION = "match_buyers";
const MATCH_LIMIT = 20;
/**
 * Keep only latest 5 scenarios per user (viewerScenarios).
 * Runs daily; extra documents are deleted silently.
 */
export const pruneViewerScenariosDaily = onSchedule(
// 매일 새벽 03:00 KST 고정 실행
{ schedule: "0 3 * * *", timeZone: "Asia/Seoul", region: "asia-northeast3" }, async () => {
    const snap = await firestore
        .collection("viewerScenarios")
        .orderBy("userId")
        .orderBy("updatedAt", "desc")
        .get();
    const toDelete = [];
    let currentUser = null;
    let count = 0;
    for (const doc of snap.docs) {
        const userId = doc.data().userId ?? "__unknown__";
        if (userId !== currentUser) {
            currentUser = userId;
            count = 0;
        }
        count += 1;
        if (count > 5)
            toDelete.push(doc.ref);
    }
    // Delete in batches of 400
    while (toDelete.length) {
        const batch = firestore.batch();
        const chunk = toDelete.splice(0, 400);
        chunk.forEach((ref) => batch.delete(ref));
        await batch.commit();
    }
});
export const syncViewerSessionStats = onDocumentWritten({ region: "asia-northeast3", document: "viewerSessions/{uid}/logs/{sessionId}" }, async (event) => {
    const uid = String(event.params.uid || "");
    const after = event.data?.after;
    const before = event.data?.before;
    if (!uid || !after?.exists)
        return;
    const afterData = after.data();
    const beforeData = before?.data();
    const isCreate = !before?.exists && after.exists;
    const closedAt = toMillis(afterData.closedAt);
    const prevClosedAt = toMillis(beforeData?.closedAt);
    const isClosedNow = Boolean(closedAt && !prevClosedAt);
    if (!isCreate && !isClosedNow)
        return;
    const startedAt = toMillis(afterData.startedAt);
    const endAt = closedAt ?? toMillis(afterData.endedAt) ?? toMillis(afterData.lastPingAt);
    const durationMs = isClosedNow && startedAt && endAt ? Math.max(0, endAt - startedAt) : 0;
    const userRef = firestore.collection("viewerUserStats").doc(uid);
    const totalsRef = firestore.collection("viewerStatsTotals").doc("global");
    const roleRef = firestore.collection("users").doc(uid);
    await firestore.runTransaction(async (tx) => {
        const [userSnap, totalsSnap, roleSnap] = await Promise.all([
            tx.get(userRef),
            tx.get(totalsRef),
            tx.get(roleRef),
        ]);
        const role = roleSnap.exists ? String(roleSnap.get("role") || "") : "";
        const staffFlag = isStaffRole(role);
        const totalsData = totalsSnap.exists ? totalsSnap.data() : {};
        const viewerTotals = normalizeViewerTotalsBucket(totalsData.viewer);
        const staffTotals = normalizeViewerTotalsBucket(totalsData.staff);
        const bucket = staffFlag ? staffTotals : viewerTotals;
        const userData = userSnap.exists ? userSnap.data() : {};
        const prevSessionCount = toOptionalNumber(userData.sessionCount) ?? 0;
        let nextSessionCount = prevSessionCount;
        if (isCreate) {
            bucket.totalSessions += 1;
            if (prevSessionCount <= 0) {
                bucket.uniqueUsers += 1;
            }
            if (prevSessionCount === 1) {
                bucket.repeatUsers += 1;
            }
            nextSessionCount = prevSessionCount + 1;
        }
        let nextTotalDuration = toOptionalNumber(userData.totalDurationMs) ?? 0;
        if (isClosedNow && durationMs) {
            bucket.totalDurationMs += durationMs;
            nextTotalDuration += durationMs;
        }
        const nowMs = Date.now();
        const lastSeenAt = closedAt ?? endAt ?? startedAt ?? nowMs;
        const firstSeenAt = toOptionalNumber(userData.firstSeenAt) ?? startedAt ?? lastSeenAt;
        tx.set(userRef, sanitize({
            uid,
            sessionCount: nextSessionCount,
            totalDurationMs: nextTotalDuration,
            lastSeenAt,
            firstSeenAt,
            isStaff: staffFlag,
            role: role || undefined,
            updatedAt: nowMs,
        }), { merge: true });
        tx.set(totalsRef, sanitize({
            viewer: viewerTotals,
            staff: staffTotals,
            updatedAt: nowMs,
        }), { merge: true });
    });
});
const MATCH_FIELD_KEYS = [
    "typePrefs",
    "budgetMin",
    "budgetMax",
    "monthlyMax",
    "areaMinPy",
    "areaMaxPy",
    "areaPrefsPy",
    "status",
    "deletedAt",
];
function months(from, to) {
    const [fy, fm] = from.split("-").map(Number);
    const [ty, tm] = to.split("-").map(Number);
    const d = new Date(fy, (fm || 1) - 1, 1);
    const end = new Date(ty, (tm || 1) - 1, 1);
    const out = [];
    while (d <= end) {
        out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
        d.setMonth(d.getMonth() + 1);
    }
    return out;
}
function toNumber(v) {
    const n = Number(String(v ?? "0").replace(/[\s,]/g, ""));
    return Number.isFinite(n) ? n : 0;
}
function toFloat(v) {
    const n = Number(String(v ?? "0").replace(/[\s,]/g, ""));
    return Number.isFinite(n) ? n : 0;
}
function toMillis(value) {
    if (!value)
        return undefined;
    if (typeof value.toMillis === "function") {
        try {
            return value.toMillis();
        }
        catch {
            return undefined;
        }
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
}
function toOptionalNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
}
function sanitize(input) {
    const out = {};
    Object.keys(input).forEach((key) => {
        const value = input[key];
        if (value !== undefined)
            out[key] = value;
    });
    return out;
}
function normalizeViewerTotalsBucket(input) {
    return {
        totalSessions: toOptionalNumber(input?.totalSessions) ?? 0,
        uniqueUsers: toOptionalNumber(input?.uniqueUsers) ?? 0,
        repeatUsers: toOptionalNumber(input?.repeatUsers) ?? 0,
        totalDurationMs: toOptionalNumber(input?.totalDurationMs) ?? 0,
    };
}
function isStaffRole(role) {
    const value = String(role ?? "").toLowerCase();
    return value === "owner" || value === "admin" || value === "staff";
}
function buildMatchListingPayload(source) {
    return {
        type: typeof source.type === "string" ? source.type : undefined,
        area_py: toFloat(source.area_py) || undefined,
        price: toFloat(source.price) || undefined,
        deposit: toFloat(source.deposit) || undefined,
        monthly: toFloat(source.monthly) || undefined,
        status: typeof source.status === "string" ? source.status : undefined,
        closedByUs: Boolean(source.closedByUs),
        deletedAt: toMillis(source.deletedAt),
        updatedAt: toMillis(source.updatedAt) ?? Date.now(),
        ownershipType: source.ownershipType === "partner" ? "partner" : "our",
    };
}
function shouldIndexListing(source) {
    if (!source)
        return false;
    if (source.deletedAt != null)
        return false;
    return true;
}
function extractIdArray(value) {
    if (!Array.isArray(value))
        return [];
    return value.map((v) => String(v)).filter(Boolean);
}
function pickBuyerRelevantFields(source) {
    if (!source)
        return null;
    const snapshot = {};
    MATCH_FIELD_KEYS.forEach((key) => {
        const raw = source[key];
        if (raw == null)
            return;
        if (key === "typePrefs") {
            snapshot[key] = Array.isArray(raw) ? raw.map((v) => String(v)) : undefined;
        }
        else if (key === "areaPrefsPy") {
            snapshot[key] = Array.isArray(raw)
                ? raw
                    .map((v) => Number(v))
                    .filter((v) => Number.isFinite(v))
                : undefined;
        }
        else if (key === "status") {
            snapshot[key] = typeof raw === "string" ? raw : undefined;
        }
        else {
            snapshot[key] = toOptionalNumber(raw);
        }
    });
    return snapshot;
}
function sameBuyerRelevantFields(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}
function normalizeBuyerDocument(id, data) {
    if (!data)
        return null;
    const deleted = toOptionalNumber(data.deletedAt);
    if (deleted && deleted > 0)
        return null;
    const statusText = String(data.status ?? "").toLowerCase();
    if (["archived", "inactive", "완료", "종료"].some((token) => statusText.includes(token)))
        return null;
    return {
        id,
        typePrefs: Array.isArray(data.typePrefs) ? data.typePrefs.map((v) => String(v)) : undefined,
        budgetMin: toOptionalNumber(data.budgetMin),
        budgetMax: toOptionalNumber(data.budgetMax),
        monthlyMax: toOptionalNumber(data.monthlyMax),
        areaMinPy: toOptionalNumber(data.areaMinPy ?? data.areaMin),
        areaMaxPy: toOptionalNumber(data.areaMaxPy ?? data.areaMax),
        areaPrefsPy: Array.isArray(data.areaPrefsPy)
            ? data.areaPrefsPy
                .map((v) => Number(v))
                .filter((v) => Number.isFinite(v))
            : undefined,
        status: typeof data.status === "string" ? data.status : undefined,
        deletedAt: deleted,
    };
}
function normalizeListingDocument(id, data) {
    if (!data)
        return null;
    const deleted = toOptionalNumber(data.deletedAt);
    if (deleted && deleted > 0)
        return null;
    return {
        id,
        type: typeof data.type === "string" ? data.type : undefined,
        area_py: toOptionalNumber(data.area_py),
        price: toOptionalNumber(data.price),
        deposit: toOptionalNumber(data.deposit),
        monthly: toOptionalNumber(data.monthly),
        status: typeof data.status === "string" ? data.status : undefined,
        closedByUs: Boolean(data.closedByUs),
        deletedAt: deleted,
        updatedAt: toOptionalNumber(data.updatedAt),
        ownershipType: data.ownershipType === "partner" ? "partner" : "our",
    };
}
function normalizeListingType(value) {
    const text = String(value ?? "").toLowerCase();
    if (!text)
        return undefined;
    if (text.includes("sale") || text.includes("매매"))
        return "SALE";
    if (text.includes("jeonse") || text.includes("전세"))
        return "JEONSE";
    if (text.includes("rent") || text.includes("월세"))
        return "WOLSE";
    return undefined;
}
function resolveListingPrice(type, listing) {
    if (!type)
        return undefined;
    if (type === "SALE")
        return listing.price ?? undefined;
    if (type === "JEONSE")
        return listing.deposit ?? listing.price ?? undefined;
    return listing.monthly ?? listing.deposit ?? listing.price ?? undefined;
}
function buyerAllowsType(buyer, type) {
    if (!type)
        return false;
    if (!buyer.typePrefs || buyer.typePrefs.length === 0)
        return true;
    return buyer.typePrefs.some((pref) => normalizeListingType(pref) === type);
}
function buyerAllowsArea(buyer, area) {
    if (area == null)
        return true;
    if (typeof buyer.areaMinPy === "number" && area < buyer.areaMinPy)
        return false;
    if (typeof buyer.areaMaxPy === "number" && area > buyer.areaMaxPy)
        return false;
    if (Array.isArray(buyer.areaPrefsPy) && buyer.areaPrefsPy.length > 0) {
        return buyer.areaPrefsPy.some((preferred) => Math.abs(preferred - area) <= 1);
    }
    return true;
}
function buyerAllowsBudget(buyer, listing, type, price) {
    if (price == null)
        return true;
    if (typeof buyer.budgetMin === "number" && price < buyer.budgetMin)
        return false;
    if (typeof buyer.budgetMax === "number" && price > buyer.budgetMax)
        return false;
    if (type === "JEONSE") {
        const monthly = listing.monthly ?? price;
        if (typeof buyer.monthlyMax === "number" && monthly > buyer.monthlyMax)
            return false;
    }
    return true;
}
function listingIsActive(listing) {
    const status = String(listing.status ?? "").toLowerCase();
    return !(status.includes("완료") || status.includes("마감") || status.includes("종료"));
}
function passesBasicMatch(buyer, listing) {
    if (!listingIsActive(listing))
        return false;
    const type = normalizeListingType(listing.type);
    if (!buyerAllowsType(buyer, type))
        return false;
    if (!buyerAllowsArea(buyer, listing.area_py))
        return false;
    const price = resolveListingPrice(type, listing);
    if (!buyerAllowsBudget(buyer, listing, type, price))
        return false;
    return true;
}
function calcMatchScore(buyer, listing) {
    if (!passesBasicMatch(buyer, listing))
        return 0;
    let score = 0;
    if (normalizeListingType(listing.type))
        score += 1;
    if (typeof listing.area_py === "number")
        score += 1;
    if (resolveListingPrice(normalizeListingType(listing.type), listing) != null)
        score += 1;
    return score || 1;
}
function isStrictMatch(buyer, listing) {
    const type = normalizeListingType(listing.type);
    if (!type)
        return false;
    if (!buyer.typePrefs || buyer.typePrefs.length === 0)
        return false;
    if (!buyer.typePrefs.some((pref) => normalizeListingType(pref) === type))
        return false;
    const price = resolveListingPrice(type, listing);
    if (price == null)
        return false;
    if (typeof buyer.budgetMin === "number" && price < buyer.budgetMin)
        return false;
    if (typeof buyer.budgetMax === "number" && price > buyer.budgetMax)
        return false;
    if (type === "JEONSE") {
        const monthly = listing.monthly ?? price;
        if (typeof buyer.monthlyMax === "number" && monthly > buyer.monthlyMax)
            return false;
    }
    const area = listing.area_py;
    if (area == null)
        return false;
    if (typeof buyer.areaMinPy === "number" && area < buyer.areaMinPy)
        return false;
    if (typeof buyer.areaMaxPy === "number" && area > buyer.areaMaxPy)
        return false;
    if (buyer.areaPrefsPy && buyer.areaPrefsPy.length > 0) {
        const ok = buyer.areaPrefsPy.some((preferred) => Math.abs(preferred - area) <= 1);
        if (!ok)
            return false;
    }
    return true;
}
function matchListingsForBuyer(buyer, listings, limit = MATCH_LIMIT) {
    return listings
        .map((listing) => ({
        id: listing.id,
        score: calcMatchScore(buyer, listing),
        strict: isStrictMatch(buyer, listing),
    }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}
function matchBuyersForListing(listing, buyers, limit = MATCH_LIMIT) {
    return buyers
        .map((buyer) => ({
        id: buyer.id,
        score: calcMatchScore(buyer, listing),
        strict: isStrictMatch(buyer, listing),
    }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}
async function loadActiveBuyers() {
    const snap = await firestore.collection("buyers").get();
    return snap.docs
        .map((doc) => normalizeBuyerDocument(doc.id, doc.data()))
        .filter((item) => Boolean(item));
}
async function loadMatchListingDocs() {
    const snap = await firestore.collection(MATCH_COLLECTION).get();
    return snap.docs
        .map((doc) => normalizeListingDocument(doc.id, doc.data()))
        .filter((item) => Boolean(item));
}
async function recomputeBuyerSnapshot(buyerId, ctx = {}) {
    const buyers = ctx.buyers ?? (await loadActiveBuyers());
    const listings = ctx.listings ?? (await loadMatchListingDocs());
    const ref = firestore.collection(MATCH_BUYERS_COLLECTION).doc(buyerId);
    const buyer = buyers.find((row) => row.id === buyerId);
    if (!buyer) {
        await ref.delete().catch(() => { });
        return { listingIds: [] };
    }
    const matches = matchListingsForBuyer(buyer, listings, MATCH_LIMIT);
    await ref.set({ buyerId, listingIds: matches.map((m) => m.id), matches, updatedAt: Date.now() }, { merge: true });
    return { listingIds: matches.map((m) => m.id) };
}
async function recomputeListingSnapshot(listingId, ctx = {}) {
    const buyers = ctx.buyers ?? (await loadActiveBuyers());
    const ref = firestore.collection(MATCH_COLLECTION).doc(listingId);
    const snap = await ref.get();
    const prevBuyerIds = extractIdArray(snap.get("matchedBuyerIds"));
    let listing = ctx.listing !== undefined ? ctx.listing : normalizeListingDocument(listingId, snap.exists ? snap.data() : undefined);
    if (!listing) {
        if (snap.exists) {
            await ref.set({ matchedBuyerIds: [], matchedBuyers: [], matchesUpdatedAt: Date.now() }, { merge: true });
        }
        return { impactedBuyerIds: new Set(prevBuyerIds) };
    }
    const matches = matchBuyersForListing(listing, buyers, MATCH_LIMIT);
    await ref.set({ matchedBuyerIds: matches.map((m) => m.id), matchedBuyers: matches, matchesUpdatedAt: Date.now() }, { merge: true });
    return { impactedBuyerIds: new Set([...prevBuyerIds, ...matches.map((m) => m.id)]) };
}
export const syncMatchListing = onDocumentWritten({ region: "asia-northeast3", document: "listings/{listingId}" }, async (event) => {
    const listingId = event.params.listingId;
    const after = event.data?.after?.data();
    const target = firestore.collection(MATCH_COLLECTION).doc(listingId);
    if (!shouldIndexListing(after)) {
        const prevSnap = await target.get();
        const prevBuyerIds = extractIdArray(prevSnap.get("matchedBuyerIds"));
        await target.delete().catch(() => { });
        if (prevBuyerIds.length === 0)
            return;
        const buyers = await loadActiveBuyers();
        const listings = await loadMatchListingDocs();
        await Promise.all(prevBuyerIds.map((buyerId) => recomputeBuyerSnapshot(buyerId, { buyers, listings })));
        return;
    }
    const payload = sanitize(buildMatchListingPayload(after));
    await target.set(payload, { merge: true });
    const buyers = await loadActiveBuyers();
    const listing = normalizeListingDocument(listingId, payload);
    if (!listing)
        return;
    const { impactedBuyerIds } = await recomputeListingSnapshot(listingId, { listing, buyers });
    if (impactedBuyerIds.size === 0)
        return;
    const listings = await loadMatchListingDocs();
    await Promise.all(Array.from(impactedBuyerIds).map((buyerId) => recomputeBuyerSnapshot(buyerId, { buyers, listings })));
});
export const syncBuyerMatches = onDocumentWritten({ region: "asia-northeast3", document: "buyers/{buyerId}" }, async (event) => {
    const buyerId = event.params.buyerId;
    const beforeFields = pickBuyerRelevantFields(event.data?.before?.data());
    const afterFields = pickBuyerRelevantFields(event.data?.after?.data());
    if (!event.data?.after?.exists && !event.data?.before?.exists)
        return;
    if (event.data?.after?.exists && event.data?.before?.exists && sameBuyerRelevantFields(beforeFields, afterFields)) {
        return;
    }
    const buyers = await loadActiveBuyers();
    const listings = await loadMatchListingDocs();
    const prevSnap = await firestore.collection(MATCH_BUYERS_COLLECTION).doc(buyerId).get();
    const prevListingIds = extractIdArray(prevSnap.get("listingIds"));
    const { listingIds } = await recomputeBuyerSnapshot(buyerId, { buyers, listings });
    const impactedListingIds = new Set([...prevListingIds, ...listingIds]);
    if (impactedListingIds.size === 0)
        return;
    const listingMap = new Map(listings.map((row) => [row.id, row]));
    await Promise.all(Array.from(impactedListingIds).map((listingId) => recomputeListingSnapshot(listingId, { listing: listingMap.get(listingId) ?? null, buyers })));
});
export const kakaoAuth = onRequest({ region: "asia-northeast3", cors: true, secrets: [KAKAO_REST_KEY, KAKAO_CLIENT_SECRET] }, async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({ error: "method not allowed" });
        return;
    }
    try {
        const body = typeof req.body === "string"
            ? JSON.parse(req.body || "{}")
            : (req.body || {});
        const code = typeof body?.code === "string" ? body.code.trim() : undefined;
        const requestedRedirectUri = typeof body?.redirectUri === "string" && body.redirectUri.trim()
            ? body.redirectUri.trim()
            : undefined;
        let accessToken = String(body?.accessToken || req.query.accessToken || "").trim();
        if (!accessToken && code) {
            const redirectUri = resolveKakaoRedirectUri(requestedRedirectUri);
            const restKey = await KAKAO_REST_KEY.value();
            const clientSecret = (await KAKAO_CLIENT_SECRET.value()).trim();
            if (!restKey) {
                res.status(500).json({ error: "카카오 REST 키가 설정되지 않았습니다." });
                return;
            }
            if (!clientSecret) {
                res.status(500).json({ error: "카카오 클라이언트 시크릿이 설정되지 않았습니다." });
                return;
            }
            const redirectCandidates = Array.from(new Set([
                redirectUri,
                "https://www.samusildoo.com/kakao/callback",
                "https://samusildoo.com/kakao/callback",
                "https://rj-realestate-1dae8.web.app/kakao/callback",
                "https://www.rj-realestate-1dae8.web.app/kakao/callback",
                "https://rj-realestate-1dae8.firebaseapp.com/kakao/callback",
                "https://www.rj-realestate-1dae8.firebaseapp.com/kakao/callback",
            ].filter(Boolean)));
            const errors = [];
            for (const candidate of redirectCandidates) {
                try {
                    const params = new URLSearchParams({
                        grant_type: "authorization_code",
                        client_id: restKey,
                        client_secret: clientSecret,
                        redirect_uri: candidate,
                        code,
                    });
                    const tokenResp = await fetch("https://kauth.kakao.com/oauth/token", {
                        method: "POST",
                        headers: { "Content-Type": "application/x-www-form-urlencoded" },
                        body: params.toString(),
                    });
                    if (!tokenResp.ok) {
                        const text = await tokenResp.text().catch(() => "");
                        let parsed = null;
                        try {
                            parsed = JSON.parse(text);
                        }
                        catch { }
                        const detail = parsed?.error_description || parsed?.error || text;
                        errors.push({
                            redirectUri: candidate,
                            status: tokenResp.status,
                            detail: detail ? String(detail).slice(0, 400) : "",
                        });
                        continue;
                    }
                    const tokenData = (await tokenResp.json().catch(() => null));
                    accessToken = typeof tokenData?.access_token === "string" ? tokenData.access_token : "";
                    if (accessToken)
                        break;
                }
                catch (e) {
                    errors.push({
                        redirectUri: candidate,
                        status: 0,
                        detail: e?.message || "exchange failed",
                    });
                }
            }
            if (!accessToken) {
                console.error("kakaoAuth token exchange failed (all candidates)", { errors, code });
                res.status(400).json({
                    error: "failed to exchange Kakao auth code",
                    attempts: errors,
                    codeReceived: Boolean(code),
                });
                return;
            }
        }
        if (!accessToken) {
            res.status(400).json({ error: "accessToken or auth code is required" });
            return;
        }
        const profileResp = await fetch("https://kapi.kakao.com/v2/user/me", {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!profileResp.ok) {
            const text = await profileResp.text().catch(() => "");
            res.status(401).json({ error: "invalid kakao token", detail: text });
            return;
        }
        const profile = (await profileResp.json().catch(() => null));
        if (!profile?.id) {
            res.status(400).json({ error: "kakao profile is missing id" });
            return;
        }
        const kakaoId = String(profile.id);
        const account = profile.kakao_account || {};
        const kakaoProfile = account.profile || {};
        const providedNickname = typeof kakaoProfile.nickname === "string" && kakaoProfile.nickname.trim().length > 0
            ? kakaoProfile.nickname.trim()
            : undefined;
        const providedEmail = typeof account.email === "string" && account.email.trim().length > 0
            ? account.email.trim()
            : undefined;
        const emailVerified = account.is_email_verified === true || account.email_verified === true;
        if (!providedNickname || !providedEmail) {
            const missing = [];
            if (!providedNickname)
                missing.push("nickname");
            if (!providedEmail)
                missing.push("email");
            res.status(400).json({
                error: "카카오 프로필 정보에 닉네임 또는 이메일이 없습니다. 카카오 계정 설정을 확인해주세요.",
                missing,
            });
            return;
        }
        const nickname = providedNickname;
        const email = providedEmail;
        const uid = `kakao:${kakaoId}`;
        let record = await authAdmin.getUser(uid).catch(() => null);
        if (!record) {
            try {
                record = await authAdmin.createUser({
                    uid,
                    displayName: nickname,
                    email: email && emailVerified ? email : undefined,
                    emailVerified: Boolean(email && emailVerified),
                });
            }
            catch (error) {
                if (error?.code === "auth/email-already-exists") {
                    record = await authAdmin.createUser({ uid, displayName: nickname });
                }
                else {
                    throw error;
                }
            }
        }
        else {
            const updates = {};
            if (nickname && record.displayName !== nickname)
                updates.displayName = nickname;
            if (email && emailVerified && record.email !== email) {
                updates.email = email;
                updates.emailVerified = true;
            }
            if (Object.keys(updates).length > 0) {
                try {
                    record = await authAdmin.updateUser(uid, updates);
                }
                catch (error) {
                    if (error?.code === "auth/email-already-exists") {
                        const { email: _email, emailVerified: _emailVerified, ...safeUpdates } = updates;
                        if (Object.keys(safeUpdates).length > 0) {
                            record = await authAdmin.updateUser(uid, safeUpdates);
                        }
                    }
                    else {
                        throw error;
                    }
                }
            }
        }
        await firestore
            .collection("users")
            .doc(uid)
            .set({
            uid,
            email: email || record?.email || null,
            name: nickname,
            role: "viewer",
            provider: "kakao",
            kakao: { id: kakaoId, nickname },
            updatedAt: Date.now(),
        }, { merge: true });
        const token = await authAdmin.createCustomToken(uid, { provider: "kakao", role: "viewer" });
        res.status(200).json({
            ok: true,
            token,
            profile: { id: kakaoId, nickname, email: email || record?.email || null },
        });
    }
    catch (error) {
        console.error("kakaoAuth", error);
        res.status(500).json({ error: error?.message || "kakao auth failed" });
    }
});
export const rebuildMatchListings = onRequest({ region: "asia-northeast3", secrets: [MATCH_REBUILD_KEY], cors: true }, async (req, res) => {
    try {
        const requiredKey = MATCH_REBUILD_KEY.value();
        const providedKey = String(req.query.key || req.headers["x-admin-key"] || "");
        if (requiredKey && providedKey !== requiredKey) {
            res.status(401).json({ error: "unauthorized" });
            return;
        }
        let total = 0;
        let deleted = 0;
        let cursor;
        // Clear existing collection first to avoid stale docs
        const existing = await firestore.collection(MATCH_COLLECTION).select().get();
        if (!existing.empty) {
            const deletes = existing.docs.map((doc) => doc.ref.delete());
            await Promise.all(deletes);
        }
        const normalizedListings = [];
        while (true) {
            let query = firestore.collection("listings").orderBy("__name__").limit(400);
            if (cursor)
                query = query.startAfter(cursor);
            const snap = await query.get();
            if (snap.empty)
                break;
            const batch = firestore.batch();
            snap.docs.forEach((docSnap) => {
                const data = docSnap.data();
                const ref = firestore.collection(MATCH_COLLECTION).doc(docSnap.id);
                if (!shouldIndexListing(data)) {
                    batch.delete(ref);
                    deleted += 1;
                    return;
                }
                const payload = sanitize(buildMatchListingPayload(data));
                batch.set(ref, payload);
                const normalized = normalizeListingDocument(docSnap.id, payload);
                if (normalized)
                    normalizedListings.push(normalized);
                total += 1;
            });
            await batch.commit();
            cursor = snap.docs[snap.docs.length - 1];
        }
        const buyers = await loadActiveBuyers();
        const impactedBuyerIds = new Set();
        for (const listing of normalizedListings) {
            const { impactedBuyerIds: impacted } = await recomputeListingSnapshot(listing.id, { listing, buyers });
            impacted.forEach((id) => impactedBuyerIds.add(id));
        }
        const listingsCache = normalizedListings.length ? normalizedListings : await loadMatchListingDocs();
        await Promise.all(Array.from(impactedBuyerIds).map((buyerId) => recomputeBuyerSnapshot(buyerId, { buyers, listings: listingsCache })));
        res.status(200).json({ ok: true, total, skipped: deleted });
    }
    catch (error) {
        console.error("rebuildMatchListings", error);
        res.status(500).json({ error: error?.message || "rebuild failed" });
    }
});
// ---------------- On-demand API (compat) ----------------
export const realpriceSeries = onRequest({ region: "asia-northeast3", secrets: [MOLIT_SERVICE_KEY], cors: true }, async (req, res) => {
    try {
        const key = MOLIT_SERVICE_KEY.value();
        if (!key) {
            res.status(500).json({ error: "missing service key" });
            return;
        }
        const kindStr = String(req.query.type || "sale").toLowerCase();
        const type = (["jeonse", "wolse", "presale"].includes(kindStr) ? kindStr : "sale");
        const to = String(req.query.to || new Date().toISOString().slice(0, 7));
        const from = String(req.query.from ||
            (() => {
                const d = new Date();
                d.setMonth(d.getMonth() - 11);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            })());
        const complex = String(req.query.complex || "").trim();
        const rentFactor = Math.max(0, Math.min(360, Number(req.query.rentFactor) || 120));
        const cacheKey = JSON.stringify({ type, from, to, complex, rentFactor });
        const cached = cache.get(cacheKey);
        if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
            res.status(200).json(cached.data);
            return;
        }
        const ymList = months(from, to);
        const rows = [];
        for (const ym of ymList) {
            const ymNum = ym.replace("-", "");
            const endpoint = type === "sale"
                ? "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade"
                : type === "presale"
                    ? "https://apis.data.go.kr/1613000/RTMSDataSvcSilvTrade/getRTMSDataSvcSilvTrade"
                    : "https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent";
            const url = `${endpoint}?serviceKey=${encodeURIComponent(key)}&LAWD_CD=${LAWD_CD}&DEAL_YMD=${ymNum}&pageNo=1&numOfRows=1000&_type=json`;
            try {
                const resp = await fetch(url);
                const text = await resp.text();
                if (!resp.ok) {
                    console.error("series upstream", { status: resp.status, url, body: text.slice(0, 200) });
                    continue;
                }
                let items = [];
                try {
                    const j = JSON.parse(text);
                    const node = j?.response?.body?.items?.item;
                    if (Array.isArray(node))
                        items = node;
                    else if (node)
                        items = [node];
                }
                catch (e) {
                    console.error("series parse", { url, message: e?.message, sample: text.slice(0, 200) });
                    continue;
                }
                for (const it of items) {
                    const dong = String(it.umdNm ?? "").trim();
                    const allowed = ALLOWED_DONGS.has(dong) || dong.includes("잠원") || dong.includes("반포");
                    if (!allowed)
                        continue;
                    const apt = String(it.aptNm ?? "").trim();
                    if (complex && !apt.includes(complex))
                        continue;
                    if (type === "sale" || type === "presale") {
                        const price = toNumber(it.dealAmount) * 10000;
                        if (price > 0)
                            rows.push({ ym, price });
                    }
                    else {
                        const deposit = toNumber(it.deposit) * 10000;
                        const monthly = toNumber(it.rentFee) * 10000;
                        if (type === "jeonse") {
                            if (monthly === 0 && deposit > 0)
                                rows.push({ ym, price: deposit });
                        }
                        else {
                            if (monthly > 0)
                                rows.push({ ym, price: deposit + monthly * rentFactor });
                        }
                    }
                }
            }
            catch (e) {
                console.error("series fetch", { url, message: e?.message });
                continue;
            }
        }
        const byMonth = new Map();
        for (const r of rows) {
            if (!byMonth.has(r.ym))
                byMonth.set(r.ym, []);
            byMonth.get(r.ym).push(r.price);
        }
        const series = [...byMonth.entries()]
            .sort((a, b) => (a[0] < b[0] ? -1 : 1))
            .map(([date, arr]) => ({ date, price: Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) }));
        cache.set(cacheKey, { ts: Date.now(), data: series });
        res.status(200).json(series);
    }
    catch (e) {
        res.status(500).json({ error: e?.message || "server error" });
    }
});
// ---------------- Hosting proxy for same-origin JSON ----------------
export const realpriceProxy = onRequest({ region: "asia-northeast3" }, async (req, res) => {
    try {
        const bucket = storage.bucket();
        const p = String(req.path || "/realprice/daily_latest.json");
        const m = p.match(/\/realprice\/(.+)$/);
        const obj = m && m[1] ? m[1] : "daily_latest.json";
        const file = bucket.file(`realprice/${obj}`);
        const [exists] = await file.exists();
        if (!exists) {
            res.status(404).send("Not found");
            return;
        }
        const [meta] = await file.getMetadata().catch(() => [{ contentType: "application/json; charset=utf-8" }]);
        res.setHeader("Content-Type", meta?.contentType || "application/json; charset=utf-8");
        if (obj === "daily_latest.json")
            res.setHeader("Cache-Control", "no-cache");
        else if (meta?.cacheControl)
            res.setHeader("Cache-Control", meta.cacheControl);
        file
            .createReadStream()
            .on("error", () => res.status(500).end())
            .pipe(res);
    }
    catch (e) {
        res.status(500).send(e?.message || "proxy error");
    }
});
function parseDateFromItem(it, ym) {
    const y = Number(it.dealYear ?? String(ym).slice(0, 4));
    const m = Number(it.dealMonth ?? String(ym).slice(5, 7));
    const d = Number(it.dealDay ?? 1);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d))
        return undefined;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function toPyeong(areaM2) {
    if (!areaM2 || !Number.isFinite(areaM2))
        return undefined;
    return Math.round(areaM2 / 3.3058);
}
function getAreaM2(it) {
    const v = it.excluUseAr ?? it.area;
    const num = toFloat(v);
    return num > 0 ? num : undefined;
}
function normKey(s) {
    return String(s || "")
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[^a-z0-9가-힣]/g, "");
}
async function buildAliasMap() {
    try {
        const require = createRequire(import.meta.url);
        const raw = require("rj-realestate/src/data/complexes.json");
        const list = Array.isArray(raw) ? raw : raw?.default || [];
        const map = {};
        for (const c of list) {
            const name = String(c?.name || "").trim();
            if (!name)
                continue;
            map[normKey(name)] = name;
            const aliases = Array.isArray(c?.aliases) ? c.aliases : [];
            for (const a of aliases) {
                const k = normKey(String(a));
                if (k)
                    map[k] = name;
            }
        }
        return map;
    }
    catch {
        return {};
    }
}
export const buildRealpriceDaily = onSchedule(
// 매일 00:30 KST 고정 실행
{ schedule: "30 0 * * *", timeZone: "Asia/Seoul", region: "asia-northeast3", secrets: [MOLIT_SERVICE_KEY] }, async () => {
    await doBuildAndUpload();
});
export const buildRealpriceNow = onRequest({ region: "asia-northeast3", secrets: [MOLIT_SERVICE_KEY], cors: true }, async (_req, res) => {
    try {
        const out = await doBuildAndUpload();
        res.status(200).json(out);
    }
    catch (e) {
        res.status(500).json({ error: e?.message || "build error" });
    }
});
async function doBuildAndUpload() {
    const key = MOLIT_SERVICE_KEY.value();
    if (!key)
        throw new Error("missing service key");
    const aliasMap = await buildAliasMap();
    const now = new Date();
    const toYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const fromD = new Date(now);
    fromD.setMonth(fromD.getMonth() - 11);
    fromD.setDate(1);
    const fromYM = `${fromD.getFullYear()}-${String(fromD.getMonth() + 1).padStart(2, "0")}`;
    const ymList = months(fromYM, toYM);
    const rentFactor = 120;
    const txns = [];
    for (const ym of ymList) {
        const ymNum = ym.replace("-", "");
        const kinds = ["sale", "jeonse", "wolse", "presale"];
        for (const type of kinds) {
            // 페이지네이션으로 모든 페이지를 수집하고 바로 다음 종류로 이동
            {
                const endpoint = type === "sale"
                    ? "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade"
                    : type === "presale"
                        ? "https://apis.data.go.kr/1613000/RTMSDataSvcSilvTrade/getRTMSDataSvcSilvTrade"
                        : "https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent";
                let pageNo = 1;
                let fetched = 0;
                let totalCount = Infinity;
                while (fetched < totalCount) {
                    const url = `${endpoint}?serviceKey=${encodeURIComponent(key)}&LAWD_CD=${LAWD_CD}&DEAL_YMD=${ymNum}&pageNo=${pageNo}&numOfRows=1000&_type=json`;
                    try {
                        const resp = await fetch(url);
                        const text = await resp.text();
                        if (!resp.ok) {
                            console.error("snapshot upstream", { status: resp.status, url, body: text.slice(0, 200) });
                            break;
                        }
                        let items = [];
                        try {
                            const j = JSON.parse(text);
                            const body = j?.response?.body;
                            const node = body?.items?.item;
                            if (Array.isArray(node))
                                items = node;
                            else if (node)
                                items = [node];
                            totalCount = Number(body?.totalCount ?? items.length);
                        }
                        catch (e) {
                            console.error("snapshot parse", { url, message: e?.message, sample: text.slice(0, 200) });
                            break;
                        }
                        for (const it of items) {
                            const dong = String(it.umdNm ?? "").trim();
                            const allowed = ALLOWED_DONGS.has(dong) || dong.includes("?犾洂") || dong.includes("氚橅彫");
                            if (!allowed)
                                continue;
                            const aptRaw = String(it.aptNm ?? "").trim();
                            if (!aptRaw)
                                continue;
                            const apt = aliasMap[normKey(aptRaw)] || aptRaw;
                            const depositVal = type === "sale" || type === "presale" ? toFloat(it.dealAmount) * 10000 : toFloat(it.deposit) * 10000;
                            const monthlyVal = type === "sale" || type === "presale" ? 0 : toFloat(it.rentFee) * 10000;
                            let price = 0;
                            if (type === "sale" || type === "presale") {
                                price = depositVal;
                            }
                            else if (type === "jeonse") {
                                if (monthlyVal === 0 && depositVal > 0)
                                    price = depositVal;
                            }
                            else {
                                if (monthlyVal > 0)
                                    price = depositVal + monthlyVal * rentFactor;
                            }
                            if (price <= 0)
                                continue;
                            const areaM2 = getAreaM2(it);
                            const p = toPyeong(areaM2);
                            const date = parseDateFromItem(it, ym);
                            txns.push({
                                ym,
                                date,
                                complex: apt,
                                pyeong: p,
                                areaM2,
                                type,
                                rawType: type,
                                price,
                                deposit: depositVal > 0 ? depositVal : undefined,
                                monthly: monthlyVal > 0 ? monthlyVal : undefined,
                            });
                        }
                        fetched += items.length;
                        if (items.length === 0)
                            break;
                        pageNo += 1;
                    }
                    catch (e) {
                        console.error("snapshot fetch", { url, message: e?.message });
                        break;
                    }
                }
            }
            continue;
            const endpoint = type === "sale"
                ? "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade"
                : type === "presale"
                    ? "https://apis.data.go.kr/1613000/RTMSDataSvcSilvTrade/getRTMSDataSvcSilvTrade"
                    : "https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent";
            const url = `${endpoint}?serviceKey=${encodeURIComponent(key)}&LAWD_CD=${LAWD_CD}&DEAL_YMD=${ymNum}&pageNo=1&numOfRows=1000&_type=json`;
            try {
                const resp = await fetch(url);
                const text = await resp.text();
                if (!resp.ok) {
                    console.error("snapshot upstream", { status: resp.status, url, body: text.slice(0, 200) });
                    continue;
                }
                let items = [];
                try {
                    const j = JSON.parse(text);
                    const node = j?.response?.body?.items?.item;
                    if (Array.isArray(node))
                        items = node;
                    else if (node)
                        items = [node];
                }
                catch (e) {
                    console.error("snapshot parse", { url, message: e?.message, sample: text.slice(0, 200) });
                    continue;
                }
                for (const it of items) {
                    const dong = String(it.umdNm ?? "").trim();
                    const allowed = ALLOWED_DONGS.has(dong) || dong.includes("잠원") || dong.includes("반포");
                    if (!allowed)
                        continue;
                    const aptRaw = String(it.aptNm ?? "").trim();
                    if (!aptRaw)
                        continue;
                    const apt = aliasMap[normKey(aptRaw)] || aptRaw;
                    const depositVal = type === "sale" || type === "presale" ? toFloat(it.dealAmount) * 10000 : toFloat(it.deposit) * 10000;
                    const monthlyVal = type === "sale" || type === "presale" ? 0 : toFloat(it.rentFee) * 10000;
                    let price = 0;
                    if (type === "sale" || type === "presale") {
                        price = depositVal;
                    }
                    else if (type === "jeonse") {
                        if (monthlyVal === 0 && depositVal > 0)
                            price = depositVal;
                    }
                    else {
                        if (monthlyVal > 0)
                            price = depositVal + monthlyVal * rentFactor;
                    }
                    if (price <= 0)
                        continue;
                    const areaM2 = getAreaM2(it);
                    const p = toPyeong(areaM2);
                    const date = parseDateFromItem(it, ym);
                    txns.push({
                        ym,
                        date,
                        complex: apt,
                        pyeong: p,
                        areaM2,
                        type,
                        rawType: type,
                        price,
                        deposit: depositVal > 0 ? depositVal : undefined,
                        monthly: monthlyVal > 0 ? monthlyVal : undefined,
                    });
                }
            }
            catch (e) {
                console.error("snapshot fetch", { url, message: e?.message });
                continue;
            }
        }
    }
    // Aggregations
    const monthlyTotalsAll = new Map();
    const monthlyTotalsByComplex = new Map();
    const seriesByComplexPyeong = new Map();
    const monthlyTotalsAllByType = new Map();
    const monthlyTotalsByComplexByType = new Map();
    const seriesByComplexPyeongByType = new Map();
    for (const t of txns) {
        if (!monthlyTotalsAll.has(t.ym))
            monthlyTotalsAll.set(t.ym, { total: 0, count: 0 });
        const aggAll = monthlyTotalsAll.get(t.ym);
        aggAll.total += t.price;
        aggAll.count += 1;
        if (!monthlyTotalsByComplex.has(t.complex))
            monthlyTotalsByComplex.set(t.complex, new Map());
        const byMonth = monthlyTotalsByComplex.get(t.complex);
        if (!byMonth.has(t.ym))
            byMonth.set(t.ym, { total: 0, count: 0 });
        const agg = byMonth.get(t.ym);
        agg.total += t.price;
        agg.count += 1;
        if (!monthlyTotalsAllByType.has(t.type))
            monthlyTotalsAllByType.set(t.type, new Map());
        const allByType = monthlyTotalsAllByType.get(t.type);
        if (!allByType.has(t.ym))
            allByType.set(t.ym, { total: 0, count: 0 });
        const aggAllByType = allByType.get(t.ym);
        aggAllByType.total += t.price;
        aggAllByType.count += 1;
        if (!monthlyTotalsByComplexByType.has(t.complex))
            monthlyTotalsByComplexByType.set(t.complex, new Map());
        const byCxType = monthlyTotalsByComplexByType.get(t.complex);
        if (!byCxType.has(t.type))
            byCxType.set(t.type, new Map());
        const byCxTypeYm = byCxType.get(t.type);
        if (!byCxTypeYm.has(t.ym))
            byCxTypeYm.set(t.ym, { total: 0, count: 0 });
        const aggCxType = byCxTypeYm.get(t.ym);
        aggCxType.total += t.price;
        aggCxType.count += 1;
        if (t.pyeong) {
            if (!seriesByComplexPyeong.has(t.complex))
                seriesByComplexPyeong.set(t.complex, new Map());
            const byP = seriesByComplexPyeong.get(t.complex);
            if (!byP.has(t.pyeong))
                byP.set(t.pyeong, new Map());
            const byYm = byP.get(t.pyeong);
            if (!byYm.has(t.ym))
                byYm.set(t.ym, []);
            byYm.get(t.ym).push(t.price);
            if (!seriesByComplexPyeongByType.has(t.complex))
                seriesByComplexPyeongByType.set(t.complex, new Map());
            const byP2 = seriesByComplexPyeongByType.get(t.complex);
            if (!byP2.has(t.pyeong))
                byP2.set(t.pyeong, new Map());
            const byType = byP2.get(t.pyeong);
            if (!byType.has(t.type))
                byType.set(t.type, new Map());
            const byTypeYm = byType.get(t.type);
            if (!byTypeYm.has(t.ym))
                byTypeYm.set(t.ym, []);
            byTypeYm.get(t.ym).push(t.price);
        }
    }
    const toSeries = (m) => [...m.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([date, arr]) => ({ date, price: Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) }));
    const toSeriesStats = (m) => [...m.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([date, arr]) => {
        const sorted = arr.slice().sort((a, b) => a - b);
        const avg = Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length);
        const mid = Math.floor(sorted.length / 2);
        const median = sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
        return { date, avg, median, count: sorted.length };
    });
    const seriesOut = {};
    for (const [cx, byP] of seriesByComplexPyeong.entries()) {
        seriesOut[cx] = {};
        for (const [p, byYm] of byP.entries()) {
            seriesOut[cx][String(p)] = toSeries(byYm);
        }
    }
    const monthlyTotalsOut = {
        ALL: [...monthlyTotalsAll.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, v]) => ({
            date,
            total: v.total,
            count: v.count,
        })),
    };
    for (const [cx, byYm] of monthlyTotalsByComplex.entries()) {
        monthlyTotalsOut[cx] = [...byYm.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, v]) => ({ date, total: v.total, count: v.count }));
    }
    const kinds = ["sale", "jeonse", "wolse", "presale"];
    const monthlyTotalsByTypeOut = {
        ALL: { sale: [], jeonse: [], wolse: [], presale: [] },
    };
    for (const k of kinds) {
        const m = monthlyTotalsAllByType.get(k) || new Map();
        monthlyTotalsByTypeOut.ALL[k] = [...m.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, v]) => ({ date, total: v.total, count: v.count }));
    }
    for (const [cx, byType] of monthlyTotalsByComplexByType.entries()) {
        const entry = { sale: [], jeonse: [], wolse: [], presale: [] };
        for (const k of kinds) {
            const m = byType.get(k) || new Map();
            entry[k] = [...m.entries()]
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([date, v]) => ({ date, total: v.total, count: v.count }));
        }
        monthlyTotalsByTypeOut[cx] = entry;
    }
    const seriesByTypeOut = {};
    for (const [cx, byP] of seriesByComplexPyeongByType.entries()) {
        seriesByTypeOut[cx] = {};
        for (const [p, byType] of byP.entries()) {
            const obj = {};
            for (const k of kinds) {
                const m = byType.get(k) || new Map();
                obj[k] = toSeriesStats(m);
            }
            seriesByTypeOut[cx][String(p)] = obj;
        }
    }
    const snapshot = {
        generatedAt: new Date().toISOString(),
        range: { from: fromYM, to: toYM },
        monthlyTotals: monthlyTotalsOut,
        seriesByComplexPyeong: seriesOut,
        monthlyTotalsByType: monthlyTotalsByTypeOut,
        seriesByComplexPyeongByType: seriesByTypeOut,
        transactions: txns,
    };
    const bucket = storage.bucket();
    const today = new Date();
    const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    const datedPath = `realprice/daily_${ymd}.json`;
    const latestPath = `realprice/daily_latest.json`;
    const body = JSON.stringify(snapshot);
    await bucket.file(datedPath).save(Buffer.from(body), {
        metadata: { contentType: "application/json", cacheControl: "public, max-age=300" },
    });
    await bucket.file(latestPath).save(Buffer.from(body), {
        metadata: { contentType: "application/json", cacheControl: "no-cache" },
    });
    console.log("realprice snapshot uploaded", { datedPath, latestPath, count: txns.length });
    return { datedPath, latestPath, count: txns.length };
}
