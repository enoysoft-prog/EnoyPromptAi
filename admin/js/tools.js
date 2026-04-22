// js/tools.js — Fixed: proper reload after add, error display

import { db } from "./firebase.js";
import { toast, confirm, openModal, closeModal, btnLoad, skeleton, esc } from "./ui.js";
import {
  collection, addDoc, getDocs, getDoc, doc,
  updateDoc, deleteDoc, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const COL = "tools";
let _id = null;

export async function loadTools() {
  const tbody = document.getElementById("t-tbody");
  const cnt   = document.getElementById("t-count");
  if (!tbody) return;
  skeleton(tbody, 5, 3);
  try {
    let snap;
    try { snap = await getDocs(query(collection(db, COL), orderBy("name", "asc"))); }
    catch (e) { snap = await getDocs(collection(db, COL)); }

    const tools = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    if (cnt) cnt.textContent = tools.length;

    if (!tools.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-16 text-gray-400 text-sm">
        No AI tools yet. Click <strong>Add Tool</strong> to create one.</td></tr>`;
      return;
    }

    tbody.innerHTML = tools.map(t => `
      <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors group">
        <td class="px-4 py-3">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                 style="background:${esc(t.badgeColor || "#6366f1")}">
              ${esc((t.name || "T").charAt(0))}
            </div>
            <span class="font-semibold text-gray-900 text-sm">${esc(t.name || "—")}</span>
          </div>
        </td>
        <td class="px-4 py-3 text-sm text-gray-500 max-w-[200px] hidden sm:table-cell">
          <span title="${esc(t.description || "")}">${t.description ? esc(t.description.slice(0,60)) + (t.description.length>60?"…":"") : "—"}</span>
        </td>
        <td class="px-4 py-3 text-sm hidden md:table-cell">
          ${t.website
            ? `<a href="${esc(t.website)}" target="_blank" rel="noopener"
                class="text-indigo-600 hover:underline text-xs truncate block max-w-[140px]">${esc(t.website)}</a>`
            : `<span class="text-gray-400">—</span>`}
        </td>
        <td class="px-4 py-3">
          <div class="flex items-center gap-1.5">
            <span class="w-5 h-5 rounded border border-gray-200 inline-block shrink-0"
                  style="background:${esc(t.badgeColor || "#6366f1")}"></span>
            <span class="text-xs font-mono text-gray-500 hidden sm:inline">${esc(t.badgeColor || "—")}</span>
          </div>
        </td>
        <td class="px-4 py-3">
          ${t.isActive !== false
            ? `<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Active</span>`
            : `<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">Inactive</span>`}
        </td>
        <td class="px-4 py-3">
          <div class="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onclick="pvEditTool('${t.id}')" title="Edit"
              class="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600 transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </button>
            <button onclick="pvDelTool('${t.id}','${esc(t.name || "").replace(/'/g, "\\'")}')" title="Delete"
              class="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>`).join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-12 text-red-500 text-sm p-4">
      Error: ${e.message}<br>
      <span class="text-xs text-gray-400 block mt-1">Check Firestore Rules are published.</span>
      </td></tr>`;
  }
}

// Fetch all active tools (for prompt form datalist)
export async function fetchToolsForList() {
  try {
    let snap;
    try { snap = await getDocs(query(collection(db, COL), orderBy("name", "asc"))); }
    catch (e) { snap = await getDocs(collection(db, COL)); }
    return snap.docs
      .map(d => d.data())
      .filter(t => t.isActive !== false)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
      .map(t => t.name || "");
  } catch (e) { return []; }
}

export function openAddTool() {
  _id = null; resetForm();
  document.getElementById("tm-title").textContent = "Add AI Tool";
  openModal("modal-tool");
}

export async function editTool(id) {
  _id = id;
  try {
    const snap = await getDoc(doc(db, COL, id));
    if (!snap.exists()) { toast("Tool not found", "error"); return; }
    const t = snap.data();
    document.getElementById("tm-title").textContent = "Edit AI Tool";
    document.getElementById("ft-name").value  = t.name        || "";
    document.getElementById("ft-desc").value  = t.description || "";
    document.getElementById("ft-web").value   = t.website     || "";
    document.getElementById("ft-color").value = t.badgeColor  || "#6366f1";
    document.getElementById("ft-active").checked = t.isActive !== false;
    updateToolPrev();
    openModal("modal-tool");
  } catch (e) { toast("Error: " + e.message, "error"); }
}

export async function saveTool(e) {
  e.preventDefault();
  const btn  = document.getElementById("btn-save-tool");
  const name = document.getElementById("ft-name").value.trim();
  if (!name) { toast("Name is required", "error"); return; }
  btnLoad(btn, true, "Save Tool");
  try {
    const data = {
      name,
      description: document.getElementById("ft-desc").value.trim(),
      website:     document.getElementById("ft-web").value.trim(),
      badgeColor:  document.getElementById("ft-color").value,
      isActive:    document.getElementById("ft-active").checked,
      updatedAt:   serverTimestamp()
    };
    if (_id) {
      await updateDoc(doc(db, COL, _id), data);
      toast("Tool updated ✓");
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, COL), data);
      toast("Tool added ✓");
    }
    closeModal("modal-tool");
    await loadTools();
  } catch (err) {
    toast("Save failed: " + err.message, "error");
    console.error(err);
  } finally { btnLoad(btn, false, "Save Tool"); }
}

export function deleteTool(id, name) {
  confirm(`Delete tool "<strong>${esc(name)}</strong>"?`, async () => {
    try {
      await deleteDoc(doc(db, COL, id));
      toast("Tool deleted");
      await loadTools();
    } catch (e) { toast("Delete failed: " + e.message, "error"); }
  });
}

export function updateToolPrev() {
  const c = document.getElementById("ft-color")?.value || "#6366f1";
  const n = document.getElementById("ft-name")?.value  || "Tool";
  const p = document.getElementById("tool-prev");
  if (p) { p.style.background = c; p.textContent = n; }
}

function resetForm() {
  ["ft-name","ft-desc","ft-web"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  const c = document.getElementById("ft-color"); if (c) c.value = "#6366f1";
  const a = document.getElementById("ft-active"); if (a) a.checked = true;
  updateToolPrev();
}

window.pvEditTool = editTool;
window.pvDelTool  = deleteTool;
