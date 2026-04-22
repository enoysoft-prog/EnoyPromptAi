// js/auth.js — Authentication, user creation, referral, role management
import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, GoogleAuthProvider,
  signInWithPopup, updateProfile, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp,
  collection, query, where, getDocs, increment, addDoc
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const COL = "users";
const googleProvider = new GoogleAuthProvider();

// ── Generate unique referral code ─────────────────────────
function genReferralCode(uid) {
  return uid.slice(0, 6).toUpperCase() + Math.random().toString(36).slice(2,5).toUpperCase();
}

// ── Get config values ─────────────────────────────────────
export async function getCoinConfig() {
  try {
    const snap = await getDoc(doc(db, "config", "app"));
    const d = snap.exists() ? snap.data() : {};
    return {
      referralReward:       d.referralCoinReward       ?? 10,
      proMembershipCost:    d.proMembershipCost         ?? 100,
      promptSubmitReward:   d.promptSubmissionReward    ?? 20,
      adsRemoveCost:        d.adsRemoveCost             ?? 50,
    };
  } catch { return { referralReward:10, proMembershipCost:100, promptSubmitReward:20, adsRemoveCost:50 }; }
}

// ── Create user profile in Firestore ─────────────────────
async function createUserProfile(user, extraData = {}) {
  const ref = doc(db, COL, user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    // Update last login
    await updateDoc(ref, { lastLoginAt: serverTimestamp() });
    return snap.data();
  }
  const profile = {
    uid:          user.uid,
    email:        user.email || "",
    displayName:  user.displayName || extraData.displayName || "",
    avatarUrl:    user.photoURL || "",
    role:         "regular",          // guest | regular | pro
    coins:        0,
    status:       "active",
    referralCode: genReferralCode(user.uid),
    referredBy:   extraData.referredBy || null,
    savedPrompts: [],
    adsRemoved:   false,
    createdAt:    serverTimestamp(),
    lastLoginAt:  serverTimestamp(),
  };
  await setDoc(ref, profile);

  // Process referral reward if user was referred
  if (extraData.referredBy) {
    await processReferralReward(extraData.referredBy, user.uid);
  }
  return profile;
}

// ── Process referral reward ───────────────────────────────
async function processReferralReward(referrerCode, newUserId) {
  try {
    // Find referrer by code
    const q = query(collection(db, COL), where("referralCode", "==", referrerCode));
    const snap = await getDocs(q);
    if (snap.empty) return;
    const referrer = snap.docs[0];
    const cfg = await getCoinConfig();
    const reward = cfg.referralReward;

    // Award coins to referrer
    await updateDoc(doc(db, COL, referrer.id), { coins: increment(reward) });

    // Log referral
    await addDoc(collection(db, "referrals"), {
      referrerId:   referrer.id,
      referredId:   newUserId,
      referrerCode: referrerCode,
      coinsAwarded: reward,
      createdAt:    serverTimestamp()
    });

    // Coin transaction log
    await addDoc(collection(db, "coinTransactions"), {
      userId:      referrer.id,
      amount:      reward,
      type:        "earn",
      description: "Referral bonus — new user joined",
      createdAt:   serverTimestamp()
    });
  } catch (e) { console.warn("Referral processing error:", e); }
}

// ── Register with email ───────────────────────────────────
export async function registerWithEmail(email, password, displayName, referralCode = "") {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  await createUserProfile(cred.user, { displayName, referredBy: referralCode || null });
  return cred.user;
}

// ── Login with email ──────────────────────────────────────
export async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  await createUserProfile(cred.user); // creates if not exists, else updates lastLogin
  return cred.user;
}

// ── Login with Google ─────────────────────────────────────
export async function loginWithGoogle(referralCode = "") {
  const cred = await signInWithPopup(auth, googleProvider);
  await createUserProfile(cred.user, { referredBy: referralCode || null });
  return cred.user;
}

// ── Reset password ────────────────────────────────────────
export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

// ── Sign out ──────────────────────────────────────────────
export async function logout() {
  await signOut(auth);
  window.location.href = "/";
}

// ── Get current user profile ──────────────────────────────
export async function getCurrentUserProfile() {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    const snap = await getDoc(doc(db, COL, user.uid));
    return snap.exists() ? { uid: user.uid, ...snap.data() } : null;
  } catch { return null; }
}

// ── Auth state observer with profile ─────────────────────
export function onAuthReady(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const profile = await getCurrentUserProfile();
      callback(user, profile);
    } else {
      callback(null, null);
    }
  });
}

// ── Upgrade to Pro using coins ────────────────────────────
export async function upgradeToPro(uid) {
  const cfg = await getCoinConfig();
  const ref  = doc(db, COL, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("User not found");
  const user = snap.data();
  if (user.role === "pro") throw new Error("Already a Pro member");
  if (user.coins < cfg.proMembershipCost) throw new Error(`Not enough coins. Need ${cfg.proMembershipCost}, have ${user.coins}`);

  await updateDoc(ref, {
    role:   "pro",
    coins:  increment(-cfg.proMembershipCost),
    proSince: serverTimestamp()
  });

  await addDoc(collection(db, "coinTransactions"), {
    userId:      uid,
    amount:      -cfg.proMembershipCost,
    type:        "spend",
    description: "Pro membership upgrade",
    createdAt:   serverTimestamp()
  });
}

// ── Remove ads using coins ────────────────────────────────
export async function removeAdsWithCoins(uid) {
  const cfg = await getCoinConfig();
  const ref  = doc(db, COL, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("User not found");
  const user = snap.data();
  if (user.adsRemoved) throw new Error("Ads already removed");
  if (user.coins < cfg.adsRemoveCost) throw new Error(`Need ${cfg.adsRemoveCost} coins`);

  await updateDoc(ref, {
    adsRemoved: true,
    coins:      increment(-cfg.adsRemoveCost)
  });
  await addDoc(collection(db, "coinTransactions"), {
    userId: uid, amount: -cfg.adsRemoveCost, type: "spend",
    description: "Removed ads", createdAt: serverTimestamp()
  });
}

// ── Save / unsave prompt ──────────────────────────────────
export async function toggleSavePrompt(uid, promptId) {
  const ref = doc(db, COL, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Not logged in");
  const saved = snap.data().savedPrompts || [];
  const isSaved = saved.includes(promptId);
  await updateDoc(ref, {
    savedPrompts: isSaved
      ? saved.filter(id => id !== promptId)
      : [...saved, promptId]
  });
  return !isSaved;
}

// ── Get user coin transactions ────────────────────────────
export async function getCoinHistory(uid, limitN = 20) {
  try {
    const snap = await getDocs(query(
      collection(db, "coinTransactions"),
      where("userId", "==", uid)
    ));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0))
      .slice(0, limitN);
  } catch { return []; }
}

export { auth, onAuthStateChanged };
