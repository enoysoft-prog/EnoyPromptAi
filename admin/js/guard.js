// js/guard.js — Fixed: handles slow auth, network issues, proper loader removal
import { auth }               from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

export function guardPage(onAuthed) {
  let resolved = false;

  // Safety timeout — if Firebase takes >8s, redirect to login
  const timeout = setTimeout(() => {
    if (!resolved) {
      resolved = true;
      window.location.replace("./index.html");
    }
  }, 8000);

  onAuthStateChanged(auth, (user) => {
    if (resolved) return;
    resolved = true;
    clearTimeout(timeout);

    if (!user) {
      window.location.replace("./index.html");
      return;
    }

    // Remove loader
    const loader = document.getElementById("pv-loader");
    if (loader) {
      loader.style.opacity = "0";
      loader.style.transition = "opacity 0.3s";
      setTimeout(() => loader.remove(), 300);
    }

    // Show page body
    const body = document.getElementById("pv-body");
    if (body) {
      body.classList.remove("invisible");
      body.style.opacity = "0";
      body.style.transition = "opacity 0.3s";
      requestAnimationFrame(() => { body.style.opacity = "1"; });
    }

    // Populate user info
    const emailEl    = document.getElementById("sb-email");
    const initialsEl = document.getElementById("sb-initials");
    if (emailEl)    emailEl.textContent    = user.email;
    if (initialsEl) initialsEl.textContent = user.email.charAt(0).toUpperCase();

    if (typeof onAuthed === "function") onAuthed(user);
  }, (error) => {
    // Auth error — go to login
    if (!resolved) {
      resolved = true;
      clearTimeout(timeout);
      window.location.replace("./index.html");
    }
  });
}
