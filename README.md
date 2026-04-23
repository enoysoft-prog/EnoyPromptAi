# ✨ PromptVault v2.0 — Complete Web Project

> **The ultimate AI Prompt Library** with user authentication, coin economy, referral system, Pro memberships, prompt submissions, and a full admin panel.

**Tech Stack:** Firebase (Auth + Firestore) · Cloudinary · Vanilla JS (ES Modules) · Tailwind CSS (admin) · Vercel

---

## 📁 Project Structure

```
promptvault/
├── index.html              ← Homepage
├── prompts.html            ← Browse all prompts
├── prompt.html             ← Single prompt detail
├── categories.html         ← Browse categories
├── about.html              ← About page
├── auth.html               ← Login / Register / Password Reset
├── dashboard.html          ← User dashboard (coins, referrals, upgrade)
├── 404.html                ← Custom 404
├── robots.txt
├── sitemap.xml
├── vercel.json             ← Vercel deployment config
├── firestore.rules         ← Firestore security rules
├── css/
│   └── style.css           ← Complete unified stylesheet
├── js/
│   ├── firebase.js         ← Firebase initializer
│   ├── auth.js             ← Auth, registration, referrals, roles, coin ops
│   ├── db.js               ← Firestore queries (prompts, categories, tools)
│   ├── nav.js              ← Navigation with auth-aware user menu
│   └── ui.js               ← UI helpers (cards, toast, modals, skeletons)
└── admin/
    ├── index.html          ← Admin login
    ├── dashboard.html      ← Admin dashboard + stats
    ├── users.html          ← User management + coin adjustment
    ├── submissions.html    ← Approve/reject user-submitted prompts
    ├── prompts.html        ← Prompt CRUD
    ├── categories.html     ← Category management
    ├── tools.html          ← AI Tools management
    ├── referrals.html      ← Referral tracking + reward config
    ├── config.html         ← All app settings incl. coin rewards
    ├── css/style.css
    └── js/
        ├── firebase.js
        ├── guard.js        ← Admin auth guard
        ├── sidebar.js      ← Sidebar with notification badges
        ├── dashboard.js
        ├── users.js        ← User management + coin ops
        ├── submissions.js  ← Prompt submission review
        ├── prompts.js
        ├── categories.js
        ├── tools.js
        ├── cloudinary.js
        ├── config.js       ← Config with all coin/reward settings
        └── ui.js
```

---

## 🚀 Quick Start

### 1. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com) → Create project
2. Enable **Authentication** → Email/Password + Google
3. Enable **Firestore Database** → Start in **production mode**
4. Copy your config into `js/firebase.js` AND `admin/js/firebase.js`:

```js
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};
```

5. Deploy Firestore rules:
   - In Firebase Console → Firestore → Rules
   - Copy contents of `firestore.rules` and publish

### 2. Create Your Admin Account

1. Register a new account on your site via `auth.html`
2. In Firebase Console → Firestore → `users` collection
3. Find your user document, set `role` field to `"admin"`
4. Now you can sign in at `/admin/`

### 3. Configure Cloudinary (for image uploads)

Update `admin/js/cloudinary.js` with your Cloudinary credentials:
```js
const CLOUDINARY_CLOUD = "your_cloud_name";
const CLOUDINARY_PRESET = "your_unsigned_preset";
```

### 4. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Or connect your GitHub repo at [vercel.com](https://vercel.com) for automatic deployments.

---

## 🪙 Coin System

The coin economy lets users earn, hold, and spend **PromptCoins**.

### How Users Earn Coins
| Method | Amount |
|--------|--------|
| Referring a new user | Set by admin (default: 10) |
| Pro prompt approved | Set by admin (default: 20) |
| Admin bonus | Any amount (admin panel) |

### How Users Spend Coins
| Action | Cost |
|--------|------|
| Upgrade to Pro | Set by admin (default: 100) |
| Remove ads (non-Pro) | Set by admin (default: 50) |

### Admin Controls (App Config page)
- **Referral Coin Reward** — coins per successful referral signup
- **Pro Membership Cost** — coins to upgrade from Regular → Pro
- **Prompt Approval Reward** — coins when a submitted prompt is approved
- **Remove Ads Cost** — coins to permanently remove ads

---

## 👥 User Roles

| Role | Description |
|------|-------------|
| `guest` | Not logged in. Can browse free prompts. |
| `regular` | Registered. Can save prompts, earn/spend coins, refer friends. |
| `pro` | Upgraded via coins. No ads, all premium prompts, can submit prompts. |
| `admin` | Full admin panel access. Set manually in Firestore. |

---

## 📝 Prompt Submission Flow (Pro Users)

1. **Pro user** submits a prompt via Dashboard → Submit Prompt
2. Submission saved in `submissions` collection with `status: "pending"`
3. **Admin** sees badge on Submissions sidebar item
4. Admin reviews the prompt on `submissions.html`
5. Admin clicks **Approve** → prompt goes live in `prompts` collection + author receives coins
6. Admin clicks **Reject** → submission marked as rejected, no coins awarded

---

## 🔗 Referral System

1. Every user gets a unique **referral code** on account creation
2. User shares their referral link: `https://your-site.com/auth.html?tab=register&ref=ABC123`
3. New user registers with the code → referrer earns coins automatically
4. Admin can change the reward at any time in **App Config** or **Referrals page**

---

## 🔐 Security Guide

### Firestore Rules
The `firestore.rules` file enforces:
- Public can only read **active/approved** prompts, categories, tools, config
- Users can only read/write **their own** user document
- Users **cannot** change their own `role`, `coins`, `status`, or `referralCode`
- Only **admins** can manage all data
- Submissions can only be created by Pro users with their own UID

### Admin Panel Security

**Critical steps before going live:**

1. **Change the admin directory path** — rename `/admin/` to something non-obvious like `/pv-manage-x9k/`
   - Update all links in sidebar.js accordingly

2. **Enable Firebase App Check** in Firebase Console to block unauthorized API calls

3. **Restrict your Firebase API key** in Google Cloud Console:
   - Go to [console.cloud.google.com](https://console.cloud.google.com)
   - APIs & Services → Credentials → Edit your API key
   - Under "Application restrictions" select "HTTP referrers"
   - Add your Vercel domain: `https://your-site.vercel.app/*`

4. **Use strong admin passwords** — minimum 16 characters, use a password manager

5. **Enable 2-Step Verification** on your Firebase Google account

6. **Monitor Firestore usage** — set budget alerts in Firebase Console to detect abuse

7. **Never commit real Firebase credentials** to a public GitHub repo
   - Use environment variables or `.env` files (add to `.gitignore`)

8. **Review Firebase Auth settings**:
   - Enable email enumeration protection
   - Set reasonable rate limits

### Data Security Tips

- Firestore rules are your **last line of defense** — always test them
- Use Firebase Rules Playground to test rule scenarios before deploying
- Periodically export Firestore data for backup (automate with Cloud Scheduler)
- Use Firestore indexes only where necessary to minimize attack surface
- **Never** store sensitive data (payment info, passwords) in Firestore — Firebase Auth handles passwords

### .gitignore Setup

Create a `.gitignore` file:
```
.env
.env.local
node_modules/
*.log
.DS_Store
```

---

## 🌐 SEO Optimization

- All public pages include `<title>`, `<meta description>`, Open Graph & Twitter cards
- `robots.txt` disallows admin, auth, and dashboard pages
- `sitemap.xml` — update with your actual domain
- Prompt pages use Schema.org `Article` markup
- Category pages use Schema.org structured data
- Canonical URLs throughout

### To update canonical URLs:
Find and replace `YOUR_DOMAIN.com` in all HTML files.

---

## 📱 Android App Implementation Guide

### Option A: WebView App (Fastest)
1. Create a new Android project in Android Studio
2. Use `WebView` to load your Vercel URL
3. Add `INTERNET` permission in `AndroidManifest.xml`
4. Enable JavaScript: `webView.settings.javaScriptEnabled = true`
5. Enable DOM storage: `webView.settings.domStorageEnabled = true`
6. Intercept `playStoreUrl` links to open Play Store intent
7. Handle back navigation: override `onBackPressed` to call `webView.goBack()`

### Option B: Native App with Firebase SDK (Recommended for full features)
1. Add Firebase to your Android project via `google-services.json`
2. Use Retrofit/OkHttp to call Firestore REST API
3. Use Firebase Auth SDK for native authentication
4. Implement AdMob SDK with the unit IDs set in App Config
5. Use Cloudinary Android SDK for image loading

### AdMob Integration
Your AdMob IDs are stored in Firestore at `config/app`. Fetch them at app startup:
```kotlin
db.collection("config").document("app").get()
    .addOnSuccessListener { doc ->
        val bannerId       = doc.getString("admobBannerId") ?: ""
        val interstitialId = doc.getString("admobInterstitialId") ?: ""
        val rewardedId     = doc.getString("admobRewardedId") ?: ""
        // Initialize AdMob with these IDs
    }
```

### Coin Sync
The coin balance is stored in `users/{uid}.coins` in Firestore. Listen for real-time updates:
```kotlin
db.collection("users").document(uid)
    .addSnapshotListener { snapshot, _ ->
        val coins = snapshot?.getLong("coins") ?: 0
        // Update UI
    }
```

---

## 🛠 GitHub Repository Setup

```bash
# Initialize
git init
git add .
git commit -m "feat: PromptVault v2.0 — full project with coin system"

# Create repo on GitHub.com, then:
git remote add origin https://github.com/YOUR_USERNAME/promptvault.git
git branch -M main
git push -u origin main
```

**Branch strategy:**
- `main` — production (auto-deploys to Vercel)
- `develop` — staging
- `feature/*` — new features

---

## 📊 Firestore Data Model

```
config/app              ← Global app settings + coin values
categories/{id}         ← Prompt categories
subcategories/{id}      ← Sub-categories
tools/{id}              ← AI tools (Midjourney, DALL·E, etc.)
prompts/{id}            ← Live approved prompts
submissions/{id}        ← User-submitted prompts awaiting review
users/{uid}             ← User profiles (role, coins, savedPrompts, referralCode)
referrals/{id}          ← Referral tracking records
coinTransactions/{id}   ← Full coin earn/spend audit log
unlocks/{id}            ← Premium prompt unlock records
```

---

## 🆘 Troubleshooting

| Issue | Fix |
|-------|-----|
| Admin login redirects back to login | Ensure your user doc has `role: "admin"` in Firestore |
| Referral coins not awarded | Check Firestore rules allow create on `referrals` collection |
| Prompts not loading | Check `status` field — must be `"active"` or `"approved"` |
| Coin balance not updating | Check `coinTransactions` write rules; ensure `users/{uid}` update is allowed |
| Submissions not visible to admin | Confirm `submissions` read rule allows admin role |

---

Built with ❤️ by ENOY SOFT
