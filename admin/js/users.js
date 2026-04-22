// admin/js/users.js — User management with pro status and coins
import { db } from "./firebase.js";
import { toast, confirm, openModal, closeModal, btnLoad, skeleton, esc } from "./ui.js";
import {
  collection, getDocs, getDoc, doc, updateDoc,
  deleteDoc, query, orderBy, where, serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const COL = "users";

const STATUS_CFG = {
  pending: { label:"Pending", bg:"bg-amber-100",  text:"text-amber-700",  dot:"#f59e0b" },
  active:  { label:"Active",  bg:"bg-green-100",  text:"text-green-700",  dot:"#10b981" },
  banned:  { label:"Banned",  bg:"bg-red-100",    text:"text-red-700",    dot:"#ef4444" },
};

const ROLE_CFG = {
  guest:   { label:"Guest",   bg:"bg-gray-100",   text:"text-gray-600" },
  regular: { label:"Regular", bg:"bg-blue-100",   text:"text-blue-700" },
  pro:     { label:"Pro ⭐",   bg:"bg-amber-100",  text:"text-amber-700" },
  admin:   { label:"Admin 👑", bg:"bg-indigo-100", text:"text-indigo-700" },
};

export async function loadUsers(filterStatus = "") {
  const tbody = document.getElementById("usr-tbody");
  const cnt   = document.getElementById("usr-count");
  if (!tbody) return;
  skeleton(tbody, 7, 5);

  try {
    const allSnap = await getDocs(collection(db, COL));
    let users = allSnap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    if (filterStatus) users = users.filter(u => u.status === filterStatus);
    users.sort((a,b) => (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));

    if (cnt) cnt.textContent = users.length;
    updateFilterCounts(users);

    if (!users.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-16 text-gray-400 text-sm">
        No users found${filterStatus?` (filter: ${filterStatus})`:""}.</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(u => {
      const s = STATUS_CFG[u.status] || STATUS_CFG.pending;
      const r = ROLE_CFG[u.role]     || ROLE_CFG.regular;
      const initials = (u.displayName||u.email||"U").split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
      const joined   = u.createdAt?.seconds ? new Date(u.createdAt.seconds*1000).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "—";
      const isProActive = u.role==="pro" && u.proExpiresAt?.seconds > Date.now()/1000;
      const savedCount  = (u.savedPrompts||[]).length;

      return `
      <tr class="border-b border-gray-100 hover:bg-gray-50 transition group">
        <td class="px-4 py-3">
          <div class="flex items-center gap-3">
            ${u.avatarUrl
              ? `<img src="${esc(u.avatarUrl)}" class="w-10 h-10 rounded-full object-cover ring-2 ring-gray-200 shrink-0" onerror="this.src='https://placehold.co/40x40/4f46e5/fff?text=${initials}'" loading="lazy"/>`
              : `<div class="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style="background:linear-gradient(135deg,#4f46e5,#7c3aed)">${initials}</div>`}
            <div class="min-w-0">
              <p class="font-semibold text-gray-900 text-sm truncate max-w-[150px]">${esc(u.displayName||"No name")}</p>
              <p class="text-xs text-gray-400 truncate max-w-[150px]">${esc(u.email||"—")}</p>
            </div>
          </div>
        </td>
        <td class="px-4 py-3">
          <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text} flex items-center gap-1 w-fit">
            <span class="w-1.5 h-1.5 rounded-full" style="background:${s.dot}"></span>${s.label}
          </span>
        </td>
        <td class="px-4 py-3">
          <div>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold ${r.bg} ${r.text}">${r.label}</span>
            ${isProActive ? `<p class="text-[10px] text-amber-500 mt-0.5">Expires: ${new Date(u.proExpiresAt.seconds*1000).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}</p>` : ""}
          </div>
        </td>
        <td class="px-4 py-3 hidden sm:table-cell">
          <div class="flex items-center gap-1.5">
            <span class="text-sm font-bold text-amber-600">${u.coins||0}</span>
            <span class="text-xs text-gray-400">🪙</span>
          </div>
        </td>
        <td class="px-4 py-3 hidden md:table-cell text-sm text-gray-500">${joined}</td>
        <td class="px-4 py-3 hidden sm:table-cell">
          <span class="text-sm font-semibold text-gray-700">${savedCount}</span>
          <span class="text-xs text-gray-400 ml-1">saved</span>
        </td>
        <td class="px-4 py-3">
          <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onclick="pvViewUser('${u._docId}')" title="View" class="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600 transition">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
            </button>
            ${u.status==="pending"
              ? `<button onclick="pvApproveUser('${u._docId}')" title="Approve" class="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg></button>` : ""}
            ${u.status!=="banned"
              ? `<button onclick="pvBanUser('${u._docId}','${esc(u.email||u.displayName||"").replace(/'/g,"\\'")}' )" title="Ban" class="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg></button>`
              : `<button onclick="pvUnbanUser('${u._docId}')" title="Unban" class="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></button>`}
            <button onclick="pvDeleteUser('${u._docId}','${esc(u.email||u.displayName||"").replace(/'/g,"\\'")}' )" title="Delete" class="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
          </div>
        </td>
      </tr>`;
    }).join("");
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-12 text-red-500 text-sm p-4">${e.message}</td></tr>`;
  }
}

function updateFilterCounts(users) {
  const counts = { total:users.length, pending:0, active:0, banned:0 };
  users.forEach(u => { if(counts[u.status]!==undefined) counts[u.status]++; });
  const map = { total:"fc-all", pending:"fc-pending", active:"fc-active", banned:"fc-banned" };
  Object.entries(map).forEach(([k,id]) => { const el=document.getElementById(id); if(el) el.textContent=counts[k]||0; });
  const badge = document.getElementById("users-pending-badge");
  if (badge) { badge.textContent=counts.pending; badge.style.display=counts.pending>0?"flex":"none"; }
}

export async function viewUser(id) {
  try {
    const snap = await getDoc(doc(db, COL, id));
    if (!snap.exists()) { toast("Not found","error"); return; }
    const u = snap.data();
    const s = STATUS_CFG[u.status]||STATUS_CFG.pending;
    const r = ROLE_CFG[u.role]||ROLE_CFG.regular;
    const initials = (u.displayName||u.email||"U").split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
    const joined = u.createdAt?.seconds ? new Date(u.createdAt.seconds*1000).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—";

    const body = document.getElementById("view-user-body");
    if (!body) return;

    body.innerHTML = `
    <div class="text-center pb-5 border-b border-gray-100 mb-5">
      ${u.avatarUrl
        ? `<img src="${esc(u.avatarUrl)}" class="w-20 h-20 rounded-full object-cover ring-4 ring-indigo-100 mx-auto mb-3" onerror="this.style.display='none'"/>`
        : `<div class="w-20 h-20 rounded-full mx-auto mb-3 flex items-center justify-center text-white text-2xl font-bold" style="background:linear-gradient(135deg,#4f46e5,#7c3aed)">${initials}</div>`}
      <h3 class="text-xl font-bold text-gray-900">${esc(u.displayName||"No name")}</h3>
      <p class="text-sm text-gray-400 mt-0.5">${esc(u.email||"—")}</p>
      <div class="flex items-center justify-center gap-2 mt-3 flex-wrap">
        <span class="px-3 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}">${s.label}</span>
        <span class="px-3 py-1 rounded-full text-xs font-semibold ${r.bg} ${r.text}">${r.label}</span>
        <span class="px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">${u.coins||0} 🪙</span>
      </div>
    </div>
    <div class="grid grid-cols-3 gap-3 mb-5">
      <div class="bg-gray-50 rounded-xl p-3 text-center">
        <p class="text-xl font-bold text-gray-900">${(u.savedPrompts||[]).length}</p>
        <p class="text-[11px] text-gray-400 mt-0.5">Saved</p>
      </div>
      <div class="bg-gray-50 rounded-xl p-3 text-center">
        <p class="text-xl font-bold text-gray-900">${u.coins||0}</p>
        <p class="text-[11px] text-gray-400 mt-0.5">Coins</p>
      </div>
      <div class="bg-gray-50 rounded-xl p-3 text-center">
        <p class="text-[11px] font-bold text-gray-900 mt-2">${joined}</p>
        <p class="text-[11px] text-gray-400 mt-0.5">Joined</p>
      </div>
    </div>
    <div class="space-y-2.5 mb-5">
      <div class="flex items-center justify-between py-2 border-b border-gray-100">
        <span class="text-sm text-gray-500">User ID</span>
        <code class="text-xs bg-gray-100 px-2 py-0.5 rounded max-w-[180px] truncate block">${esc(id)}</code>
      </div>
      <div class="flex items-center justify-between py-2 border-b border-gray-100">
        <span class="text-sm text-gray-500">Referral Code</span>
        <code class="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">${esc(u.referralCode||"none")}</code>
      </div>
      <div class="flex items-center justify-between py-2 border-b border-gray-100">
        <span class="text-sm text-gray-500">Pro Expires</span>
        <span class="text-sm text-gray-700">${u.proExpiresAt?.seconds ? new Date(u.proExpiresAt.seconds*1000).toLocaleDateString() : "Not pro"}</span>
      </div>
    </div>
    <!-- Role change -->
    <div class="mb-4">
      <label class="lbl text-xs">Change Role</label>
      <select id="role-select" class="inp text-sm">
        ${["guest","regular","pro","admin"].map(r=>`<option value="${r}" ${u.role===r?"selected":""}>${ROLE_CFG[r]?.label||r}</option>`).join("")}
      </select>
    </div>
    <div class="flex flex-wrap gap-2">
      <button onclick="pvSetRole('${id}',document.getElementById('role-select').value)" class="btn-pr btn-sm flex-1 justify-center">Save Role</button>
      ${u.status==="pending" ? `<button onclick="pvApproveUser('${id}');pvCloseViewModal()" class="btn-sec btn-sm flex-1 justify-center text-green-600 border-green-300">✓ Approve</button>` : ""}
      ${u.status!=="banned"
        ? `<button onclick="pvBanUser('${id}','${esc(u.email||"").replace(/'/g,"\\'")}');pvCloseViewModal()" class="btn-sec btn-sm flex-1 justify-center text-amber-600 border-amber-200">🚫 Ban</button>`
        : `<button onclick="pvUnbanUser('${id}');pvCloseViewModal()" class="btn-sec btn-sm flex-1 justify-center text-green-600 border-green-200">✓ Unban</button>`}
      <button onclick="pvDeleteUser('${id}','${esc(u.email||u.displayName||"").replace(/'/g,"\\'")}');pvCloseViewModal()" class="btn-sec btn-sm flex-1 justify-center text-red-500 border-red-200">🗑 Delete</button>
    </div>`;

    openModal("modal-view-user");
  } catch(e) { toast("Error: "+e.message,"error"); }
}

export async function approveUser(id) {
  try {
    await updateDoc(doc(db,COL,id), { status:"active", role: "regular", approvedAt:serverTimestamp(), updatedAt:serverTimestamp() });
    toast("User approved ✓");
    await loadUsers(currentFilter());
  } catch(e) { toast("Failed: "+e.message,"error"); }
}

export function banUser(id, identifier) {
  confirm(`Ban <strong>${esc(identifier)}</strong>?`, async () => {
    await updateDoc(doc(db,COL,id), { status:"banned", bannedAt:serverTimestamp(), updatedAt:serverTimestamp() });
    toast("User banned"); await loadUsers(currentFilter());
  });
}

export async function unbanUser(id) {
  await updateDoc(doc(db,COL,id), { status:"active", bannedAt:null, updatedAt:serverTimestamp() });
  toast("User unbanned ✓"); await loadUsers(currentFilter());
}

export function deleteUser(id, identifier) {
  confirm(`Permanently delete <strong>${esc(identifier)}</strong>?`, async () => {
    await deleteDoc(doc(db,COL,id));
    toast("User deleted"); await loadUsers(currentFilter());
  });
}

export async function setRole(id, role) {
  await updateDoc(doc(db,COL,id), { role, updatedAt:serverTimestamp() });
  toast(`Role set to ${role} ✓`); await loadUsers(currentFilter());
}

export async function getUserStats() {
  try {
    const snap = await getDocs(collection(db,COL));
    const users = snap.docs.map(d=>d.data());
    return {
      total:   users.length,
      active:  users.filter(u=>u.status==="active").length,
      pending: users.filter(u=>u.status==="pending").length,
      banned:  users.filter(u=>u.status==="banned").length,
      pro:     users.filter(u=>u.role==="pro").length
    };
  } catch(e) { return { total:0,active:0,pending:0,banned:0,pro:0 }; }
}

function currentFilter() {
  return document.querySelector(".usr-filter-btn.active")?.dataset.status||"";
}

window.pvViewUser     = viewUser;
window.pvApproveUser  = approveUser;
window.pvBanUser      = banUser;
window.pvUnbanUser    = unbanUser;
window.pvDeleteUser   = deleteUser;
window.pvSetRole      = setRole;
window.pvCloseViewModal = () => closeModal("modal-view-user");
