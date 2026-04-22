// js/prompts.js — Fixed: edit works, tools dynamic, subcategory chain, proper reload

import { db }                                           from "./firebase.js";
import { uploadImage, showProgress, cdnUrl }            from "./cloudinary.js";
import { toast, confirm, openModal, closeModal,
         btnLoad, skeleton, trunc, esc, bindPreview }   from "./ui.js";
import { fetchCategoriesForSelect, fetchSubcatsForSelect } from "./categories.js";
import { fetchToolsForList }                            from "./tools.js";
import {
  collection, addDoc, getDocs, getDoc, doc,
  updateDoc, deleteDoc, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const COL = "prompts";
let _id = null, _imgUrl = "";

// ─────────────────────────────────────────────────────────
// LOAD TABLE
// ─────────────────────────────────────────────────────────
export async function loadPrompts() {
  const tbody = document.getElementById("p-tbody");
  const cnt   = document.getElementById("p-count");
  if (!tbody) return;
  skeleton(tbody, 6);

  try {
    let snap;
    try { snap = await getDocs(query(collection(db, COL), orderBy("dateAdded", "desc"))); }
    catch (e) { snap = await getDocs(collection(db, COL)); }

    const prompts = snap.docs.map(d => ({ _docId: d.id, ...d.data() }))
      .sort((a, b) => (b.dateAdded || "").localeCompare(a.dateAdded || ""));

    if (cnt) cnt.textContent = prompts.length;

    if (!prompts.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-20 text-gray-400 text-sm">
        No prompts yet. Click <strong>Add Prompt</strong> to create one.</td></tr>`;
      return;
    }

    tbody.innerHTML = prompts.map(p => {
      const thumb = cdnUrl(p.imageUrl, 64);
      const catLabel = p.categoryName || p.category || "—";
      const subLabel = p.subcategoryName ? ` › ${p.subcategoryName}` : "";
      return `
      <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors group">
        <td class="px-4 py-3">
          <div class="flex items-center gap-2.5">
            <img src="${esc(thumb) || "https://placehold.co/44x44/e8e8e8/999?text=?"}"
              class="w-11 h-11 rounded-xl object-cover ring-1 ring-gray-200 bg-gray-100 shrink-0"
              onerror="this.src='https://placehold.co/44x44/e8e8e8/999?text=!'" loading="lazy"/>
            <div class="min-w-0">
              <p class="font-semibold text-gray-900 text-sm leading-tight truncate max-w-[160px]">${esc(p.title || "—")}</p>
              <p class="text-xs text-gray-400 mt-0.5">${esc(p.dateAdded || "—")}</p>
            </div>
          </div>
        </td>
        <td class="px-4 py-3">
          <div class="flex flex-wrap gap-1">
            <span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 capitalize whitespace-nowrap">
              ${esc(catLabel)}
            </span>
            ${p.subcategoryName
              ? `<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 whitespace-nowrap">
                  ${esc(p.subcategoryName)}</span>`
              : ""}
          </div>
        </td>
        <td class="px-4 py-3 text-sm text-gray-600 whitespace-nowrap hidden sm:table-cell">${esc(p.tool || "—")}</td>
        <td class="px-4 py-3 whitespace-nowrap">
          ${p.isPremium
            ? `<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Premium</span>`
            : `<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Free</span>`}
          ${p.isHot ? `<span class="ml-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">🔥</span>` : ""}
        </td>
        <td class="px-4 py-3 text-sm text-gray-500 max-w-[180px] hidden md:table-cell">
          <span title="${esc(p.description || "")}">${trunc(p.description, 50)}</span>
        </td>
        <td class="px-4 py-3">
          <div class="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onclick="pvEditPrompt('${p._docId}')" title="Edit"
              class="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600 transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </button>
            <button onclick="pvDelPrompt('${p._docId}','${esc(p.title || "").replace(/'/g, "\\'")}')" title="Delete"
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
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-12 text-red-500 text-sm p-4">
      Error: ${e.message}<br>
      <span class="text-xs text-gray-400 block mt-1">Check Firestore Rules are published.</span>
    </td></tr>`;
  }
}

// ─────────────────────────────────────────────────────────
// CATEGORY + SUBCATEGORY CASCADE
// ─────────────────────────────────────────────────────────
async function buildCategorySelects(selectedCatId = "", selectedSubId = "") {
  // Show loading state
  const catSel = document.getElementById("f-category");
  if (catSel) catSel.innerHTML = `<option value="">Loading categories…</option>`;

  // Load categories and tools in parallel
  const [cats, tools] = await Promise.all([
    fetchCategoriesForSelect(),
    fetchToolsForList()
  ]);

  // Populate tool datalist from Firestore
  const toolList = document.getElementById("tool-list");
  if (toolList) {
    toolList.innerHTML = tools.map(t => `<option value="${esc(t)}"/>`).join("");
  }

  // Populate categories
  if (!catSel) return;
  if (!cats.length) {
    catSel.innerHTML = `<option value="">— No categories yet. Add one first. —</option>`;
    return;
  }
  catSel.innerHTML = `<option value="">— Select Category —</option>` +
    cats.map(c => `<option value="${esc(c.id)}"
      data-slug="${esc(c.slug || c.name)}"
      data-name="${esc(c.name)}"
      ${c.id === selectedCatId ? "selected" : ""}>
      ${c.emoji ? c.emoji + " " : ""}${esc(c.name)}
    </option>`).join("");

  // If editing with existing category, load its subcats
  if (selectedCatId) {
    await buildSubcatSelect(selectedCatId, selectedSubId);
  } else {
    hideSubcatSection();
  }

  // On change: reload subcats
  catSel.onchange = async () => {
    const selId = catSel.value;
    if (selId) {
      await buildSubcatSelect(selId, "");
    } else {
      hideSubcatSection();
    }
  };
}

async function buildSubcatSelect(categoryId, selectedSubId = "") {
  const wrap   = document.getElementById("f-subcat-wrap");
  const subSel = document.getElementById("f-subcategory");
  if (!wrap || !subSel) return;

  subSel.innerHTML = `<option value="">Loading…</option>`;
  const subs = await fetchSubcatsForSelect(categoryId);

  if (!subs.length) {
    wrap.classList.add("hidden");
    return;
  }

  wrap.classList.remove("hidden");
  subSel.innerHTML = `<option value="">— All (no filter) —</option>` +
    subs.map(s => `<option value="${esc(s.id)}"
      data-name="${esc(s.name)}"
      ${s.id === selectedSubId ? "selected" : ""}>${esc(s.name)}</option>`).join("");
}

function hideSubcatSection() {
  const wrap = document.getElementById("f-subcat-wrap");
  if (wrap) wrap.classList.add("hidden");
  const sub = document.getElementById("f-subcategory");
  if (sub) sub.value = "";
}

// ─────────────────────────────────────────────────────────
// ADD / EDIT / SAVE
// ─────────────────────────────────────────────────────────
export async function openAddPrompt() {
  _id = null; _imgUrl = "";
  resetForm();
  document.getElementById("pm-title").textContent = "Add Prompt";
  const prev = document.getElementById("f-img-preview");
  const hint = document.getElementById("f-img-hint");
  if (prev) { prev.src = ""; prev.classList.add("hidden"); }
  if (hint) hint.classList.add("hidden");
  // Build selects BEFORE opening modal
  await buildCategorySelects();
  openModal("modal-prompt");
}

export async function editPrompt(id) {
  _id = id;
  try {
    const snap = await getDoc(doc(db, COL, id));
    if (!snap.exists()) { toast("Prompt not found", "error"); return; }
    const p = snap.data();
    _imgUrl = p.imageUrl || "";

    document.getElementById("pm-title").textContent = "Edit Prompt";
    document.getElementById("f-title").value        = p.title       || "";
    document.getElementById("f-tool").value         = p.tool        || "";
    document.getElementById("f-description").value  = p.description || "";
    document.getElementById("f-fulltext").value     = p.fullText    || "";
    document.getElementById("f-tags").value         = (p.tags || []).join(", ");
    document.getElementById("f-date").value         = p.dateAdded   || "";
    document.getElementById("f-premium").checked   = !!p.isPremium;
    document.getElementById("f-hot").checked       = !!p.isHot;
    document.getElementById("f-imageurl").value    = p.imageUrl     || "";

    const prev = document.getElementById("f-img-preview");
    const hint = document.getElementById("f-img-hint");
    if (prev && p.imageUrl) { prev.src = cdnUrl(p.imageUrl, 500); prev.classList.remove("hidden"); }
    if (hint) { hint.textContent = "Current image — upload new file to replace it"; hint.classList.remove("hidden"); }

    // Build selects BEFORE opening modal (fix for edit not working)
    await buildCategorySelects(p.categoryId || "", p.subcategoryId || "");
    openModal("modal-prompt");
  } catch (e) {
    toast("Error loading prompt: " + e.message, "error");
    console.error(e);
  }
}

export async function savePrompt(e) {
  e.preventDefault();
  const btn   = document.getElementById("btn-save-p");
  const title = document.getElementById("f-title").value.trim();
  const full  = document.getElementById("f-fulltext").value.trim();
  if (!title) { toast("Title is required", "error"); return; }
  if (!full)  { toast("Prompt text is required", "error"); return; }

  const catSel  = document.getElementById("f-category");
  const subSel  = document.getElementById("f-subcategory");
  const catId   = catSel?.value || "";
  const catName = catSel?.selectedOptions[0]?.dataset?.name || catSel?.selectedOptions[0]?.text?.replace(/^[^\w]+/,"").trim() || "";
  const subId   = subSel?.value || "";
  const subName = subSel?.value ? (subSel.selectedOptions[0]?.dataset?.name || subSel.selectedOptions[0]?.text?.trim() || "") : "";
  const catSlug = catSel?.selectedOptions[0]?.dataset?.slug || catName.toLowerCase().replace(/\s+/g,"-") || "";

  btnLoad(btn, true, "Save Prompt");
  try {
    let imageUrl = _imgUrl;
    const file   = document.getElementById("f-image")?.files?.[0];
    const manual = document.getElementById("f-imageurl").value.trim();
    if (file) {
      const r  = await uploadImage(file, "promptvault/prompts", p => showProgress("f-uprog", p));
      imageUrl = r.url;
    } else if (manual && manual !== _imgUrl) {
      imageUrl = manual;
    }

    const tags = document.getElementById("f-tags").value
      .split(",").map(t => t.trim()).filter(Boolean);

    const data = {
      title,
      categoryId:      catId,
      categoryName:    catName,
      category:        catSlug,   // keeps backward compat (slug for filtering)
      subcategoryId:   subId,
      subcategoryName: subName,
      tool:            document.getElementById("f-tool").value.trim(),
      description:     document.getElementById("f-description").value.trim(),
      fullText:        full,
      tags,
      imageUrl,
      isPremium: document.getElementById("f-premium").checked,
      isHot:     document.getElementById("f-hot").checked,
      dateAdded: document.getElementById("f-date").value || new Date().toISOString().split("T")[0],
      updatedAt: serverTimestamp()
    };

    if (_id) {
      await updateDoc(doc(db, COL, _id), data);
      toast("Prompt updated ✓");
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, COL), data);
      toast("Prompt added ✓");
    }
    closeModal("modal-prompt");
    await loadPrompts();
  } catch (err) {
    toast("Save failed: " + err.message, "error");
    console.error(err);
  } finally { btnLoad(btn, false, "Save Prompt"); }
}

export function deletePrompt(id, title) {
  confirm(`Delete "<strong>${esc(title)}</strong>"? This cannot be undone.`, async () => {
    try {
      await deleteDoc(doc(db, COL, id));
      toast("Prompt deleted");
      await loadPrompts();
    } catch (e) { toast("Delete failed: " + e.message, "error"); }
  });
}

function resetForm() {
  ["f-title","f-tool","f-description","f-fulltext","f-tags","f-date","f-imageurl"]
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  const pr = document.getElementById("f-premium"); if (pr) pr.checked = false;
  const ht = document.getElementById("f-hot");     if (ht) ht.checked = false;
  const fi = document.getElementById("f-image");   if (fi) fi.value = "";
  const pg = document.getElementById("f-uprog");   if (pg) pg.innerHTML = "";
  hideSubcatSection();
}

window.pvEditPrompt = editPrompt;
window.pvDelPrompt  = deletePrompt;
