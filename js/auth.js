// js/auth.js — Authentication, user profiles, coins, referrals
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

// ── Generate referral code ────────────────────────────────
function genReferralCode(uid) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = uid.slice(0,4).toUpperCase().replace(/[^A-Z]/g,"X");
  while (code.length < 8) code += chars[Math.floor(Math.random()*chars.length)];
  return code.slice(0,8);
}

// ── Coin config from Firestore ────────────────────────────
export async function getCoinConfig() {
  try {
    const snap = await getDoc(doc(db,"config","app"));
    const d = snap.exists() ? snap.data() : {};
    return {
      referralReward:     d.referralCoinReward      ?? 10,
      proMembershipCost:  d.proMembershipCost        ?? 100,
      promptSubmitReward: d.promptSubmissionReward   ?? 20,
      adsRemoveCost:      d.adsRemoveCost            ?? 50,
    };
  } catch { return { referralReward:10, proMembershipCost:100, promptSubmitReward:20, adsRemoveCost:50 }; }
}

// ── Create / refresh user profile ────────────────────────
async function createUserProfile(user, extra={}) {
  const ref  = doc(db, COL, user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data();
    const updates = { lastLoginAt: serverTimestamp() };
    // FIX: If existing user has no referralCode, generate one now
    if (!data.referralCode) {
      updates.referralCode = genReferralCode(user.uid);
    }
    await updateDoc(ref, updates).catch(()=>{});
    return { ...data, ...updates, uid: user.uid };
  }

  // New user
  const referralCode = genReferralCode(user.uid);
  const profile = {
    uid:         user.uid,
    email:       user.email      || "",
    displayName: user.displayName|| extra.displayName || "",
    avatarUrl:   user.photoURL   || "",
    role:        "regular",
    coins:       0,
    status:      "active",
    referralCode,
    referredBy:  extra.referredBy || null,
    savedPrompts:[],
    adsRemoved:  false,
    createdAt:   serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  };
  await setDoc(ref, profile);

  if (extra.referredBy) {
    processReferralReward(extra.referredBy, user.uid).catch(()=>{});
  }
  return profile;
}

// ── Referral reward ───────────────────────────────────────
async function processReferralReward(code, newUserId) {
  try {
    const q    = query(collection(db,COL), where("referralCode","==",code));
    const snap = await getDocs(q);
    if (snap.empty) return;
    const referrer = snap.docs[0];
    const cfg = await getCoinConfig();
    await updateDoc(doc(db,COL,referrer.id), { coins: increment(cfg.referralReward) });
    await addDoc(collection(db,"referrals"), {
      referrerId:referrer.id, referredId:newUserId, referrerCode:code,
      coinsAwarded:cfg.referralReward, createdAt:serverTimestamp()
    });
    await addDoc(collection(db,"coinTransactions"), {
      userId:referrer.id, amount:cfg.referralReward, type:"earn",
      description:"Referral bonus — new user joined", createdAt:serverTimestamp()
    });
  } catch(e) { console.warn("Referral error:", e.message); }
}

// ── Public auth ───────────────────────────────────────────
export async function registerWithEmail(email, password, displayName, referralCode="") {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName }).catch(()=>{});
  await createUserProfile(cred.user, {
    displayName,
    referredBy: referralCode.trim().toUpperCase() || null
  });
  return cred.user;
}

export async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  await createUserProfile(cred.user);
  return cred.user;
}

export async function loginWithGoogle(referralCode="") {
  const cred = await signInWithPopup(auth, googleProvider);
  await createUserProfile(cred.user, {
    referredBy: referralCode.trim().toUpperCase() || null
  });
  return cred.user;
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

export async function logout() {
  await signOut(auth);
  window.location.href = "./index.html";
}

// ── Profile helpers ───────────────────────────────────────
export async function getCurrentUserProfile() {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    const snap = await getDoc(doc(db,COL,user.uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    // FIX: generate referralCode on the fly if missing
    if (!data.referralCode) {
      const code = genReferralCode(user.uid);
      updateDoc(doc(db,COL,user.uid), { referralCode:code }).catch(()=>{});
      data.referralCode = code;
    }
    return { uid:user.uid, ...data };
  } catch { return null; }
}

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

// ── Coin operations ───────────────────────────────────────
export async function upgradeToPro(uid) {
  const cfg  = await getCoinConfig();
  const ref  = doc(db,COL,uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("User not found");
  const u = snap.data();
  if (u.role==="pro") throw new Error("Already a Pro member");
  if ((u.coins||0) < cfg.proMembershipCost)
    throw new Error(`Need ${cfg.proMembershipCost} coins, you have ${u.coins||0}`);
  await updateDoc(ref, { role:"pro", coins:increment(-cfg.proMembershipCost), proSince:serverTimestamp() });
  await addDoc(collection(db,"coinTransactions"), {
    userId:uid, amount:-cfg.proMembershipCost, type:"spend",
    description:"Upgraded to Pro", createdAt:serverTimestamp()
  });
}

export async function toggleSavePrompt(uid, promptId) {
  const ref  = doc(db,COL,uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Not logged in");
  const saved   = snap.data().savedPrompts||[];
  const isSaved = saved.includes(promptId);
  await updateDoc(ref, {
    savedPrompts: isSaved ? saved.filter(id=>id!==promptId) : [...saved, promptId]
  });
  return !isSaved;
}

export async function getCoinHistory(uid, limitN=30) {
  try {
    const snap = await getDocs(query(
      collection(db,"coinTransactions"), where("userId","==",uid)
    ));
    return snap.docs.map(d => ({ id:d.id, ...d.data() }))
      .sort((a,b) => (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))
      .slice(0,limitN);
  } catch { return []; }
}

export { auth, onAuthStateChanged };
