// src/js/coins.js — Coin operations for the user-facing website
import { db, auth } from "./firebase.js";
import {
  doc, getDoc, updateDoc, addDoc, collection,
  serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// ── Get coin config from Firestore ─────────────────────────
let _coinConfig = null;
export async function getCoinConfig() {
  if (_coinConfig) return _coinConfig;
  try {
    const snap = await getDoc(doc(db,"config","coins"));
    _coinConfig = snap.exists() ? snap.data() : {};
    return _coinConfig;
  } catch(e) { return {}; }
}

// ── Spend coins (generic) ──────────────────────────────────
export async function spendCoins(uid, amount, description, type, refId = null) {
  const profileSnap = await getDoc(doc(db,"users",uid));
  if (!profileSnap.exists()) throw new Error("User not found");
  const balance = profileSnap.data().coins || 0;
  if (balance < amount) throw new Error(`Insufficient coins. You have ${balance} but need ${amount}.`);

  await updateDoc(doc(db,"users",uid), {
    coins:     increment(-amount),
    updatedAt: serverTimestamp()
  });
  await addDoc(collection(db,"coin_transactions"), {
    userId: uid, amount: -amount, description, type,
    referenceId: refId||null, createdAt: serverTimestamp()
  });
  return balance - amount;
}

// ── Unlock premium prompt with coins ──────────────────────
export async function unlockPromptWithCoins(uid, promptId, promptTitle) {
  const cfg  = await getCoinConfig();
  const cost = cfg.premiumUnlockCoins || 20;
  const newBalance = await spendCoins(uid, cost, `Unlocked premium prompt: ${promptTitle}`, "premium_unlock", promptId);
  // Mark as unlocked in user profile
  const profileSnap = await getDoc(doc(db,"users",uid));
  const unlocked = profileSnap.data().unlockedPrompts || [];
  if (!unlocked.includes(promptId)) {
    await updateDoc(doc(db,"users",uid), { unlockedPrompts: [...unlocked, promptId] });
  }
  return { newBalance, cost };
}

// ── Remove ads with coins ──────────────────────────────────
export async function removeAdsWithCoins(uid) {
  const cfg     = await getCoinConfig();
  const cost    = cfg.adRemovalCoins || 200;
  const days    = cfg.adRemovalDays  || 30;
  const expires = new Date(Date.now() + days * 86400000);

  const newBalance = await spendCoins(uid, cost, `Ad removal for ${days} days`, "ad_removal");
  await updateDoc(doc(db,"users",uid), { adsRemoved:true, adsRemovedUntil:expires, updatedAt:serverTimestamp() });
  return { newBalance, cost, expires, days };
}

// ── Upgrade to Pro with coins ──────────────────────────────
export async function upgradeToPro(uid, plan = "monthly") {
  const cfg    = await getCoinConfig();
  const cost   = plan === "yearly" ? (cfg.proYearlyCoins||4500) : (cfg.proMonthlyCoins||500);
  const days   = plan === "yearly" ? 365 : 30;
  const expires = new Date(Date.now() + days * 86400000);

  const newBalance = await spendCoins(uid, cost, `Pro upgrade (${plan})`, "pro_upgrade");
  await updateDoc(doc(db,"users",uid), {
    role:         "pro",
    proExpiresAt: expires,
    updatedAt:    serverTimestamp()
  });
  return { newBalance, cost, expires, days };
}

// ── Save / unsave prompt ───────────────────────────────────
export async function toggleSavePrompt(uid, promptId) {
  const snap = await getDoc(doc(db,"users",uid));
  if (!snap.exists()) throw new Error("Not logged in");
  const saved   = snap.data().savedPrompts || [];
  const isSaved = saved.includes(promptId);
  const updated = isSaved ? saved.filter(id=>id!==promptId) : [...saved, promptId];
  await updateDoc(doc(db,"users",uid), { savedPrompts:updated, updatedAt:serverTimestamp() });
  return !isSaved; // returns new "isSaved" state
}

// ── Check if prompt is unlocked ────────────────────────────
export async function isPromptUnlocked(uid, promptId) {
  if (!uid) return false;
  const snap = await getDoc(doc(db,"users",uid));
  if (!snap.exists()) return false;
  const data = snap.data();
  // Pro users: all prompts unlocked
  if (data.role === "pro" || data.role === "admin") {
    if (data.proExpiresAt) {
      const exp = data.proExpiresAt?.seconds ? data.proExpiresAt.seconds*1000 : new Date(data.proExpiresAt).getTime();
      if (Date.now() < exp) return true;
    } else if (data.role === "admin") return true;
  }
  return (data.unlockedPrompts||[]).includes(promptId);
}

// ── Submit a prompt ────────────────────────────────────────
export async function submitPrompt(uid, userName, userEmail, data) {
  const cfg = await getCoinConfig();
  const ref = await addDoc(collection(db,"prompt_submissions"), {
    ...data,
    submittedBy:    uid,
    submitterName:  userName,
    submitterEmail: userEmail,
    status:         "pending",
    coinReward:     cfg.submissionApproved || 100,
    createdAt:      serverTimestamp(),
    updatedAt:      serverTimestamp()
  });
  return ref.id;
}

// ── Get user's coin transaction history ────────────────────
export async function getCoinHistory(uid, limitN = 20) {
  try {
    const { getDocs, query, where, orderBy, limit } =
      await import("https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js");
    let snap;
    try {
      snap = await getDocs(query(collection(db,"coin_transactions"),
        where("userId","==",uid), orderBy("createdAt","desc"), limit(limitN)));
    } catch(e) {
      snap = await getDocs(query(collection(db,"coin_transactions"),where("userId","==",uid)));
    }
    return snap.docs.map(d=>({id:d.id,...d.data()}))
      .sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))
      .slice(0,limitN);
  } catch(e) { return []; }
}
