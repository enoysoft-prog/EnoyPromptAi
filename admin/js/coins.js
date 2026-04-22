// admin/js/coins.js — Coin & plan management
import { db } from "./firebase.js";
import { toast, btnLoad, skeleton, esc } from "./ui.js";
import {
  collection, getDocs, getDoc, doc, setDoc, addDoc,
  updateDoc, query, orderBy, limit, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const CFG_DOC = () => doc(db, "config", "coins");

const DEFAULTS = {
  // Earning
  referralReward:          50,
  submissionApproved:     100,
  dailyLoginBonus:          5,
  profileCompleteBonus:    30,
  // Spending
  proMonthlyCoins:        500,
  proYearlyCoins:        4500,
  premiumUnlockCoins:      20,
  adRemovalDays:           30,
  adRemovalCoins:         200,
  // Pro features description
  proFeatures: "No ads, all premium prompts unlocked, submit prompts, priority support"
};

// ── Load coin config ───────────────────────────────────────
export async function loadCoinConfig() {
  const loading = document.getElementById("coin-cfg-loading");
  const form    = document.getElementById("coin-cfg-form");
  if (loading) loading.classList.remove("hidden");
  if (form)    form.classList.add("hidden");
  try {
    const snap = await getDoc(CFG_DOC());
    const data = snap.exists() ? { ...DEFAULTS, ...snap.data() } : DEFAULTS;
    Object.entries(data).forEach(([k,v]) => {
      const el = document.getElementById("cc-"+k);
      if (el) el.value = v ?? "";
    });
    if (loading) loading.classList.add("hidden");
    if (form)    form.classList.remove("hidden");
  } catch(e) { toast("Load failed: "+e.message,"error"); }
}

export async function saveCoinConfig(e) {
  e?.preventDefault();
  const btn = document.getElementById("btn-save-coin-cfg");
  btnLoad(btn, true, "Save");
  try {
    const data = { updatedAt: serverTimestamp() };
    Object.keys(DEFAULTS).forEach(k => {
      const el = document.getElementById("cc-"+k);
      if (!el) return;
      data[k] = el.type === "number" ? parseFloat(el.value)||0 : el.value.trim();
    });
    await setDoc(CFG_DOC(), data, { merge: true });
    toast("Coin settings saved ✓");
  } catch(e) { toast("Save failed: "+e.message,"error"); }
  finally { btnLoad(btn, false, "Save Settings"); }
}

// ── Recent transactions ────────────────────────────────────
export async function loadTransactions() {
  const tbody = document.getElementById("tx-tbody");
  if (!tbody) return;
  skeleton(tbody, 5, 6);
  try {
    let snap;
    try { snap = await getDocs(query(collection(db,"coin_transactions"),orderBy("createdAt","desc"),limit(50))); }
    catch (e) { snap = await getDocs(collection(db,"coin_transactions")); }

    const txs = snap.docs.map(d=>({_id:d.id,...d.data()}))
      .sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))
      .slice(0,50);

    if (!txs.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-12 text-gray-400 text-sm">No transactions yet.</td></tr>`;
      return;
    }

    const typeConfig = {
      referral:            { label:"Referral",       color:"text-green-600",  bg:"bg-green-100" },
      submission_approved: { label:"Submission",     color:"text-green-600",  bg:"bg-green-100" },
      admin_grant:         { label:"Admin Grant",    color:"text-indigo-600", bg:"bg-indigo-100" },
      pro_upgrade:         { label:"Pro Upgrade",    color:"text-red-500",    bg:"bg-red-100" },
      premium_unlock:      { label:"Premium Unlock", color:"text-red-500",    bg:"bg-red-100" },
      ad_removal:          { label:"Ad Removal",     color:"text-red-500",    bg:"bg-red-100" },
      daily_login:         { label:"Daily Login",    color:"text-blue-600",   bg:"bg-blue-100" },
    };

    tbody.innerHTML = txs.map(tx => {
      const cfg = typeConfig[tx.type] || { label: tx.type||"other", color:"text-gray-600", bg:"bg-gray-100" };
      const sign = tx.amount >= 0 ? "+" : "";
      const dateStr = tx.createdAt?.seconds
        ? new Date(tx.createdAt.seconds*1000).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})
        : "—";
      return `
      <tr class="border-b border-gray-100 hover:bg-gray-50 transition">
        <td class="px-4 py-3 text-sm text-gray-700 truncate max-w-[160px]">${esc(tx.userId||"—")}</td>
        <td class="px-4 py-3">
          <span class="px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}">${cfg.label}</span>
        </td>
        <td class="px-4 py-3">
          <span class="text-sm font-bold ${tx.amount>=0?"text-green-600":"text-red-500"}">
            ${sign}${tx.amount} 🪙
          </span>
        </td>
        <td class="px-4 py-3 text-sm text-gray-500 hidden md:table-cell truncate max-w-[200px]">${esc(tx.description||"—")}</td>
        <td class="px-4 py-3 text-xs text-gray-400 hidden sm:table-cell whitespace-nowrap">${dateStr}</td>
      </tr>`;
    }).join("");
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-12 text-red-500 text-sm">${e.message}</td></tr>`;
  }
}

// ── Admin manual coin award ────────────────────────────────
export async function manualAwardCoins(e) {
  e?.preventDefault();
  const btn    = document.getElementById("btn-award-coins");
  const userId = document.getElementById("award-user-id")?.value.trim();
  const amount = parseInt(document.getElementById("award-amount")?.value||"0");
  const desc   = document.getElementById("award-desc")?.value.trim() || "Admin grant";
  if (!userId) { toast("User ID required","error"); return; }
  if (!amount) { toast("Amount required","error"); return; }

  btnLoad(btn, true, "Award");
  try {
    const { addDoc: ad2, increment, updateDoc: upd2, doc: d2, collection: c2 }
      = await import("https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js");

    await ad2(c2(db,"coin_transactions"), {
      userId, amount, description: desc, type: "admin_grant",
      createdAt: serverTimestamp()
    });
    await upd2(d2(db,"users",userId), { coins: increment(amount), updatedAt: serverTimestamp() });
    toast(`${amount > 0 ? "Awarded" : "Deducted"} ${Math.abs(amount)} coins ✓`);
    document.getElementById("award-user-id").value = "";
    document.getElementById("award-amount").value  = "";
    document.getElementById("award-desc").value    = "";
    await loadTransactions();
  } catch(err) { toast("Failed: "+err.message,"error"); }
  finally { btnLoad(btn, false, "Award Coins"); }
}

// ── Referral stats ─────────────────────────────────────────
export async function loadReferralStats() {
  const el = document.getElementById("referral-stats");
  if (!el) return;
  try {
    let snap;
    try { snap = await getDocs(query(collection(db,"referrals"),orderBy("createdAt","desc"),limit(30))); }
    catch (e) { snap = await getDocs(collection(db,"referrals")); }

    const refs = snap.docs.map(d=>({_id:d.id,...d.data()}))
      .sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    const total    = refs.length;
    const rewarded = refs.filter(r=>r.coinsAwarded>0).length;
    const totalCoins = refs.reduce((s,r)=>s+(r.coinsAwarded||0),0);

    el.innerHTML = `
    <div class="grid grid-cols-3 gap-3 mb-5">
      <div class="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-center">
        <p class="text-2xl font-bold text-indigo-700">${total}</p>
        <p class="text-xs text-indigo-500 mt-0.5">Total Referrals</p>
      </div>
      <div class="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
        <p class="text-2xl font-bold text-green-700">${rewarded}</p>
        <p class="text-xs text-green-500 mt-0.5">Rewarded</p>
      </div>
      <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
        <p class="text-2xl font-bold text-amber-700">${totalCoins}</p>
        <p class="text-xs text-amber-500 mt-0.5">Coins Distributed</p>
      </div>
    </div>
    <div class="space-y-2 max-h-56 overflow-y-auto">
      ${refs.slice(0,15).map(r=>`
      <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
        <div class="min-w-0 flex-1">
          <p class="font-medium text-gray-900 truncate">Referrer: <span class="font-mono text-xs">${esc(r.referrerId||"—")}</span></p>
          <p class="text-xs text-gray-400">Referred: <span class="font-mono">${esc(r.referredUserId||"—")}</span></p>
        </div>
        <span class="text-xs font-bold text-amber-600 ml-2">+${r.coinsAwarded||0} 🪙</span>
      </div>`).join("")}
      ${!refs.length?`<p class="text-center text-gray-400 text-sm py-6">No referrals yet.</p>`:""}
    </div>`;
  } catch(e) { el.innerHTML = `<p class="text-red-500 text-sm">${e.message}</p>`; }
}
