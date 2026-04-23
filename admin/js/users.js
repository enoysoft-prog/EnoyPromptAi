// admin/js/users.js — Enhanced user management with coins & roles
import { db } from "./firebase.js";
import { toast, confirm, openModal, closeModal, btnLoad, skeleton, esc } from "./ui.js";
import {
  collection, getDocs, getDoc, doc, updateDoc,
  deleteDoc, query, orderBy, where, serverTimestamp,
  increment, addDoc
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const COL = "users";

const STATUS = {
  pending: { label:"Pending",  bg:"bg-amber-100",  text:"text-amber-700"  },
  active:  { label:"Active",   bg:"bg-green-100",  text:"text-green-700"  },
  banned:  { label:"Banned",   bg:"bg-red-100",    text:"text-red-700"    },
};

const ROLES = {
  guest:   { label:"Guest",   bg:"bg-gray-100",   text:"text-gray-600"   },
  regular: { label:"Regular", bg:"bg-blue-100",   text:"text-blue-700"   },
  pro:     { label:"Pro",     bg:"bg-amber-100",  text:"text-amber-700"  },
  admin:   { label:"Admin",   bg:"bg-indigo-100", text:"text-indigo-700" },
};

export async function loadUsers(filterStatus = "") {
  const tbody = document.getElementById("usr-tbody");
  const cnt   = document.getElementById("usr-count");
  if (!tbody) return;
  skeleton(tbody, 7, 6);

  try {
    let snap;
    try {
      snap = filterStatus
        ? await getDocs(query(collection(db,COL), where("status","==",filterStatus), orderBy("createdAt","desc")))
        : await getDocs(query(collection(db,COL), orderBy("createdAt","desc")));
    } catch {
      snap = await getDocs(collection(db,COL));
    }

    let users = snap.docs.map(d => ({ _docId:d.id, ...d.data() }));
    if (filterStatus) users = users.filter(u => u.status === filterStatus);
    users.sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));

    if (cnt) cnt.textContent = users.length;
    updateFilterCounts(users);

    if (!users.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-16 text-gray-400 text-sm">No users found.</td></tr>`;
      return;
    }
    tbody.innerHTML = users.map(u => renderUserRow(u)).join("");
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-12 text-red-500 text-sm p-4">${e.message}</td></tr>`;
  }
}

function updateFilterCounts(users) {
  const counts = { "": users.length, active: 0, pending: 0, banned: 0 };
  users.forEach(u => { if (counts[u.status] !== undefined) counts[u.status]++; });
  const map = { "": "all", active: "active", pending: "pending", banned: "banned" };
  Object.entries(counts).forEach(([s, n]) => {
    const el = document.getElementById(`usr-cnt-${map[s]}`);
    if (el) el.textContent = n;
  });
}

function renderUserRow(u) {
  const s     = STATUS[u.status]  || STATUS.pending;
  const r     = ROLES[u.role]    || ROLES.regular;
  const initials = (u.displayName||u.email||"U").split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
  const joined = u.createdAt?.seconds
    ? new Date(u.createdAt.seconds*1000).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})
    : "—";

  return `
  <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors" data-uid="${esc(u._docId)}">
    <td class="px-4 py-3">
      <div class="flex items-center gap-3">
        ${u.avatarUrl
          ? `<img src="${esc(u.avatarUrl)}" class="w-10 h-10 rounded-full object-cover ring-2 ring-gray-200" loading="lazy"/>`
          : `<div class="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style="background:linear-gradient(135deg,#4f46e5,#7c3aed)">${initials}</div>`}
        <div>
          <p class="font-semibold text-gray-900 text-sm">${esc(u.displayName||"No name")}</p>
          <p class="text-xs text-gray-400">${esc(u.email||"—")}</p>
        </div>
      </div>
    </td>
    <td class="px-4 py-3">
      <span class="px-2.5 py-1 rounded-full text-xs font-semibold ${r.bg} ${r.text}">${r.label}</span>
    </td>
    <td class="px-4 py-3 text-sm font-bold text-amber-600">🪙 ${u.coins || 0}</td>
    <td class="px-4 py-3">
      <span class="px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}">${s.label}</span>
    </td>
    <td class="px-4 py-3 text-xs text-gray-500">${joined}</td>
    <td class="px-4 py-3 text-xs text-gray-400">${(u.savedPrompts||[]).length} saved</td>
    <td class="px-4 py-3">
      <div class="flex gap-1.5 flex-wrap">
        <button onclick="editUser('${esc(u._docId)}')"
          class="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition">Edit</button>
        <button onclick="adjustCoins('${esc(u._docId)}','${esc(u.displayName||u.email||u._docId)}')"
          class="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-semibold hover:bg-amber-100 transition">Coins</button>
        <button onclick="deleteUser('${esc(u._docId)}')"
          class="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition">Delete</button>
      </div>
    </td>
  </tr>`;
}

window.editUser = async function(uid) {
  const snap = await getDoc(doc(db, COL, uid));
  if (!snap.exists()) { toast("User not found","error"); return; }
  const u = snap.data();
  document.getElementById("eu-name").value   = u.displayName || "";
  document.getElementById("eu-email").value  = u.email || "";
  document.getElementById("eu-role").value   = u.role || "regular";
  document.getElementById("eu-status").value = u.status || "active";
  document.getElementById("eu-coins").value  = u.coins || 0;
  document.getElementById("edit-user-modal").dataset.uid = uid;
  openModal("edit-user-modal");
};

window.saveUserEdit = async function() {
  const modal = document.getElementById("edit-user-modal");
  const uid   = modal.dataset.uid;
  const btn   = document.getElementById("eu-save-btn");
  btnLoad(btn, true, "Save Changes");
  try {
    const newRole = document.getElementById("eu-role").value;
    const update = {
      displayName: document.getElementById("eu-name").value.trim(),
      role:        newRole,
      status:      document.getElementById("eu-status").value,
      coins:       parseInt(document.getElementById("eu-coins").value) || 0,
      updatedAt:   serverTimestamp()
    };
    if (newRole === "pro") update.proSince = serverTimestamp();
    await updateDoc(doc(db, COL, uid), update);
    toast("User updated ✓");
    closeModal("edit-user-modal");
    loadUsers();
  } catch(e) { toast(e.message, "error"); }
  finally { btnLoad(btn, false, "Save Changes"); }
};

window.adjustCoins = function(uid, name) {
  document.getElementById("coins-user-name").textContent = name;
  document.getElementById("coins-amount").value = "";
  document.getElementById("coins-reason").value = "";
  document.getElementById("coins-op").value = "add";
  document.getElementById("coins-modal").dataset.uid = uid;
  openModal("coins-modal");
};

window.saveCoinsAdjust = async function() {
  const modal  = document.getElementById("coins-modal");
  const uid    = modal.dataset.uid;
  const amount = parseInt(document.getElementById("coins-amount").value) || 0;
  const reason = document.getElementById("coins-reason").value.trim() || "Admin adjustment";
  const op     = document.getElementById("coins-op").value;
  const btn    = document.getElementById("coins-save-btn");
  if (!amount || amount <= 0) { toast("Enter a valid amount","error"); return; }
  btnLoad(btn, true, "Saving…");
  try {
    const delta = op === "add" ? amount : -amount;
    await updateDoc(doc(db, COL, uid), { coins: increment(delta) });
    await addDoc(collection(db, "coinTransactions"), {
      userId: uid, amount: delta,
      type: op === "add" ? "earn" : "spend",
      description: `Admin: ${reason}`,
      createdAt: serverTimestamp()
    });
    toast(`Coins ${op === "add" ? "added" : "deducted"} ✓`);
    closeModal("coins-modal");
    loadUsers();
  } catch(e) { toast(e.message, "error"); }
  finally { btnLoad(btn, false, "Saving…"); }
};

window.deleteUser = async function(uid) {
  const ok = await confirm("Delete this user permanently? This cannot be undone.");
  if (!ok) return;
  try {
    await deleteDoc(doc(db, COL, uid));
    toast("User deleted");
    loadUsers();
  } catch(e) { toast(e.message, "error"); }
};
