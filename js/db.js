// js/db.js — Firestore data layer
// KEY FIXES:
// 1. getAllPromptsRaw() no longer filters by status — loads ALL prompts (status filter was hiding everything)
// 2. Supports both 'fullText' and 'content' field names for prompt body
// 3. getCategoryStats() returns {total, free, premium} objects
import { db } from "./firebase.js";
import {
  collection, getDocs, getDoc, doc,
  query, where, orderBy, addDoc, updateDoc,
  serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const PAGE_SIZE = 12;

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
    let snap;
    try { snap = await getDocs(query(collection(db,"categories"), orderBy("order","asc"))); }
    catch { snap = await getDocs(collection(db,"categories")); }
    return snap.docs.map(d => ({ id:d.id, ...d.data() }))
      .sort((a,b) => (a.order??99)-(b.order??99));
  } catch { return []; }
}

export async function getSubcategories(categoryId) {
  if (!categoryId) return [];
  try {
    const snap = await getDocs(query(
      collection(db,"subcategories"), where("categoryId","==",categoryId)
    ));
    return snap.docs.map(d => ({ id:d.id, ...d.data() }))
      .sort((a,b) => (a.order??99)-(b.order??99));
  } catch { return []; }
}

// ── AI Tools ──────────────────────────────────────────────
export async function getTools() {
  try {
    let snap;
    try { snap = await getDocs(query(collection(db,"tools"), orderBy("order","asc"))); }
    catch { snap = await getDocs(collection(db,"tools")); }
    return snap.docs.map(d => ({ id:d.id, ...d.data() }));
  } catch { return []; }
}

// ── Prompt cache ──────────────────────────────────────────
let _cache = null;
export async function getAllPromptsRaw() {
  if (_cache) return _cache;
  try {
    // FIX: Do NOT filter by status — admin-created prompts have no status field
    // This was causing ALL prompts to be invisible
    const snap = await getDocs(collection(db,"prompts"));
    _cache = snap.docs.map(d => {
      const data = d.data();
      // FIX: normalise content field — admin saves as 'fullText', support both
      if (!data.content && data.fullText) data.content = data.fullText;
      return { id:d.id, ...data };
    });
    return _cache;
  } catch { return []; }
}
export function clearPromptsCache() { _cache = null; }

// ── Stats ─────────────────────────────────────────────────
export async function getLiveStats() {
  const all = await getAllPromptsRaw();
  return {
    total:   all.length,
    free:    all.filter(p => !p.isPremium).length,
    premium: all.filter(p =>  p.isPremium).length,
    hot:     all.filter(p =>  p.isHot).length,
  };
}

// FIX: returns {total, free, premium} objects (was returning plain numbers)
export async function getCategoryStats() {
  const all = await getAllPromptsRaw();
  const map = {};
  all.forEach(p => {
    const id = p.categoryId;
    if (!id) return;
    if (!map[id]) map[id] = { total:0, free:0, premium:0 };
    map[id].total++;
    if (p.isPremium) map[id].premium++;
    else             map[id].free++;
  });
  return map;
}

export async function getTrendingPrompts(n=6) {
  const all = await getAllPromptsRaw();
  return [...all]
    .sort((a,b) => {
      if (!!b.isHot !== !!a.isHot) return b.isHot ? 1 : -1;
      return (b.views||0)-(a.views||0);
    })
    .slice(0,n);
}

export async function getFreshPrompts(n=8) {
  const all = await getAllPromptsRaw();
  return [...all]
    .sort((a,b) => (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))
    .slice(0,n);
}

// ── Single prompt ─────────────────────────────────────────
export async function getPromptById(id) {
  if (!id) return null;
  try {
    const snap = await getDoc(doc(db,"prompts",id));
    if (!snap.exists()) return null;
    const data = snap.data();
    // FIX: normalise content field
    if (!data.content && data.fullText) data.content = data.fullText;
    updateDoc(doc(db,"prompts",id), { views: increment(1) }).catch(()=>{});
    return { id:snap.id, ...data };
  } catch { return null; }
}

// ── Filtered prompt list ──────────────────────────────────
export async function getPrompts({
  categoryId    = "",
  subcategoryId = "",
  toolId        = "",
  search        = "",
  isPremium,        // undefined=all, true=premium only, false=free only
  page          = 0,
} = {}) {
  try {
    let all = await getAllPromptsRaw();
    if (categoryId)    all = all.filter(p => p.categoryId === categoryId);
    if (subcategoryId) all = all.filter(p => p.subcategoryId === subcategoryId);
    if (toolId)        all = all.filter(p => p.toolId===toolId || p.tool===toolId);
    if (isPremium !== undefined) all = all.filter(p => !!p.isPremium === isPremium);
    if (search) {
      const q = search.toLowerCase();
      all = all.filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.content?.toLowerCase().includes(q) ||
        p.fullText?.toLowerCase().includes(q) ||
        (Array.isArray(p.tags) && p.tags.some(t => t?.toLowerCase().includes(q))) ||
        p.tool?.toLowerCase().includes(q)
      );
    }
    all.sort((a,b) => (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    const total = all.length;
    const start = page * PAGE_SIZE;
    return { items:all.slice(start, start+PAGE_SIZE), total, hasMore:start+PAGE_SIZE<total, page };
  } catch { return { items:[], total:0, hasMore:false, page:0 }; }
}

export async function getRelatedPrompts(prompt, n=4) {
  const all = await getAllPromptsRaw();
  return all
    .filter(p => p.id!==prompt.id &&
      (p.categoryId===prompt.categoryId || p.tool===prompt.tool))
    .slice(0,n);
}

// ── Submit prompt ─────────────────────────────────────────
export async function submitPrompt(data) {
  const ref = await addDoc(collection(db,"submissions"), {
    ...data, status:"pending", submittedAt:serverTimestamp(), views:0, copies:0, likes:0
  });
  return ref.id;
}

// ── Unlock ────────────────────────────────────────────────
export async function recordUnlock(uid, promptId) {
  try { await addDoc(collection(db,"unlocks"), { uid, promptId, unlockedAt:serverTimestamp() }); }
  catch {}
}
export async function hasUnlocked(uid, promptId) {
  try {
    const snap = await getDocs(query(collection(db,"unlocks"),
      where("uid","==",uid), where("promptId","==",promptId)));
    return !snap.empty;
  } catch { return false; }
}

// ── Format helpers ────────────────────────────────────────
export function formatNum(n) {
  if (n>=1e6) return (n/1e6).toFixed(1).replace(/\.0$/,"")+  "M";
  if (n>=1e3) return (n/1e3).toFixed(1).replace(/\.0$/,"") + "K";
  return String(n||0);
}
export function timeSince(d) {
  if (!d) return "";
  const ms = Date.now() - (d.seconds ? d.seconds*1000 : new Date(d).getTime());
  const s = ms/1000, m=s/60, h=m/60, dy=h/24;
  if (dy>=1) return Math.floor(dy)+"d ago";
  if (h>=1)  return Math.floor(h)+"h ago";
  if (m>=1)  return Math.floor(m)+"m ago";
  return "just now";
}
export function cdnUrl(url, w) {
  // Passthrough — Cloudinary URL transformation if URL is a Cloudinary URL
  if (!url) return "";
  if (url.includes("cloudinary.com") && w) {
    return url.replace("/upload/", `/upload/w_${w},c_fill,f_auto,q_auto/`);
  }
  return url;
}
