# PromptVault Admin Panel v4 — User System Guide

**Version:** 4.0 — User accounts, approval, ban, delete  
**By:** ENOY SOFT · enoysoft@gmail.com

## What's New in v4

- Users page (`users.html`) — full user management with profile cards  
- User stat cards on Dashboard (Total / Active / Pending / Banned)  
- Pending badge on sidebar Users link — live count of pending approvals  
- Recent Users panel on Dashboard  
- Firestore rules updated to include `/users` collection

## User Document Structure

Firestore `/users/{uid}`:
```
uid, email, displayName, avatarUrl, bio
status:       "pending" | "active" | "banned"
role:         "user" | "admin"
provider:     "email" | "google"
savedPrompts: ["id1","id2",...]
createdAt, lastLoginAt, approvedAt, bannedAt, updatedAt
```

## Step 1 — Update Firestore Rules (REQUIRED)
Paste `firestore.rules` into Firebase Console → Firestore → Rules → Publish.

## Step 2 — Website Registration
When a user registers on the website, create a Firestore document:
```js
await setDoc(doc(db,"users",user.uid), {
  uid: user.uid, email: user.email, displayName: name,
  status: "pending", role: "user", savedPrompts: [],
  provider: "email", createdAt: serverTimestamp(),
  lastLoginAt: serverTimestamp(), updatedAt: serverTimestamp()
});
```

## Step 3 — Check Status on Website
Before allowing saves, check: `if (userData.status === "banned") block();`

## Admin Actions
- View Profile — full modal with all user details  
- Approve (pending → active) — user gets full access  
- Ban (→ banned) — user is blocked on website  
- Unban (→ active) — restore access  
- Delete — removes Firestore doc (delete Firebase Auth account separately in Firebase Console)

## Notes
Deleting from admin only removes the Firestore doc.  
Firebase Auth account must be deleted separately from Firebase Console → Authentication → Users.  
Banned users must be blocked on the website side by checking Firestore status on login.
