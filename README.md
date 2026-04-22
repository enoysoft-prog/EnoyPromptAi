# PromptVault — Complete Web Platform

**Stack:** Firebase Auth + Firestore · Cloudinary · Vanilla HTML/CSS/JS  
**Hosting:** Vercel (recommended) or GitHub Pages  
**By:** ENOY SOFT · enoysoft@gmail.com

---

## 📁 Project Structure

```
promptvault/
├── src/                 ← User-facing website (public)
│   ├── index.html       — Home page (hero, trending, categories)
│   ├── prompts.html     — Browse + filter prompts
│   ├── prompt.html      — Single prompt detail
│   ├── categories.html  — All categories with subcategories
│   ├── auth.html        — Sign in / Register / Forgot password
│   ├── profile.html     — User profile, coins, referral code
│   ├── pro.html         — Pro upgrade with coins
│   ├── submit.html      — Submit a prompt to earn coins
│   ├── saved.html       — User's saved prompts
│   ├── about.html       — About page
│   ├── 404.html         — Not found
│   ├── js/
│   │   ├── firebase.js  — Firebase init (Auth + Firestore)
│   │   ├── auth.js      — Registration, login, Google auth, referral processing
│   │   ├── coins.js     — Coin operations (spend, unlock, pro upgrade)
│   │   ├── db.js        — Firestore read helpers
│   │   ├── ui.js        — Cards, banners, toast, SEO meta
│   │   └── nav.js       — Auth-aware navbar + footer
│   └── css/style.css    — All styles (dark theme, responsive)
│
├── admin/               ← Admin panel (protected by Firebase Auth)
│   ├── index.html       — Login page
│   ├── dashboard.html   — Stats overview (prompts, users, coins, submissions)
│   ├── prompts.html     — Prompt CRUD
│   ├── submissions.html — Review user-submitted prompts, approve/reject + award coins
│   ├── categories.html  — Category + subcategory CRUD
│   ├── tools.html       — AI tools CRUD
│   ├── users.html       — User management (approve, ban, role, coins)
│   ├── coins.html       — Coin config, plans, transactions, referral stats, manual award
│   ├── config.html      — App config (text, URLs, AdMob IDs, feature flags)
│   └── js/
│       ├── firebase.js  — Firebase init (Auth + Firestore)
│       ├── guard.js     — Auth guard (redirects to login if not signed in)
│       ├── sidebar.js   — Navigation with pending badges
│       ├── dashboard.js — Stats aggregation
│       ├── submissions.js — Prompt review workflow
│       ├── coins.js     — Coin config, transactions, referral stats
│       ├── users.js     — User CRUD with role/coin management
│       └── ...          — Other modules
│
├── shared/
│   └── firebase-config.js — Shared Firebase config reference
│
├── firestore.rules      ← PASTE INTO Firebase Console → Firestore → Rules
├── vercel.json          ← Vercel deployment config
├── .gitignore
├── robots.txt
└── sitemap.xml
```

---

## 🚀 Deploy to Vercel (Recommended)

### Option A — Vercel CLI
```bash
npm install -g vercel
cd promptvault
vercel login
vercel --prod
```

### Option B — Vercel Dashboard
1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. Framework: **Other** (static)
4. Root directory: `/` (leave default)
5. Click **Deploy**

Vercel reads `vercel.json` automatically. Your site structure:
- `https://your-domain.vercel.app/` → serves `src/index.html`
- `https://your-domain.vercel.app/admin/` → serves `admin/index.html`

### Option B — GitHub Pages
1. Create repo → upload all files → Settings → Pages → main branch / root
2. User site: `https://username.github.io/repo/src/`
3. Admin: `https://username.github.io/repo/admin/`

---

## 🔥 Firebase Setup (Step by Step)

### 1. Enable Authentication
Firebase Console → Authentication → Sign-in method → Enable:
- ✅ Email/Password
- ✅ Google

### 2. Publish Firestore Rules
Paste the contents of `firestore.rules` into:
> Firebase Console → Firestore Database → Rules → Publish

### 3. Create Admin User
Firebase Console → Authentication → Users → Add user
- Email: `your-admin@email.com`
- Password: `StrongPassword123!`

### 4. Add Authorized Domains
Firebase Console → Authentication → Settings → Authorized domains:
- Add your Vercel domain: `your-project.vercel.app`
- Add your custom domain if you have one

### 5. Create Cloudinary Upload Preset
1. [cloudinary.com](https://cloudinary.com) → Settings → Upload → Add Upload Preset
2. Name: `pv_upload` | Signing Mode: **Unsigned**
3. Save

---

## 🪙 Coin System

### How Users Earn Coins
| Action | Default Reward |
|--------|---------------|
| Referral (new user registers) | 50 coins |
| Submitted prompt approved | 100 coins |
| Daily login | 5 coins |
| Complete profile (one-time) | 30 coins |

### How Users Spend Coins
| Purchase | Default Cost |
|----------|-------------|
| Pro Monthly (30 days) | 500 coins |
| Pro Yearly (365 days) | 4,500 coins |
| Remove Ads (30 days) | 200 coins |
| Unlock 1 premium prompt | 20 coins |

**All values are configurable** from Admin → Coins & Plans.

### Pro Benefits
- ✅ No ads
- ✅ All premium prompts unlocked
- ✅ Submit prompts to earn more coins
- ✅ Priority support

---

## 👥 User Roles

| Role | Access |
|------|--------|
| `regular` | Browse free prompts, save favourites |
| `pro` | No ads, all premium prompts unlocked, submit prompts |
| `admin` | Full admin panel access + all pro features |

### User Status Flow
```
Register → status: "pending"
Admin approves → status: "active"  (role: "regular")
User spends coins → role: "pro"
Admin bans → status: "banned"
```

---

## 📤 Prompt Submission Flow

```
User submits via submit.html
    ↓
Saved to /prompt_submissions/{id} with status: "pending"
    ↓
Admin reviews in admin/submissions.html
    ↓
Admin clicks Approve + sets coin reward
    ↓
Prompt published to /prompts collection (live on website)
    ↓
User's coin balance updated (+reward)
    ↓
User sees coins in their profile
```

---

## 📱 Android App Integration Guide

After the web platform is set up, connect your Android app to the same Firestore project.

### Reading from Firestore in Android

```java
// FirestoreRepository.java
FirebaseFirestore db = FirebaseFirestore.getInstance();

// Fetch categories
db.collection("categories")
  .get()
  .addOnSuccessListener(snap -> {
    List<Category> cats = new ArrayList<>();
    for (QueryDocumentSnapshot d : snap) {
      cats.add(d.toObject(Category.class));
    }
    // Update UI
  });
```

### Reading coin config (for AdMob on/off)
```java
db.document("config/app")
  .get()
  .addOnSuccessListener(snap -> {
    boolean adsEnabled = snap.getBoolean("adsEnabled");
    // Show/hide ads based on config
  });
```

### User coin balance (for premium unlock)
```java
db.document("users/" + currentUser.getUid())
  .get()
  .addOnSuccessListener(snap -> {
    long coins = snap.getLong("coins");
    String role = snap.getString("role");
    boolean isPro = "pro".equals(role) || "admin".equals(role);
    // isPro users: unlock all premiums
    // Others: check unlockedPrompts array
  });
```

### User authentication in Android
```java
// Use the same Firebase project — credentials in google-services.json
FirebaseAuth auth = FirebaseAuth.getInstance();

// After login, create/update user document
Map<String, Object> data = new HashMap<>();
data.put("uid", user.getUid());
data.put("email", user.getEmail());
data.put("status", "pending");
data.put("role", "regular");
data.put("coins", 0);
data.put("lastLoginAt", FieldValue.serverTimestamp());

db.collection("users").document(user.getUid())
  .set(data, SetOptions.merge());
```

---

## 🔒 Admin Panel Security Tips

### CRITICAL — Restrict Admin Access by UID

Open `firestore.rules` and update the `isAdminUser()` function:

```javascript
function isAdminUser() {
  return isSignedIn() && request.auth.uid in [
    "YOUR_ADMIN_UID_1",
    "YOUR_ADMIN_UID_2"
  ];
}
```

Find your admin UID in Firebase Console → Authentication → Users (copy the UID column).

### Security Best Practices

**1. Never commit secrets to Git**
- The Firebase web config is safe to commit (it's client-side)
- Never commit Firebase Admin SDK service account keys
- Never commit `.env` files

**2. Restrict API key in Google Cloud Console**
- Go to [console.cloud.google.com](https://console.cloud.google.com)
- APIs & Services → Credentials → Your API Key
- Add HTTP referrer restrictions: `your-domain.vercel.app/*`
- This prevents others from using your key on their domains

**3. Use Firebase App Check (recommended)**
- Firebase Console → App Check
- Register your web apps to prevent unauthorized API usage

**4. Admin panel URL obscurity**
- Keep `/admin/` URL private — don't link to it publicly
- Consider renaming the folder to something non-obvious for extra obscurity

**5. Strong Firestore rules**
- Never use `allow read, write: if true` in production
- Always scope writes to authenticated users
- Scope sensitive reads (user data, transactions) to the owner

**6. Monitor Firebase Console regularly**
- Check Firestore usage for unusual spikes
- Enable Firebase Alerts for budget limits
- Review Authentication logs monthly

**7. Password policy**
- Firebase enforces minimum 6 chars by default
- Consider adding client-side validation for 8+ chars + special characters

**8. Rate limiting**
- Firebase Authentication automatically rate-limits login attempts
- Cloud Firestore has built-in rate limiting per project

**9. Secure admin login page**
- Keep the admin panel on a separate subdirectory
- The `guard.js` already prevents unauthorized access
- Consider IP allowlisting at Vercel level for the `/admin/` path

**10. Regular security audit checklist**
```
[ ] Firestore rules restrict admin writes to specific UIDs
[ ] API key has domain restrictions in Google Cloud Console
[ ] Admin UIDs are hardcoded in firestore.rules
[ ] Firebase App Check is enabled
[ ] No `.env` or service account files in git history
[ ] Admin panel URL is not publicly indexed (robots.txt)
[ ] Firebase billing alerts are configured
[ ] Authentication rate limiting is active (default in Firebase)
```

---

## 🔍 SEO Features

- Semantic HTML5 with h1→h2→h3 hierarchy
- `<meta name="description">` on all public pages
- Open Graph + Twitter Card tags
- JSON-LD structured data (WebSite, Article schemas)
- `sitemap.xml` + `robots.txt`
- Dynamic meta tag updates on prompt detail pages
- `alt` text on all images
- ARIA labels on interactive elements
- Canonical URLs
- Server-sent security headers via `vercel.json`

**To update sitemap:** Edit `sitemap.xml` replacing `YOUR_DOMAIN` with your actual domain.

---

## 🔧 What to Change Before Launch

### Step 1 — Replace YOUR_DOMAIN in all src HTML files
```
sitemap.xml     → 3 occurrences
src/index.html  → og:url, canonical
src/prompts.html → canonical
src/categories.html → canonical
src/auth.html   → link rel
src/pro.html    → link rel
```

### Step 2 — AdSense Publisher ID
Replace `ca-pub-XXXXXXXXXXXXXXXX` in:
- `src/index.html` (3 ad slots)
- `src/prompts.html` (2 ad slots)
- `src/prompt.html` (2 ad slots)

### Step 3 — Play Store URL
Admin → Config → Play Store URL → paste your real Play Store link

### Step 4 — Firestore Rules with your Admin UID
```javascript
function isAdminUser() {
  return isSignedIn() && request.auth.uid == "YOUR_ACTUAL_ADMIN_UID";
}
```

### Step 5 — Firestore Rules → Publish
Paste `firestore.rules` into Firebase Console → Firestore → Rules

---

*PromptVault v5.0 — Complete Platform · Firebase + Cloudinary · ENOY SOFT*
