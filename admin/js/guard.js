// admin/js/guard.js — Auth guard: checks Firebase login AND admin role in Firestore
import { auth } from "./firebase.js";
import { db }   from "./firebase.js";
import { onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { doc, getDoc }
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

/**
 * Awaitable guard.
 * - Redirects to ./index.html if not logged in or not admin.
 * - Resolves once auth confirmed, so pages can `await guard()` before init.
 */
export function guard() {
  return new Promise((resolve, reject) => {
    let settled = false;

    // Hard timeout — Firebase shouldn't take longer than 8 s
    const timer = setTimeout(() => {
      if (!settled) { settled = true; window.location.replace("./index.html"); }
    }, 8000);

    onAuthStateChanged(auth, async (user) => {
      if (settled) return;

      if (!user) {
        settled = true;
        clearTimeout(timer);
        window.location.replace("./index.html");
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!snap.exists() || snap.data().role !== "admin") {
          settled = true;
          clearTimeout(timer);
          await auth.signOut();
          window.location.replace("./index.html");
          return;
        }
      } catch {
        // Firestore unreachable — fail safely
        settled = true;
        clearTimeout(timer);
        window.location.replace("./index.html");
        return;
      }

      settled = true;
      clearTimeout(timer);
      resolve(user);
    });
  });
}
