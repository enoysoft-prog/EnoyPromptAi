// admin/js/submissions.js — Review user submitted prompts
import { db } from "./firebase.js";
import { toast, confirm, openModal, closeModal, btnLoad, skeleton, esc } from "./ui.js";
import {
  collection, getDocs, getDoc, doc, updateDoc, deleteDoc,
  query, orderBy, where, serverTimestamp, addDoc, increment
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

export async function loadSubmissions(filterStatus = "pending") {
  const tbody = document.getElementById("sub-tbody");
  const cnt   = document.getElementById("sub-count");
  if (!tbody) return;
  skeleton(tbody, 6, 5);

  try {
    let snap;
    try {
      snap = filterStatus
        ? await getDocs(query(collection(db,"submissions"), where("status","==",filterStatus), orderBy("submittedAt","desc")))
        : await getDocs(query(collection(db,"submissions"), orderBy("submittedAt","desc")));
    } catch {
      snap = await getDocs(collection(db,"submissions"));
    }

    let subs = snap.docs.map(d => ({ _id:d.id, ...d.data() }));
    if (filterStatus) subs = subs.filter(s => s.status === filterStatus);
    subs.sort((a,b) => (b.submittedAt?.seconds||0) - (a.submittedAt?.seconds||0));

    if (cnt) cnt.textContent = subs.length;

    if (!subs.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-16 text-gray-400 text-sm">No submissions found.</td></tr>`;
      return;
    }
    tbody.innerHTML = subs.map(s => renderSubRow(s)).join("");
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-12 text-red-500 text-sm p-4">${e.message}</td></tr>`;
  }
}

function renderSubRow(s) {
  const statusMap = {
    pending:  "bg-amber-100 text-amber-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };
  const date = s.submittedAt?.seconds
    ? new Date(s.submittedAt.seconds*1000).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})
    : "—";

  return `
  <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors" data-sid="${esc(s._id)}">
    <td class="px-4 py-3">
      <div class="font-semibold text-gray-900 text-sm max-w-xs truncate">${esc(s.title||"Untitled")}</div>
      <div class="text-xs text-gray-400 mt-0.5">${esc(s.tool||"")} · ${esc(s.categoryId||"")}</div>
    </td>
    <td class="px-4 py-3 text-xs text-gray-600 max-w-xs">
      <div class="truncate max-w-[200px]">${esc((s.content||"").slice(0,100))}…</div>
    </td>
    <td class="px-4 py-3 text-xs text-gray-500">${esc(s.submitterName||s.submittedBy||"—")}</td>
    <td class="px-4 py-3 text-xs text-gray-400">${date}</td>
    <td class="px-4 py-3">
      <span class="px-2.5 py-1 rounded-full text-xs font-semibold ${statusMap[s.status]||statusMap.pending}">${s.status||"pending"}</span>
    </td>
    <td class="px-4 py-3">
      <div class="flex gap-1.5">
        <button onclick="viewSubmission('${esc(s._id)}')"
          class="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200">View</button>
        ${s.status === "pending" ? `
        <button onclick="approveSubmission('${esc(s._id)}')"
          class="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-200">Approve</button>
        <button onclick="rejectSubmission('${esc(s._id)}')"
          class="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-200">Reject</button>
        ` : ""}
      </div>
    </td>
  </tr>`;
}

window.viewSubmission = async function(sid) {
  const snap = await getDoc(doc(db,"submissions",sid));
  if (!snap.exists()) { toast("Not found","error"); return; }
  const s = snap.data();
  document.getElementById("view-sub-title").textContent   = s.title || "Untitled";
  document.getElementById("view-sub-tool").textContent    = s.tool || "—";
  document.getElementById("view-sub-tags").textContent    = (s.tags||[]).join(", ") || "—";
  document.getElementById("view-sub-content").textContent = s.content || "";
  document.getElementById("view-sub-desc").textContent    = s.description || "—";
  document.getElementById("view-sub-by").textContent      = s.submitterName || s.submittedBy || "—";
  document.getElementById("view-sub-modal").dataset.sid   = sid;
  document.getElementById("view-approve-btn").style.display = s.status === "pending" ? "" : "none";
  document.getElementById("view-reject-btn").style.display  = s.status === "pending" ? "" : "none";
  openModal("view-sub-modal");
};

window.approveSubmission = async function(sid) {
  const ok = await confirm("Approve this prompt? It will go live on the site and the author will receive coins.");
  if (!ok) return;

  try {
    // Get config for reward amount
    const cfgSnap = await getDoc(doc(db,"config","app"));
    const reward  = cfgSnap.exists() ? (cfgSnap.data().promptSubmissionReward || 20) : 20;

    // Get submission
    const subSnap = await getDoc(doc(db,"submissions",sid));
    if (!subSnap.exists()) { toast("Submission not found","error"); return; }
    const sub = subSnap.data();

    // Mark as approved
    await updateDoc(doc(db,"submissions",sid), { status:"approved", approvedAt: serverTimestamp() });

    // Create live prompt from submission
    await addDoc(collection(db,"prompts"), {
      title:       sub.title,
      content:     sub.content,
      description: sub.description || "",
      categoryId:  sub.categoryId  || "",
      tool:        sub.tool        || "",
      tags:        sub.tags        || [],
      isPremium:   false,
      isHot:       false,
      status:      "active",
      views:       0, copies:0, likes:0,
      submittedBy: sub.submittedBy || null,
      createdAt:   serverTimestamp()
    });

    // Award coins to submitter
    if (sub.submittedBy) {
      await updateDoc(doc(db,"users",sub.submittedBy), { coins: increment(reward) });
      await addDoc(collection(db,"coinTransactions"), {
        userId:      sub.submittedBy,
        amount:      reward,
        type:        "earn",
        description: `Prompt approved: "${sub.title}"`,
        createdAt:   serverTimestamp()
      });
    }

    toast(`Prompt approved & ${reward} coins sent to author ✓`);
    closeModal("view-sub-modal");
    loadSubmissions();
  } catch(e) { toast(e.message,"error"); }
};

window.rejectSubmission = async function(sid) {
  const ok = await confirm("Reject this submission?");
  if (!ok) return;
  try {
    await updateDoc(doc(db,"submissions",sid), { status:"rejected", rejectedAt: serverTimestamp() });
    toast("Submission rejected");
    closeModal("view-sub-modal");
    loadSubmissions();
  } catch(e) { toast(e.message,"error"); }
};
