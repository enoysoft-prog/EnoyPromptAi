// js/db.js — All Firestore data layer
import { db } from "./firebase.js";
import {
  collection, getDocs, getDoc, doc,
  query, where, orderBy, addDoc, updateDoc,
  serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const PAGE_SIZE = 12;

// ── Safe query with index-missing fallback ────────────────
async function safeQ(col, ...constraints) {
  try {
    return await getDocs(query(collection(db, col), ...constraints));
  } catch (e) {
    if (e.code === "failed-precondition" || e.message?.includes("index")) {
      return getDocs(collection(db, col));
    }
    throw e;
  }
}

// ── App Config ────────────────────────────────────────────
export async function getAppConfig() {
  try {
    const snap = await getDoc(doc(db, "config", "app"));
    return snap.exists() ? snap.data() : {};
  } catch { return {}; }
}

// ── Categories ────────────────────────────────────────────
export async function getCategories() {
  try {
    const snap = await safeQ("categories", orderBy("order", "asc"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  } catch { return []; }
}

export async function getSubcategories(categoryId) {
  if (!categoryId) return [];
  try {
    const snap = await getDocs(query(
      collection(db, "subcategories"),
      where("categoryId", "==", categoryId)
    ));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  } catch { return []; }
}

// ── AI Tools ──────────────────────────────────────────────
export async function getTools() {
  try {
    const snap = await safeQ("tools", orderBy("order", "asc"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

// ── Prompt cache (session-level) ──────────────────────────
let _cache = null;
export async function getAllPromptsRaw() {
  if (_cache) return _cache;
  try {
    // Try with status filter first
    const snap = await getDocs(query(
      collection(db, "prompts"),
      where("status", "in", ["active", "approved"])
    ));
    _cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    // No index — fetch all, filter client side
    const snap = await getDocs(collection(db, "prompts"));
    _cache = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(p => !p.status || p.status === "active" || p.status === "approved");
  }
  return _cache;
}
export function clearPromptsCache() { _cache = null; }

// ── Stats ─────────────────────────────────────────────────
export async function getLiveStats() {
  const all = await getAllPromptsRaw();
  return {
    total:   all.length,
    free:    all.filter(p => !p.isPremium).length,
    premium: all.filter(p =>  p.isPremium).length,
    hot:     all.filter(p =>  p.isHot).length
  };
}

/**
 * Returns per-category stats: { [categoryId]: { total, free, premium } }
 * FIX: was returning plain numbers — now returns full objects for renderCategoryCard
 */
export async function getCategoryStats() {
  const all = await getAllPromptsRaw();
  const map = {};
  all.forEach(p => {
    const id = p.categoryId;
    if (!id) return;
    if (!map[id]) map[id] = { total: 0, free: 0, premium: 0 };
    map[id].total++;
    if (p.isPremium) map[id].premium++;
    else             map[id].free++;
  });
  return map;
}

export async function getTrendingPrompts(n = 6) {
  const all = await getAllPromptsRaw();
  // Hot prompts first, then by views
  const sorted = [...all].sort((a, b) => {
    const hotA = a.isHot ? 1 : 0;
    const hotB = b.isHot ? 1 : 0;
    if (hotB !== hotA) return hotB - hotA;
    return (b.views || 0) - (a.views || 0);
  });
  return sorted.slice(0, n);
}

export async function getFreshPrompts(n = 8) {
  const all = await getAllPromptsRaw();
  return [...all]
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    .slice(0, n);
}

// ── Single prompt ─────────────────────────────────────────
export async function getPromptById(id) {
  if (!id) return null;
  try {
    const snap = await getDoc(doc(db, "prompts", id));
    if (!snap.exists()) return null;
    // Silently bump view count
    updateDoc(doc(db, "prompts", id), { views: increment(1) }).catch(() => {});
    return { id: snap.id, ...snap.data() };
  } catch { return null; }
}

/**
 * Get filtered + paginated prompts.
 * FIX: param names corrected — categoryId, subcategoryId, toolId, search, isPremium, page
 */
export async function getPrompts({
  categoryId    = "",
  subcategoryId = "",
  toolId        = "",
  search        = "",
  isPremium,          // undefined = all, true = premium only, false = free only
  page          = 0,
} = {}) {
  try {
    let all = await getAllPromptsRaw();

    if (categoryId)    all = all.filter(p => p.categoryId    === categoryId);
    if (subcategoryId) all = all.filter(p => p.subcategoryId === subcategoryId);
    if (toolId)        all = all.filter(p => (p.toolId === toolId || p.tool === toolId));
    if (isPremium !== undefined) all = all.filter(p => !!p.isPremium === isPremium);
    if (search) {
      const q = search.toLowerCase();
      all = all.filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.content?.toLowerCase().includes(q) ||
        (Array.isArray(p.tags) && p.tags.some(t => t?.toLowerCase().includes(q))) ||
        p.tool?.toLowerCase().includes(q)
      );
    }

    all.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    const total  = all.length;
    const start  = page * PAGE_SIZE;
    const items  = all.slice(start, start + PAGE_SIZE);
    return { items, total, hasMore: start + PAGE_SIZE < total, page };
  } catch {
    return { items: [], total: 0, hasMore: false, page: 0 };
  }
}

export async function getRelatedPrompts(prompt, n = 4) {
  const all = await getAllPromptsRaw();
  return all
    .filter(p => p.id !== prompt.id &&
      (p.categoryId === prompt.categoryId || p.tool === prompt.tool))
    .slice(0, n);
}

// ── Submit prompt (Pro) ───────────────────────────────────
export async function submitPrompt(data) {
  const ref = await addDoc(collection(db, "submissions"), {
    ...data,
    status:      "pending",
    submittedAt: serverTimestamp(),
    views: 0, copies: 0, likes: 0
  });
  return ref.id;
}

// ── Unlock tracking ───────────────────────────────────────
export async function recordUnlock(uid, promptId) {
  try {
    await addDoc(collection(db, "unlocks"), {
      uid, promptId, unlockedAt: serverTimestamp()
    });
  } catch {}
}

export async function hasUnlocked(uid, promptId) {
  try {
    const snap = await getDocs(query(
      collection(db, "unlocks"),
      where("uid",      "==", uid),
      where("promptId", "==", promptId)
    ));
    return !snap.empty;
  } catch { return false; }
}

// ── Helpers ───────────────────────────────────────────────
export function formatNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n || 0);
}
