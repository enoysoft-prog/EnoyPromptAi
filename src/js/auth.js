// src/js/auth.js — Auth + user session management for PromptVault website
import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile,
  GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// ── Generate referral code ─────────────────────────────────
function genReferralCode(uid) {
  return ("PV" + uid.slice(0,6).toUpperCase());
}

// ── Create Firestore user profile on registration ──────────
export async function createUserProfile(user, extra = {}) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    // Existing user — update last login
    await updateDoc(ref, { lastLoginAt: serverTimestamp() });
    return snap.data();
  }
  // New user
  const profile = {
    uid:          user.uid,
    email:        user.email,
    displayName:  user.displayName || extra.displayName || "",
    avatarUrl:    user.photoURL    || "",
    bio:          "",
    status:       "pending",       // admin must approve
    role:         "regular",       // guest → regular on signup
    provider:     extra.provider   || "email",
    coins:        0,
    savedPrompts: [],
    referralCode: genReferralCode(user.uid),
    referredBy:   extra.referredBy || null,
    adsRemoved:   false,
    adsRemovedUntil: null,
    proExpiresAt: null,
    createdAt:    serverTimestamp(),
    lastLoginAt:  serverTimestamp(),
    updatedAt:    serverTimestamp()
  };
  await setDoc(ref, profile);

  // Award referral coins if referred
  if (extra.referredBy) {
    await processReferral(extra.referredBy, user.uid);
  }

  return profile;
}

// ── Process referral on signup ─────────────────────────────
async function processReferral(referrerId, newUserId) {
  try {
    // Get coin reward from config
    const cfgSnap = await getDoc(doc(db,"config","coins"));
    const reward  = cfgSnap.exists() ? (cfgSnap.data().referralReward||50) : 50;

    // Award coins to referrer
    await updateDoc(doc(db,"users",referrerId), {
      coins:     increment(reward),
      updatedAt: serverTimestamp()
    });

    // Log transaction
    const { addDoc, collection } = await import("https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js");
    await addDoc(collection(db,"coin_transactions"), {
      userId:      referrerId,
      amount:      reward,
      description: `Referral bonus: new user signed up with your code`,
      type:        "referral",
      referenceId: newUserId,
      createdAt:   serverTimestamp()
    });

    // Log referral
    await addDoc(collection(db,"referrals"), {
      referrerId,
      referredUserId: newUserId,
      coinsAwarded:   reward,
      createdAt:      serverTimestamp()
    });
  } catch(e) { console.warn("Referral processing error:", e.message); }
}

// ── Register with email ────────────────────────────────────
export async function registerWithEmail(email, password, displayName, referralCode = "") {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });

  // Resolve referrer from referral code
  let referredBy = null;
  if (referralCode) {
    const { getDocs, collection, where, query } = await import("https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js");
    const snap = await getDocs(query(collection(db,"users"), where("referralCode","==",referralCode.toUpperCase())));
    if (!snap.empty) referredBy = snap.docs[0].id;
  }

  await createUserProfile(cred.user, { displayName, provider:"email", referredBy });
  return cred.user;
}

// ── Login with email ───────────────────────────────────────
export async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  await createUserProfile(cred.user); // updates lastLoginAt
  await checkDailyLogin(cred.user.uid);
  return cred.user;
}

// ── Login with Google ──────────────────────────────────────
export async function loginWithGoogle(referralCode = "") {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);

  let referredBy = null;
  if (referralCode) {
    const { getDocs, collection, where, query } = await import("https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js");
    const snap = await getDocs(query(collection(db,"users"),where("referralCode","==",referralCode.toUpperCase())));
    if (!snap.empty) referredBy = snap.docs[0].id;
  }

  await createUserProfile(cred.user, { provider:"google", referredBy });
  await checkDailyLogin(cred.user.uid);
  return cred.user;
}

// ── Reset password ─────────────────────────────────────────
export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

// ── Sign out ───────────────────────────────────────────────
export async function logout() {
  await signOut(auth);
  sessionStorage.removeItem("pv_user_cache");
}

// ── Get current user profile from Firestore ───────────────
export async function getUserProfile(uid = null) {
  const id = uid || auth.currentUser?.uid;
  if (!id) return null;
  try {
    const snap = await getDoc(doc(db,"users",id));
    return snap.exists() ? { ...snap.data(), _docId: id } : null;
  } catch(e) { return null; }
}

// ── Auth state listener ────────────────────────────────────
export function onUserChange(callback) {
  return onAuthStateChanged(auth, async user => {
    if (!user) { callback(null, null); return; }
    const profile = await getUserProfile(user.uid);
    callback(user, profile);
  });
}

// ── Check + award daily login bonus ───────────────────────
async function checkDailyLogin(uid) {
  try {
    const snap = await getDoc(doc(db,"users",uid));
    if (!snap.exists()) return;
    const data  = snap.data();
    const last  = data.lastLoginAt?.toDate();
    const now   = new Date();
    if (last) {
      const sameDay = last.getFullYear()===now.getFullYear() && last.getMonth()===now.getMonth() && last.getDate()===now.getDate();
      if (sameDay) return; // already logged today
    }
    // Award daily bonus
    const cfgSnap = await getDoc(doc(db,"config","coins"));
    const bonus   = cfgSnap.exists() ? (cfgSnap.data().dailyLoginBonus||5) : 5;
    if (bonus > 0) {
      await updateDoc(doc(db,"users",uid), { coins:increment(bonus), lastLoginAt:serverTimestamp(), updatedAt:serverTimestamp() });
      const { addDoc, collection } = await import("https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js");
      await addDoc(collection(db,"coin_transactions"),{
        userId:uid, amount:bonus, type:"daily_login",
        description:"Daily login bonus",createdAt:serverTimestamp()
      });
    }
  } catch(e) { console.warn("Daily login bonus error:",e.message); }
}

// ── Check if user is banned → force logout ─────────────────
export async function checkBanStatus(uid) {
  const profile = await getUserProfile(uid);
  if (profile?.status === "banned") {
    await logout();
    return true;
  }
  return false;
}

// ── isProUser ──────────────────────────────────────────────
export function isProUser(profile) {
  if (!profile) return false;
  if (profile.role === "admin") return true;
  if (profile.role === "pro") {
    if (!profile.proExpiresAt) return false;
    const exp = profile.proExpiresAt?.seconds
      ? profile.proExpiresAt.seconds * 1000
      : new Date(profile.proExpiresAt).getTime();
    return Date.now() < exp;
  }
  return false;
}

// ── hasAdsRemoved ──────────────────────────────────────────
export function hasAdsRemoved(profile) {
  if (!profile) return false;
  if (isProUser(profile)) return true;
  if (!profile.adsRemovedUntil) return false;
  const exp = profile.adsRemovedUntil?.seconds
    ? profile.adsRemovedUntil.seconds * 1000
    : new Date(profile.adsRemovedUntil).getTime();
  return Date.now() < exp;
}
