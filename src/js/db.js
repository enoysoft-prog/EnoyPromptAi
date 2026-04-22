// js/db.js — Fixed: real counts, better related, safe queries
import { db } from "./firebase.js";
import { auth } from "./firebase.js";
import {
  collection, getDocs, getDoc, doc,
  query, where, orderBy, limit, startAfter
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const PAGE_SIZE = 12;

// Safe query — falls back to full fetch + client sort if index missing
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

// ── App Config ─────────────────────────────────────────────
export async function getAppConfig() {
  try {
    const snap = await getDoc(doc(db, "config", "app"));
    return snap.exists() ? snap.data() : {};
  } catch (e) { return {}; }
}

// ── Categories ─────────────────────────────────────────────
export async function getCategories() {
  try {
    const snap = await safeQ("categories", orderBy("order", "asc"));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  } catch (e) { return []; }
}

// ── Subcategories ──────────────────────────────────────────
export async function getSubcategories(categoryId) {
  if (!categoryId) return [];
  try {
    const snap = await getDocs(query(
      collection(db, "subcategories"),
      where("categoryId", "==", categoryId)
    ));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  } catch (e) { return []; }
}

// ── ALL prompts (for live stats + counting) ────────────────
// Cached in memory for the session to avoid repeated reads
let _allPromptsCache = null;
export async function getAllPromptsRaw() {
  if (_allPromptsCache) return _allPromptsCache;
  try {
    const snap = await getDocs(collection(db, "prompts"));
    _allPromptsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return _allPromptsCache;
  } catch (e) { return []; }
}

// ── Real live stats ────────────────────────────────────────
export async function getLiveStats() {
  const all = await getAllPromptsRaw();
  return {
    total:   all.length,
    free:    all.filter(p => !p.isPremium).length,
    premium: all.filter(p =>  p.isPremium).length,
    hot:     all.filter(p =>  p.isHot).length
  };
}

// ── Category prompt counts ─────────────────────────────────
export async function getCategoryStats() {
  const all = await getAllPromptsRaw();
  const map = {};
  all.forEach(p => {
    const cid = p.categoryId;
    if (!cid) return;
    if (!map[cid]) map[cid] = { total: 0, free: 0, premium: 0 };
    map[cid].total++;
    if (p.isPremium) map[cid].premium++; else map[cid].free++;
  });
  return map;
}

// ── Paginated prompts ──────────────────────────────────────
export async function getPrompts({
  cat = "", subcat = "", type = "", tool = "",
  pageSize = PAGE_SIZE, lastDoc = null
} = {}) {
  // Client-side filter on cached data is more reliable (avoids composite index issues)
  const all = await getAllPromptsRaw();
  let items = [...all];

  if (cat)    items = items.filter(p => p.categoryId    === cat);
  if (subcat) items = items.filter(p => p.subcategoryId === subcat);
  if (type === "free")    items = items.filter(p => !p.isPremium);
  if (type === "premium") items = items.filter(p =>  p.isPremium);
  if (type === "hot")     items = items.filter(p =>  p.isHot);
  if (tool)   items = items.filter(p => p.tool === tool);

  items.sort((a, b) => (b.dateAdded || "").localeCompare(a.dateAdded || ""));

  // Simulate pagination using offset stored in lastDoc (we use index)
  const offset = lastDoc ? parseInt(lastDoc) : 0;
  const page   = items.slice(offset, offset + pageSize);
  const nextOffset = offset + pageSize;

  return {
    items:   page,
    lastDoc: page.length === pageSize ? String(nextOffset) : null,
    hasMore: nextOffset < items.length
  };
}

// ── Trending ───────────────────────────────────────────────
export async function getTrendingPrompts(count = 6) {
  const all = await getAllPromptsRaw();
  return all
    .filter(p => p.isHot)
    .sort((a, b) => (b.dateAdded || "").localeCompare(a.dateAdded || ""))
    .slice(0, count);
}

// ── Single prompt ──────────────────────────────────────────
export async function getPromptById(id) {
  try {
    const snap = await getDoc(doc(db, "prompts", id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (e) { return null; }
}

// ── Related prompts — FIXED ────────────────────────────────
export async function getRelatedPrompts(prompt, count = 4) {
  const all = await getAllPromptsRaw();
  // Match same category first, then same tool — exclude self
  const related = all
    .filter(p => p.id !== prompt.id)
    .map(p => {
      let score = 0;
      if (p.categoryId    === prompt.categoryId    && prompt.categoryId)    score += 3;
      if (p.subcategoryId === prompt.subcategoryId && prompt.subcategoryId) score += 2;
      if (p.tool          === prompt.tool          && prompt.tool)          score += 1;
      return { ...p, _score: score };
    })
    .filter(p => p._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, count);

  // If not enough related, fill with latest from same category
  if (related.length < count) {
    const extra = all
      .filter(p => p.id !== prompt.id && !related.find(r => r.id === p.id))
      .filter(p => p.categoryId === prompt.categoryId && prompt.categoryId)
      .slice(0, count - related.length);
    related.push(...extra);
  }

  return related.slice(0, count);
}

// ── AI Tools ───────────────────────────────────────────────
export async function getTools() {
  try {
    const snap = await getDocs(collection(db, "tools"));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(t => t.isActive !== false)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  } catch (e) { return []; }
}

// ── Search ─────────────────────────────────────────────────
export async function searchPrompts(q) {
  const all = await getAllPromptsRaw();
  if (!q) return [];
  const lower = q.toLowerCase();
  return all.filter(p =>
    (p.title          || "").toLowerCase().includes(lower) ||
    (p.description    || "").toLowerCase().includes(lower) ||
    (p.tool           || "").toLowerCase().includes(lower) ||
    (p.categoryName   || "").toLowerCase().includes(lower) ||
    (p.subcategoryName|| "").toLowerCase().includes(lower) ||
    (p.tags || []).some(t => t.toLowerCase().includes(lower))
  ).slice(0, 20);
}

// ── Helpers ────────────────────────────────────────────────
export function formatNum(n) {
  if (!n && n !== 0) return "0";
  if (n >= 1000000) return (n/1000000).toFixed(1).replace(/\.0$/,"") + "M";
  if (n >= 1000)    return (n/1000).toFixed(1).replace(/\.0$/,"") + "k";
  return String(n);
}

export function cdnUrl(url, w = 800) {
  if (!url) return "";
  if (url.includes("cloudinary.com")) return url.replace("/upload/", `/upload/w_${w},q_auto,f_auto/`);
  return url;
}

export function timeSince(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30)  return `${days} days ago`;
  if (days < 365) return `${Math.floor(days/30)} months ago`;
  return `${Math.floor(days/365)} years ago`;
}
