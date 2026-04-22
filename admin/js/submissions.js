// admin/js/submissions.js — Prompt submission review system
import { db } from "./firebase.js";
import { toast, confirm, openModal, closeModal, btnLoad, skeleton, esc, trunc } from "./ui.js";
import {
  collection, getDocs, getDoc, doc, updateDoc,
  query, orderBy, where, serverTimestamp, limit
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const COL = "prompt_submissions";

export async function loadSubmissions(filterStatus = "pending") {
  const tbody = document.getElementById("sub-tbody");
  const cnt   = document.getElementById("sub-count");
  if (!tbody) return;
  skeleton(tbody, 6, 5);

  try {
    let snap;
    try {
      snap = await getDocs(query(collection(db, COL), where("status","==",filterStatus), orderBy("createdAt","desc")));
    } catch (e) {
      const all = await getDocs(collection(db, COL));
      snap = { docs: all.docs.filter(d => d.data().status === filterStatus) };
    }

    const items = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    if (cnt) cnt.textContent = items.length;
    updateSubBadge();

    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-16 text-gray-400 text-sm">
        No ${filterStatus} submissions.</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(s => {
      const submitted = s.createdAt?.seconds
        ? new Date(s.createdAt.seconds*1000).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})
        : "—";
      const statusCfg = {
        pending:  { bg:"bg-amber-100",text:"text-amber-700",  label:"Pending" },
        approved: { bg:"bg-green-100",text:"text-green-700",  label:"Approved" },
        rejected: { bg:"bg-red-100",  text:"text-red-700",    label:"Rejected" }
      }[s.status] || { bg:"bg-gray-100",text:"text-gray-600",label:s.status };

      return `
      <tr class="border-b border-gray-100 hover:bg-gray-50 transition group">
        <td class="px-4 py-3">
          <div>
            <p class="font-semibold text-gray-900 text-sm">${esc(s.title||"Untitled")}</p>
            <p class="text-xs text-gray-400 mt-0.5">${esc(s.categoryName||s.category||"—")} · ${esc(s.tool||"—")}</p>
          </div>
        </td>
        <td class="px-4 py-3">
          <div>
            <p class="text-sm text-gray-700">${esc(s.submitterName||"Unknown")}</p>
            <p class="text-xs text-gray-400">${esc(s.submitterEmail||"—")}</p>
          </div>
        </td>
        <td class="px-4 py-3 hidden md:table-cell">
          <p class="text-xs text-gray-600 max-w-[200px] truncate" title="${esc(s.description||"")}">${trunc(s.description,60)}</p>
        </td>
        <td class="px-4 py-3">
          <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusCfg.bg} ${statusCfg.text}">${statusCfg.label}</span>
          ${s.coinsAwarded ? `<p class="text-xs text-amber-600 mt-0.5">+${s.coinsAwarded} coins awarded</p>` : ""}
        </td>
        <td class="px-4 py-3 hidden sm:table-cell text-sm text-gray-500">${submitted}</td>
        <td class="px-4 py-3">
          <div class="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onclick="pvViewSub('${s._id}')" title="Review"
              class="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600 transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
            </button>
            ${s.status === "pending" ? `
            <button onclick="pvApproveSub('${s._id}')" title="Approve"
              class="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
            </button>
            <button onclick="pvRejectSub('${s._id}','${esc(s.title||"").replace(/'/g,"\\'")}' )" title="Reject"
              class="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>` : ""}
          </div>
        </td>
      </tr>`;
    }).join("");
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-12 text-red-500 text-sm p-4">${e.message}</td></tr>`;
  }
}

export async function viewSubmission(id) {
  try {
    const snap = await getDoc(doc(db, COL, id));
    if (!snap.exists()) { toast("Not found","error"); return; }
    const s = snap.data();
    const body = document.getElementById("sub-review-body");
    if (!body) return;

    body.innerHTML = `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <div><label class="text-xs text-gray-400 font-semibold uppercase tracking-wider">Title</label>
          <p class="font-semibold text-gray-900 mt-1">${esc(s.title)}</p></div>
        <div><label class="text-xs text-gray-400 font-semibold uppercase tracking-wider">Tool</label>
          <p class="font-semibold text-gray-900 mt-1">${esc(s.tool||"—")}</p></div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="text-xs text-gray-400 font-semibold uppercase tracking-wider">Category</label>
          <p class="text-gray-700 mt-1">${esc(s.categoryName||s.category||"—")}${s.subcategoryName?` › ${esc(s.subcategoryName)}`:""}</p></div>
        <div><label class="text-xs text-gray-400 font-semibold uppercase tracking-wider">Submitted by</label>
          <p class="text-gray-700 mt-1">${esc(s.submitterName||"—")} <span class="text-xs text-gray-400">${esc(s.submitterEmail||"")}</span></p></div>
      </div>
      ${s.description?`<div><label class="text-xs text-gray-400 font-semibold uppercase tracking-wider">Description</label>
        <p class="text-gray-700 mt-1 text-sm leading-relaxed">${esc(s.description)}</p></div>`:""}
      <div>
        <label class="text-xs text-gray-400 font-semibold uppercase tracking-wider">Full Prompt Text</label>
        <div class="mt-1 bg-gray-50 border border-gray-200 rounded-xl p-4 font-mono text-sm text-gray-700 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">${esc(s.fullText||"")}</div>
      </div>
      ${s.tags?.length?`<div><label class="text-xs text-gray-400 font-semibold uppercase tracking-wider">Tags</label>
        <div class="flex flex-wrap gap-1.5 mt-1">${s.tags.map(t=>`<span class="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">#${esc(t)}</span>`).join("")}</div></div>`:""}
      ${s.imageUrl?`<div><label class="text-xs text-gray-400 font-semibold uppercase tracking-wider">Image</label>
        <img src="${esc(s.imageUrl)}" class="mt-1 w-full max-h-40 object-contain rounded-xl border border-gray-200 bg-gray-50"/></div>`:""}
      <div>
        <label class="text-xs text-gray-400 font-semibold uppercase tracking-wider">Coin Reward on Approval</label>
        <input id="sub-coin-reward" type="number" min="0" value="${s.coinReward||100}"
          class="inp mt-1" placeholder="100"/>
        <p class="text-xs text-gray-400 mt-1">Coins awarded to the submitter when approved</p>
      </div>
      ${s.rejectionReason?`<div class="bg-red-50 border border-red-200 rounded-xl p-3">
        <p class="text-xs font-semibold text-red-600 mb-1">Rejection reason</p>
        <p class="text-sm text-red-700">${esc(s.rejectionReason)}</p></div>`:""}
    </div>
    <div id="sub-reject-reason-wrap" class="hidden mt-4">
      <label class="lbl">Rejection Reason (shown to user)</label>
      <textarea id="sub-reject-reason" class="inp" rows="2" placeholder="e.g. Content does not meet quality guidelines"></textarea>
    </div>
    <div class="flex gap-2 mt-5 flex-wrap">
      ${s.status==="pending"?`
      <button id="btn-approve-sub" onclick="pvApproveSub('${id}')" class="btn-pr flex-1 justify-center">✓ Approve & Award Coins</button>
      <button onclick="toggleRejectReason()" class="btn-sec flex-1 justify-center text-red-500">✗ Reject</button>
      <button id="btn-reject-confirm" class="hidden btn-sec justify-center text-red-600 border-red-300 w-full" onclick="pvRejectSubWithReason('${id}')">Confirm Rejection</button>
      `:`<p class="text-sm text-gray-500 w-full text-center py-2">This submission has already been ${s.status}.</p>`}
    </div>`;

    window.toggleRejectReason = () => {
      const w = document.getElementById("sub-reject-reason-wrap");
      const b = document.getElementById("btn-reject-confirm");
      w.classList.toggle("hidden"); b.classList.toggle("hidden");
    };

    openModal("modal-sub-review");
  } catch(e) { toast("Error: "+e.message,"error"); }
}

export async function approveSubmission(id) {
  const coinInput = document.getElementById("sub-coin-reward");
  const coins = coinInput ? parseInt(coinInput.value)||100 : 100;
  const btn   = document.getElementById("btn-approve-sub");
  if (btn) btnLoad(btn, true, "✓ Approve & Award Coins");

  try {
    const snap = await getDoc(doc(db, COL, id));
    if (!snap.exists()) throw new Error("Submission not found");
    const s = snap.data();

    // 1. Update submission status
    await updateDoc(doc(db, COL, id), {
      status:       "approved",
      coinsAwarded: coins,
      reviewedAt:   serverTimestamp(),
      updatedAt:    serverTimestamp()
    });

    // 2. Add prompt to main prompts collection
    const { addDoc, collection: col2 } = await import("https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js");
    await addDoc(col2(db, "prompts"), {
      title:         s.title,
      category:      s.category||"",
      categoryId:    s.categoryId||"",
      categoryName:  s.categoryName||"",
      subcategoryId: s.subcategoryId||"",
      subcategoryName:s.subcategoryName||"",
      tool:          s.tool||"",
      description:   s.description||"",
      fullText:      s.fullText||"",
      tags:          s.tags||[],
      imageUrl:      s.imageUrl||"",
      isPremium:     false,
      isHot:         false,
      dateAdded:     new Date().toISOString().split("T")[0],
      submittedBy:   s.submittedBy||"",
      createdAt:     serverTimestamp(),
      updatedAt:     serverTimestamp()
    });

    // 3. Award coins to submitter
    if (s.submittedBy && coins > 0) {
      await awardCoins(s.submittedBy, coins, `Prompt submission approved: ${s.title}`, "submission_approved", id);
    }

    toast(`Approved ✓ · ${coins} coins awarded to submitter`);
    closeModal("modal-sub-review");
    await loadSubmissions("pending");
  } catch(err) {
    toast("Failed: "+err.message,"error");
  } finally {
    if (btn) btnLoad(btn, false, "✓ Approve & Award Coins");
  }
}

export async function rejectSubmission(id, title) {
  confirm(`Reject submission "<strong>${esc(title)}</strong>"?`, async () => {
    await updateDoc(doc(db, COL, id), {
      status:     "rejected",
      reviewedAt: serverTimestamp(),
      updatedAt:  serverTimestamp()
    });
    toast("Submission rejected");
    await loadSubmissions("pending");
  });
}

export async function rejectWithReason(id) {
  const reason = document.getElementById("sub-reject-reason")?.value.trim();
  try {
    await updateDoc(doc(db, COL, id), {
      status:          "rejected",
      rejectionReason: reason || "",
      reviewedAt:      serverTimestamp(),
      updatedAt:       serverTimestamp()
    });
    toast("Submission rejected");
    closeModal("modal-sub-review");
    await loadSubmissions("pending");
  } catch(e) { toast("Failed: "+e.message,"error"); }
}

// ── Award coins helper (used by submissions + admin coins page) ──
export async function awardCoins(userId, amount, description, type = "admin_grant", refId = null) {
  const { addDoc, collection: col2, increment, updateDoc: upd2, doc: d2 }
    = await import("https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js");

  // Add transaction record
  await addDoc(col2(db, "coin_transactions"), {
    userId, amount, description, type,
    referenceId: refId || null,
    createdAt: serverTimestamp()
  });

  // Update user coins balance
  try {
    await upd2(d2(db, "users", userId), {
      coins:     increment(amount),
      updatedAt: serverTimestamp()
    });
  } catch(e) { console.warn("Could not update user coins:", e.message); }
}

// ── Pending badge updater ──
export async function updateSubBadge() {
  try {
    const snap = await getDocs(query(collection(db, COL), where("status","==","pending")));
    const badge = document.getElementById("sub-pending-badge");
    if (badge) {
      badge.textContent  = snap.size;
      badge.style.display = snap.size > 0 ? "flex" : "none";
    }
    return snap.size;
  } catch(e) { return 0; }
}

window.pvViewSub          = viewSubmission;
window.pvApproveSub       = approveSubmission;
window.pvRejectSub        = rejectSubmission;
window.pvRejectSubWithReason = rejectWithReason;
