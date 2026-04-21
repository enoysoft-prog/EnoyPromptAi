// js/categories.js — Fixed: no composite index needed, client-side sort, permissions handled

import { db } from "./firebase.js";
import { uploadImage, showProgress, cdnUrl } from "./cloudinary.js";
import { toast, confirm, openModal, closeModal, btnLoad, skeleton, esc, bindPreview } from "./ui.js";
import {
  collection, addDoc, getDocs, getDoc, doc, updateDoc, deleteDoc,
  query, orderBy, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const CAT_COL = "categories";
const SUB_COL = "subcategories";
let _catId = null, _subId = null, _activeCatId = null, _activeCatName = "";

// ─────────────────────────────────────────────────────────
// Safe query helper — falls back if orderBy needs an index
// ─────────────────────────────────────────────────────────
async function safeDocs(col, ...constraints) {
  try {
    return await getDocs(query(collection(db, col), ...constraints));
  } catch (e) {
    if (e.code === "failed-precondition" || e.message?.includes("index")) {
      // Index missing — fetch all and sort client-side
      return getDocs(collection(db, col));
    }
    throw e;
  }
}

function sortByOrder(docs) {
  return docs.sort((a, b) => (a.data().order ?? 999) - (b.data().order ?? 999));
}

// ─────────────────────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────────────────────
export async function loadCategories() {
  const tbody = document.getElementById("cat-tbody");
  const cnt   = document.getElementById("cat-count");
  if (!tbody) return;
  skeleton(tbody, 5, 3);

  try {
    const snap = await safeDocs(CAT_COL, orderBy("order", "asc"));
    const cats = sortByOrder(snap.docs);
    if (cnt) cnt.textContent = cats.length;

    if (!cats.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-16 text-gray-400 text-sm">
        No categories yet. Click <strong>Add Category</strong>.</td></tr>`;
      return;
    }

    // Load all subcategory counts in one query
    let subCount = {};
    try {
      const subSnap = await getDocs(collection(db, SUB_COL));
      subSnap.forEach(d => {
        const cid = d.data().categoryId;
        if (cid) subCount[cid] = (subCount[cid] || 0) + 1;
      });
    } catch (e) { /* subcollection may not exist yet */ }

    tbody.innerHTML = cats.map(d => {
      const c  = d.data();
      const g  = `linear-gradient(135deg,${c.gradientStart || "#3730A3"},${c.gradientEnd || "#7C3AED"})`;
      const sc = subCount[d.id] || 0;
      return `
      <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors group">
        <td class="px-4 py-3">
          <div class="flex items-center gap-3">
            ${c.imageUrl
              ? `<img src="${cdnUrl(c.imageUrl, 64)}" class="w-11 h-11 rounded-xl object-cover ring-1 ring-gray-200 shrink-0" loading="lazy"/>`
              : `<div class="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0" style="background:${g}">${c.emoji || "📁"}</div>`}
            <div>
              <p class="font-semibold text-gray-900 text-sm">${esc(c.name || "—")}</p>
              <p class="text-xs text-gray-400 mt-0.5">
                Slug: <code class="bg-gray-100 px-1 rounded text-[10px]">${esc(c.slug || c.name?.toLowerCase() || "—")}</code>
                · Order: ${c.order ?? 0}
              </p>
            </div>
          </div>
        </td>
        <td class="px-4 py-3 text-xl hidden sm:table-cell">${c.emoji || "—"}</td>
        <td class="px-4 py-3 hidden md:table-cell">
          <div class="flex items-center gap-1.5">
            <span class="w-4 h-4 rounded border border-gray-200 shrink-0" style="background:${c.gradientStart || "#3730A3"}"></span>
            <span class="w-4 h-4 rounded border border-gray-200 shrink-0" style="background:${c.gradientEnd || "#7C3AED"}"></span>
            <div class="w-12 h-5 rounded ml-1" style="background:${g}"></div>
          </div>
        </td>
        <td class="px-4 py-3">
          <button onclick="pvManageSubs('${d.id}','${esc(c.name || "").replace(/'/g, "\\'")}')"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200
              hover:border-indigo-300 hover:bg-indigo-50 text-xs font-medium text-gray-700
              hover:text-indigo-700 transition whitespace-nowrap">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h8m-8 6h16"/>
            </svg>${sc} sub${sc === 1 ? "" : "s"}
          </button>
        </td>
        <td class="px-4 py-3">
          <div class="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onclick="pvEditCat('${d.id}')" title="Edit"
              class="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600 transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </button>
            <button onclick="pvDelCat('${d.id}','${esc(c.name || "").replace(/'/g, "\\'")}')" title="Delete"
              class="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>`;
    }).join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-12 text-red-500 text-sm p-4">
      Error: ${e.message}<br><span class="text-xs text-gray-400 mt-1 block">
      Check Firestore Rules — make sure you published them.</span></td></tr>`;
  }
}

export function openAddCat() {
  _catId = null;
  resetCatForm();
  document.getElementById("cm-title").textContent = "Add Category";
  const prev = document.getElementById("cat-img-prev");
  if (prev) { prev.src = ""; prev.classList.add("hidden"); }
  openModal("modal-cat");
}

export async function editCat(id) {
  _catId = id;
  try {
    const snap = await getDoc(doc(db, CAT_COL, id));
    if (!snap.exists()) { toast("Category not found", "error"); return; }
    const c = snap.data();
    document.getElementById("cm-title").textContent = "Edit Category";
    document.getElementById("fc-name").value  = c.name  || "";
    document.getElementById("fc-slug").value  = c.slug  || "";
    document.getElementById("fc-emoji").value = c.emoji || "";
    document.getElementById("fc-order").value = c.order ?? 0;
    document.getElementById("fc-gs").value    = c.gradientStart || "#3730A3";
    document.getElementById("fc-ge").value    = c.gradientEnd   || "#7C3AED";
    document.getElementById("fc-gs-hex").value = c.gradientStart || "#3730A3";
    document.getElementById("fc-ge-hex").value = c.gradientEnd   || "#7C3AED";
    updateGradPrev();
    const prev = document.getElementById("cat-img-prev");
    if (prev && c.imageUrl) { prev.src = cdnUrl(c.imageUrl, 300); prev.classList.remove("hidden"); }
    else if (prev) prev.classList.add("hidden");
    openModal("modal-cat");
  } catch (e) { toast("Error loading category: " + e.message, "error"); }
}

export async function saveCat(e) {
  e.preventDefault();
  const btn  = document.getElementById("btn-save-cat");
  const name = document.getElementById("fc-name").value.trim();
  if (!name) { toast("Name is required", "error"); return; }
  let slug = document.getElementById("fc-slug").value.trim();
  if (!slug) slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  btnLoad(btn, true, "Save Category");
  try {
    let imageUrl = "";
    if (_catId) {
      try { const s = await getDoc(doc(db, CAT_COL, _catId)); imageUrl = s.data()?.imageUrl || ""; } catch (_) {}
    }
    const file = document.getElementById("fc-image")?.files?.[0];
    if (file) {
      const r = await uploadImage(file, "promptvault/categories", p => showProgress("cat-uprog", p));
      imageUrl = r.url;
    }
    const data = {
      name, slug,
      emoji:         document.getElementById("fc-emoji").value.trim(),
      order:         parseInt(document.getElementById("fc-order").value) || 0,
      gradientStart: document.getElementById("fc-gs").value,
      gradientEnd:   document.getElementById("fc-ge").value,
      imageUrl,
      updatedAt: serverTimestamp()
    };
    if (_catId) {
      await updateDoc(doc(db, CAT_COL, _catId), data);
      toast("Category updated ✓");
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, CAT_COL), data);
      toast("Category added ✓");
    }
    closeModal("modal-cat");
    await loadCategories();
  } catch (err) {
    toast("Save failed: " + err.message, "error");
    console.error(err);
  } finally { btnLoad(btn, false, "Save Category"); }
}

export function deleteCat(id, name) {
  confirm(`Delete "<strong>${esc(name)}</strong>" and all its subcategories?`, async () => {
    try {
      // Delete subcategories first
      try {
        const subs = await getDocs(query(collection(db, SUB_COL), where("categoryId", "==", id)));
        for (const s of subs.docs) await deleteDoc(doc(db, SUB_COL, s.id));
      } catch (_) {}
      await deleteDoc(doc(db, CAT_COL, id));
      toast("Category deleted");
      await loadCategories();
    } catch (err) { toast("Delete failed: " + err.message, "error"); }
  });
}

export function updateGradPrev() {
  const s = document.getElementById("fc-gs")?.value || "#3730A3";
  const e = document.getElementById("fc-ge")?.value || "#7C3AED";
  const p = document.getElementById("grad-prev");
  if (p) p.style.background = `linear-gradient(135deg,${s},${e})`;
  const lbl = document.getElementById("grad-label");
  if (lbl) lbl.textContent = document.getElementById("fc-name")?.value || "Category";
}

function resetCatForm() {
  ["fc-name","fc-slug","fc-emoji","fc-order"].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = "";
  });
  const gs = document.getElementById("fc-gs"); if (gs) gs.value = "#3730A3";
  const ge = document.getElementById("fc-ge"); if (ge) ge.value = "#7C3AED";
  const gsH = document.getElementById("fc-gs-hex"); if (gsH) gsH.value = "#3730A3";
  const geH = document.getElementById("fc-ge-hex"); if (geH) geH.value = "#7C3AED";
  const fi = document.getElementById("fc-image"); if (fi) fi.value = "";
  const pg = document.getElementById("cat-uprog"); if (pg) pg.innerHTML = "";
  updateGradPrev();
}

// ─────────────────────────────────────────────────────────
// SUBCATEGORIES
// ─────────────────────────────────────────────────────────
export async function manageSubs(catId, catName) {
  _activeCatId   = catId;
  _activeCatName = catName;
  document.getElementById("sub-cat-name").textContent = catName;
  await loadSubs(catId);
  openModal("modal-subs");
}

async function loadSubs(catId) {
  const list = document.getElementById("sub-list");
  if (!list) return;
  list.innerHTML = `<div class="text-center py-8 text-gray-400 text-sm">Loading…</div>`;
  try {
    // Use where only (no orderBy to avoid composite index requirement)
    const snap = await getDocs(query(collection(db, SUB_COL), where("categoryId", "==", catId)));
    const subs = sortByOrder(snap.docs);

    if (!subs.length) {
      list.innerHTML = `<div class="text-center py-10 text-gray-400 text-sm">
        No subcategories yet.<br>
        <span class="text-xs text-gray-300">Click "+ Add Subcategory" above.</span>
      </div>`;
      return;
    }
    list.innerHTML = subs.map(d => {
      const s = d.data();
      return `
      <div class="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 group hover:bg-gray-50 transition">
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-900">${esc(s.name || "—")}</p>
          <p class="text-xs text-gray-400 mt-0.5">
            Slug: <code class="bg-gray-100 px-1 rounded text-[10px]">${esc(s.slug || "—")}</code>
            · Order: ${s.order ?? 0}
          </p>
        </div>
        <div class="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onclick="pvEditSub('${d.id}')"
            class="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600 transition">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
          <button onclick="pvDelSub('${d.id}','${esc(s.name || "").replace(/'/g, "\\'")}')"
            class="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </div>`;
    }).join("");
  } catch (e) {
    list.innerHTML = `<div class="text-center py-6 text-red-500 text-sm px-4">${e.message}</div>`;
  }
}

export function openAddSub() {
  _subId = null; resetSubForm();
  document.getElementById("sm-title").textContent = "Add Subcategory";
  openModal("modal-sub");
}

export async function editSub(id) {
  _subId = id;
  try {
    const snap = await getDoc(doc(db, SUB_COL, id));
    if (!snap.exists()) { toast("Not found", "error"); return; }
    const s = snap.data();
    document.getElementById("sm-title").textContent = "Edit Subcategory";
    document.getElementById("fs-name").value  = s.name  || "";
    document.getElementById("fs-slug").value  = s.slug  || "";
    document.getElementById("fs-order").value = s.order ?? 0;
    const slugEl = document.getElementById("fs-slug");
    if (slugEl) slugEl.dataset.manual = "1";
    openModal("modal-sub");
  } catch (e) { toast("Error: " + e.message, "error"); }
}

export async function saveSub(e) {
  e.preventDefault();
  const btn  = document.getElementById("btn-save-sub");
  const name = document.getElementById("fs-name").value.trim();
  if (!name) { toast("Name is required", "error"); return; }
  let slug = document.getElementById("fs-slug").value.trim();
  if (!slug) slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  btnLoad(btn, true, "Save");
  try {
    const data = {
      name, slug,
      categoryId:   _activeCatId,
      categoryName: _activeCatName,
      order:   parseInt(document.getElementById("fs-order").value) || 0,
      updatedAt: serverTimestamp()
    };
    if (_subId) {
      await updateDoc(doc(db, SUB_COL, _subId), data);
      toast("Subcategory updated ✓");
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, SUB_COL), data);
      toast("Subcategory added ✓");
    }
    closeModal("modal-sub");
    await loadSubs(_activeCatId);
    await loadCategories();
  } catch (err) {
    toast("Save failed: " + err.message, "error");
    console.error(err);
  } finally { btnLoad(btn, false, "Save"); }
}

export function deleteSub(id, name) {
  confirm(`Delete subcategory "<strong>${esc(name)}</strong>"?`, async () => {
    try {
      await deleteDoc(doc(db, SUB_COL, id));
      toast("Deleted");
      await loadSubs(_activeCatId);
      await loadCategories();
    } catch (e) { toast("Delete failed: " + e.message, "error"); }
  });
}

function resetSubForm() {
  ["fs-name","fs-slug","fs-order"].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ""; delete el.dataset.manual; }
  });
}

// ─────────────────────────────────────────────────────────
// FETCH HELPERS (used by prompts.js)
// ─────────────────────────────────────────────────────────
export async function fetchCategoriesForSelect() {
  try {
    const snap = await getDocs(collection(db, CAT_COL));
    return sortByOrder(snap.docs).map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { console.error("fetchCategories:", e); return []; }
}

export async function fetchSubcatsForSelect(categoryId) {
  if (!categoryId) return [];
  try {
    const snap = await getDocs(query(collection(db, SUB_COL), where("categoryId", "==", categoryId)));
    return sortByOrder(snap.docs).map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { console.error("fetchSubcats:", e); return []; }
}

// Globals
window.pvEditCat    = editCat;
window.pvDelCat     = deleteCat;
window.pvManageSubs = manageSubs;
window.pvEditSub    = editSub;
window.pvDelSub     = deleteSub;
