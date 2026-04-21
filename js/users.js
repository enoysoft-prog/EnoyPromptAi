// js/users.js — Complete user management for admin panel
import { db } from "./firebase.js";
import { toast, confirm, openModal, closeModal, btnLoad, skeleton, esc } from "./ui.js";
import {
  collection, getDocs, getDoc, doc, updateDoc,
  deleteDoc, query, orderBy, where, serverTimestamp, limit
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const COL = "users";

// ── Status config ──────────────────────────────────────────
const STATUS = {
  pending: { label:"Pending",  bg:"bg-amber-100",  text:"text-amber-700",  dot:"#f59e0b" },
  active:  { label:"Active",   bg:"bg-green-100",  text:"text-green-700",  dot:"#10b981" },
  banned:  { label:"Banned",   bg:"bg-red-100",    text:"text-red-700",    dot:"#ef4444" },
};

// ── Load users table ───────────────────────────────────────
export async function loadUsers(filterStatus = "") {
  const tbody = document.getElementById("usr-tbody");
  const cnt   = document.getElementById("usr-count");
  if (!tbody) return;
  skeleton(tbody, 6, 5);

  try {
    let snap;
    try {
      snap = filterStatus
        ? await getDocs(query(collection(db,COL), where("status","==",filterStatus), orderBy("createdAt","desc")))
        : await getDocs(query(collection(db,COL), orderBy("createdAt","desc")));
    } catch (e) {
      // No index — fetch all, filter client-side
      snap = await getDocs(collection(db,COL));
    }

    let users = snap.docs.map(d => ({ _docId:d.id, ...d.data() }));

    // Client-side filter if needed
    if (filterStatus) users = users.filter(u => u.status === filterStatus);

    // Sort newest first
    users.sort((a,b) => {
      const ta = a.createdAt?.seconds || 0;
      const tb = b.createdAt?.seconds || 0;
      return tb - ta;
    });

    if (cnt) cnt.textContent = users.length;
    updateFilterCounts(users);

    if (!users.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-16 text-gray-400 text-sm">
        No users found${filterStatus ? ` with status "${filterStatus}"` : ""}.
        Users appear here when they register on the website.</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(u => renderUserRow(u)).join("");
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-12 text-red-500 text-sm p-4">
      ${e.message}<br><span class="text-xs text-gray-400 mt-1 block">Check Firestore rules include the users collection.</span>
    </td></tr>`;
  }
}

function renderUserRow(u) {
  const s       = STATUS[u.status] || STATUS.pending;
  const initials = u.displayName
    ? u.displayName.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2)
    : (u.email||"U").charAt(0).toUpperCase();
  const joined   = u.createdAt?.toDate
    ? u.createdAt.toDate().toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})
    : (u.createdAt ? new Date(u.createdAt.seconds*1000).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "—");
  const lastLogin = u.lastLoginAt?.toDate
    ? u.lastLoginAt.toDate().toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})
    : "—";
  const savedCount = (u.savedPrompts||[]).length;
  const roleClass  = u.role === "admin"
    ? "bg-indigo-100 text-indigo-700"
    : "bg-gray-100 text-gray-600";

  return `
  <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors group" data-uid="${esc(u._docId)}">
    <td class="px-4 py-3">
      <div class="flex items-center gap-3">
        ${u.avatarUrl
          ? `<img src="${esc(u.avatarUrl)}" alt="${esc(u.displayName||u.email)}"
               class="w-10 h-10 rounded-full object-cover ring-2 ring-gray-200 shrink-0"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
             <div class="w-10 h-10 rounded-full shrink-0 hidden items-center justify-center
               text-white text-sm font-bold"
               style="background:linear-gradient(135deg,#4f46e5,#7c3aed);display:none;">${initials}</div>`
          : `<div class="w-10 h-10 rounded-full shrink-0 flex items-center justify-center
               text-white text-sm font-bold"
               style="background:linear-gradient(135deg,#4f46e5,#7c3aed);">${initials}</div>`}
        <div class="min-w-0">
          <p class="font-semibold text-gray-900 text-sm truncate max-w-[160px]">
            ${esc(u.displayName || "No name")}
          </p>
          <p class="text-xs text-gray-400 truncate max-w-[160px]">${esc(u.email||"—")}</p>
        </div>
      </div>
    </td>
    <td class="px-4 py-3">
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full shrink-0" style="background:${s.dot}"></span>
        <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}">
          ${s.label}
        </span>
      </div>
    </td>
    <td class="px-4 py-3">
      <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold ${roleClass}">
        ${u.role === "admin" ? "👑 Admin" : "👤 User"}
      </span>
    </td>
    <td class="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">
      <div>
        <p>Joined: <span class="font-medium">${joined}</span></p>
        <p class="text-xs text-gray-400 mt-0.5">Login: ${lastLogin}</p>
      </div>
    </td>
    <td class="px-4 py-3 hidden sm:table-cell">
      <span class="text-sm font-semibold text-gray-700">${savedCount}</span>
      <span class="text-xs text-gray-400 ml-1">saved</span>
    </td>
    <td class="px-4 py-3">
      <div class="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <!-- View profile -->
        <button onclick="pvViewUser('${esc(u._docId)}')" title="View profile"
          class="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600 transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
          </svg>
        </button>
        <!-- Approve (only for pending) -->
        ${u.status === "pending"
          ? `<button onclick="pvApproveUser('${esc(u._docId)}')" title="Approve user"
               class="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition">
               <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
               </svg>
             </button>` : ""}
        <!-- Ban / Unban -->
        ${u.status !== "banned"
          ? `<button onclick="pvBanUser('${esc(u._docId)}','${esc(u.email||u.displayName||"").replace(/'/g,"\\'")}' )" title="Ban user"
               class="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition">
               <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                   d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
               </svg>
             </button>`
          : `<button onclick="pvUnbanUser('${esc(u._docId)}')" title="Unban user"
               class="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition">
               <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                   d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
               </svg>
             </button>`}
        <!-- Delete -->
        <button onclick="pvDeleteUser('${esc(u._docId)}','${esc(u.email||u.displayName||"").replace(/'/g,"\\'")}' )" title="Delete account"
          class="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      </div>
    </td>
  </tr>`;
}

// ── Filter count badges ────────────────────────────────────
function updateFilterCounts(users) {
  const counts = { all: users.length, pending: 0, active: 0, banned: 0 };
  users.forEach(u => { if (counts[u.status] !== undefined) counts[u.status]++; });
  const tabs = { all:"fc-all", pending:"fc-pending", active:"fc-active", banned:"fc-banned" };
  Object.entries(tabs).forEach(([k,id]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = counts[k] || 0;
  });
  // Pending badge in sidebar
  const badge = document.getElementById("users-pending-badge");
  if (badge) {
    badge.textContent  = counts.pending;
    badge.style.display = counts.pending > 0 ? "flex" : "none";
  }
}

// ── View user profile modal ────────────────────────────────
export async function viewUser(id) {
  try {
    const snap = await getDoc(doc(db, COL, id));
    if (!snap.exists()) { toast("User not found","error"); return; }
    const u = snap.data();
    const s = STATUS[u.status] || STATUS.pending;
    const initials = u.displayName
      ? u.displayName.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2)
      : (u.email||"U").charAt(0).toUpperCase();
    const joined = u.createdAt?.toDate
      ? u.createdAt.toDate().toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})
      : "—";
    const lastLogin = u.lastLoginAt?.toDate
      ? u.lastLoginAt.toDate().toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})
      : "—";

    const body = document.getElementById("view-user-body");
    if (!body) return;

    body.innerHTML = `
    <div class="text-center pb-6 border-b border-gray-100 mb-6">
      ${u.avatarUrl
        ? `<img src="${esc(u.avatarUrl)}" alt="${esc(u.displayName||"User")}"
             class="w-20 h-20 rounded-full object-cover ring-4 ring-indigo-100 mx-auto mb-4"
             onerror="this.style.display='none'"/>`
        : `<div class="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center
             text-white text-2xl font-bold"
             style="background:linear-gradient(135deg,#4f46e5,#7c3aed);">${initials}</div>`}
      <h3 class="text-xl font-bold text-gray-900">${esc(u.displayName||"No name set")}</h3>
      <p class="text-sm text-gray-500 mt-1">${esc(u.email||"—")}</p>
      <div class="flex items-center justify-center gap-2 mt-3 flex-wrap">
        <span class="px-3 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text} flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full" style="background:${s.dot}"></span>
          ${s.label}
        </span>
        <span class="px-3 py-1 rounded-full text-xs font-semibold ${u.role==="admin"?"bg-indigo-100 text-indigo-700":"bg-gray-100 text-gray-600"}">
          ${u.role==="admin"?"👑 Admin":"👤 User"}
        </span>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4 mb-6">
      <div class="bg-gray-50 rounded-xl p-4 text-center">
        <p class="text-2xl font-bold text-gray-900">${(u.savedPrompts||[]).length}</p>
        <p class="text-xs text-gray-500 mt-1">Saved Prompts</p>
      </div>
      <div class="bg-gray-50 rounded-xl p-4 text-center">
        <p class="text-sm font-bold text-gray-900">${joined}</p>
        <p class="text-xs text-gray-500 mt-1">Joined</p>
      </div>
    </div>

    <div class="space-y-3 mb-6">
      <div class="flex items-center justify-between py-2.5 border-b border-gray-100">
        <span class="text-sm text-gray-500">User ID</span>
        <span class="text-xs font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded max-w-[180px] truncate">${esc(id)}</span>
      </div>
      <div class="flex items-center justify-between py-2.5 border-b border-gray-100">
        <span class="text-sm text-gray-500">Last Login</span>
        <span class="text-sm font-medium text-gray-700">${lastLogin}</span>
      </div>
      <div class="flex items-center justify-between py-2.5 border-b border-gray-100">
        <span class="text-sm text-gray-500">Provider</span>
        <span class="text-sm font-medium text-gray-700">${esc(u.provider||"Email")}</span>
      </div>
      ${u.bio ? `<div class="py-2.5">
        <p class="text-sm text-gray-500 mb-1">Bio</p>
        <p class="text-sm text-gray-700">${esc(u.bio)}</p>
      </div>` : ""}
    </div>

    <!-- Quick actions in modal -->
    <div class="flex flex-wrap gap-2">
      ${u.status === "pending"
        ? `<button onclick="pvApproveUser('${id}');pvCloseViewModal();" class="btn-sm btn-pr flex-1 justify-center">
             ✓ Approve User</button>` : ""}
      ${u.status !== "banned"
        ? `<button onclick="pvBanUser('${id}','${esc(u.email||"").replace(/'/g,"\\'")}');pvCloseViewModal();"
             class="btn-sm btn-sec flex-1 justify-center text-amber-600 border-amber-200">
             🚫 Ban User</button>`
        : `<button onclick="pvUnbanUser('${id}');pvCloseViewModal();"
             class="btn-sm btn-sec flex-1 justify-center text-green-600 border-green-200">
             ✓ Unban User</button>`}
      <button onclick="pvDeleteUser('${id}','${esc(u.email||u.displayName||"").replace(/'/g,"\\'")}');pvCloseViewModal();"
        class="btn-sm btn-sec flex-1 justify-center text-red-500 border-red-200">
        🗑 Delete</button>
    </div>`;

    openModal("modal-view-user");
  } catch(e) { toast("Error: "+e.message,"error"); }
}

// ── Approve ────────────────────────────────────────────────
export async function approveUser(id) {
  try {
    await updateDoc(doc(db,COL,id), { status:"active", approvedAt:serverTimestamp(), updatedAt:serverTimestamp() });
    toast("User approved ✓");
    await loadUsers(currentFilter());
  } catch(e) { toast("Failed: "+e.message,"error"); }
}

// ── Ban ────────────────────────────────────────────────────
export function banUser(id, identifier) {
  confirm(
    `Ban user <strong>${esc(identifier)}</strong>? They will not be able to log in.`,
    async () => {
      try {
        await updateDoc(doc(db,COL,id), { status:"banned", bannedAt:serverTimestamp(), updatedAt:serverTimestamp() });
        toast("User banned");
        await loadUsers(currentFilter());
      } catch(e) { toast("Failed: "+e.message,"error"); }
    },
    "Ban User", true
  );
}

// ── Unban ──────────────────────────────────────────────────
export async function unbanUser(id) {
  try {
    await updateDoc(doc(db,COL,id), { status:"active", bannedAt:null, updatedAt:serverTimestamp() });
    toast("User unbanned ✓");
    await loadUsers(currentFilter());
  } catch(e) { toast("Failed: "+e.message,"error"); }
}

// ── Delete ─────────────────────────────────────────────────
export function deleteUser(id, identifier) {
  confirm(
    `Permanently delete <strong>${esc(identifier)}</strong>'s account?<br>
     <span style="font-size:12px;color:#6b7280;display:block;margin-top:4px;">
     This removes their profile and saved prompts from Firestore.<br>
     Their Firebase Auth account must be deleted separately in Firebase Console.</span>`,
    async () => {
      try {
        await deleteDoc(doc(db,COL,id));
        toast("User deleted");
        await loadUsers(currentFilter());
      } catch(e) { toast("Failed: "+e.message,"error"); }
    },
    "Delete Account", true
  );
}

// ── Change role ────────────────────────────────────────────
export async function setRole(id, role) {
  try {
    await updateDoc(doc(db,COL,id), { role, updatedAt:serverTimestamp() });
    toast(`Role changed to ${role} ✓`);
    await loadUsers(currentFilter());
  } catch(e) { toast("Failed: "+e.message,"error"); }
}

// ── Helper: get current active filter ─────────────────────
function currentFilter() {
  return document.querySelector(".usr-filter-btn.active")?.dataset.status || "";
}

// ── Fetch user stats for dashboard ────────────────────────
export async function getUserStats() {
  try {
    const snap = await getDocs(collection(db,COL));
    const users = snap.docs.map(d => d.data());
    return {
      total:   users.length,
      active:  users.filter(u => u.status==="active").length,
      pending: users.filter(u => u.status==="pending").length,
      banned:  users.filter(u => u.status==="banned").length,
    };
  } catch(e) { return { total:0, active:0, pending:0, banned:0 }; }
}

// ── Global onclick handlers ────────────────────────────────
window.pvViewUser    = viewUser;
window.pvApproveUser = approveUser;
window.pvBanUser     = banUser;
window.pvUnbanUser   = unbanUser;
window.pvDeleteUser  = deleteUser;
window.pvCloseViewModal = () => closeModal("modal-view-user");
