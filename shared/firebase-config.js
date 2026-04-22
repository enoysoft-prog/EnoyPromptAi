// shared/firebase-config.js
// Single source of truth for Firebase configuration
// Both admin/ and src/ import from this file

export const firebaseConfig = {
  apiKey:            "AIzaSyBJr1bOkBo2Lvc5TWfVmYvmZLyZ8MxW69I",
  authDomain:        "prompt-vault-f41e0.firebaseapp.com",
  projectId:         "prompt-vault-f41e0",
  storageBucket:     "prompt-vault-f41e0.firebasestorage.app",
  messagingSenderId: "37807382327",
  appId:             "1:37807382327:web:51554a199a950f7265c4b2",
  measurementId:     "G-8RSW3XJ1B2"
};

// Cloudinary config
export const cloudinaryConfig = {
  cloud:  "do6mkxzxl",
  preset: "pv_upload"   // Unsigned upload preset — create in Cloudinary dashboard
};

// Coin system defaults (overridden by Firestore /config/coins)
export const coinDefaults = {
  referralReward:          50,   // coins per successful referral
  submissionApproved:     100,   // coins when your submitted prompt is approved
  proMonthlyCoins:        500,   // coins to upgrade to pro (monthly)
  proYearlyCoins:        4500,   // coins to upgrade to pro (yearly, ~25% discount)
  premiumUnlockCoins:      20,   // coins to unlock one premium prompt (alternative to ad)
  adRemovalCoins:         200,   // coins to remove ads for 30 days
  dailyLoginBonus:          5,   // coins for daily login
  profileCompleteBonus:    30    // one-time bonus for completing profile
};
