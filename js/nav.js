// js/nav.js — Navigation with auth-aware user menu
import { getAppConfig } from "./db.js";
import { auth, onAuthStateChanged } from "./auth.js";
import { db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const PAGE = window.location.pathname.split("/").pop() || "index.html";

const NAV_LINKS = [
  { href:"index.html",       label:"Home" },
  { href:"prompts.html",     label:"Prompts" },
  { href:"categories.html",  label:"Categories" },
  { href:"about.html",       label:"About" },
];

export function esc(s) {
  return String(s ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

export function injectNav(cfg = {}) {
  const storeUrl = cfg.playStoreUrl || "#";

  const navHtml = `
  <nav class="navbar" role="navigation" aria-label="Main navigation">
    <div class="nav-inner">
      <a href="./index.html" class="nav-logo" aria-label="PromptVault Home">
        <div class="nav-logo-icon" aria-hidden="true">✨</div>
        <span>PromptVault</span>
      </a>
      <div class="nav-links" role="menubar">
        ${NAV_LINKS.map(l =>
          `<a href="./${l.href}" role="menuitem" ${PAGE===l.href?'class="active"':''}>${l.label}</a>`
        ).join("")}
      </div>
      <div class="nav-spacer"></div>
      <div class="nav-search" id="nav-search-wrap" style="position:relative;">
        <svg class="nav-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input id="nav-search-input" type="search" placeholder="Search prompts…" aria-label="Search prompts"
               autocomplete="off"/>
        <div id="nav-search-results" class="search-results-wrap" role="listbox"></div>
      </div>
      <div id="nav-auth-slot" class="nav-auth-slot">
        <a href="./auth.html" class="btn-nav-login">Sign In</a>
      </div>
      <button class="nav-hamburger" id="nav-hamburger" aria-label="Open menu" aria-expanded="false">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
      </button>
    </div>
  </nav>

  <div class="mobile-nav-drawer" id="mobile-drawer" role="dialog" aria-modal="true">
    <div class="mobile-nav-backdrop" id="drawer-backdrop"></div>
    <div class="mobile-nav-panel">
      <button class="mobile-nav-close" id="drawer-close" aria-label="Close menu">✕</button>
      <div style="margin-bottom:20px;">
        <a href="./index.html" style="display:flex;align-items:center;gap:10px;font-size:18px;font-weight:800;">
          <div class="nav-logo-icon">✨</div>
          <span style="background:linear-gradient(135deg,#a78bfa,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">PromptVault</span>
        </a>
      </div>
      <div style="padding:10px 0 14px;border-bottom:1px solid var(--border);margin-bottom:10px;">
        <input id="drawer-search" type="search" placeholder="Search prompts…"
          style="width:100%;background:var(--surface2);border:1.5px solid var(--border2);border-radius:10px;padding:10px 14px;font-size:14px;color:var(--text);outline:none;"
          aria-label="Search prompts"/>
      </div>
      ${NAV_LINKS.map(l =>
        `<a href="./${l.href}" ${PAGE===l.href?'class="active"':''}>${l.label}</a>`
      ).join("")}
      <div id="mobile-auth-slot" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">
        <a href="./auth.html" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:13px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border-radius:12px;font-size:14px;font-weight:700;">
          Sign In / Register
        </a>
      </div>
    </div>
  </div>`;

  document.body.insertAdjacentHTML("afterbegin", navHtml);

  // Mobile drawer
  const hamburger = document.getElementById("nav-hamburger");
  const drawer    = document.getElementById("mobile-drawer");
  const backdrop  = document.getElementById("drawer-backdrop");
  const closeBtn  = document.getElementById("drawer-close");
  const open  = () => { drawer.classList.add("open"); hamburger.setAttribute("aria-expanded","true"); document.body.style.overflow="hidden"; };
  const close = () => { drawer.classList.remove("open"); hamburger.setAttribute("aria-expanded","false"); document.body.style.overflow=""; };
  hamburger?.addEventListener("click", open);
  backdrop?.addEventListener("click", close);
  closeBtn?.addEventListener("click", close);

  // Search
  const searchInput   = document.getElementById("nav-search-input");
  const searchResults = document.getElementById("nav-search-results");
  let searchTimer;
  searchInput?.addEventListener("input", () => {
    clearTimeout(searchTimer);
    const q = searchInput.value.trim();
    if (!q) { searchResults.innerHTML = ""; searchResults.classList.remove("open"); return; }
    searchTimer = setTimeout(async () => {
      const { getPrompts } = await import("./db.js");
      const { items } = await getPrompts({ search: q });
      if (!items.length) { searchResults.innerHTML = `<div class="search-no-result">No results for "${esc(q)}"</div>`; }
      else {
        searchResults.innerHTML = items.slice(0,6).map(p =>
          `<a href="./prompt.html?id=${esc(p.id)}" class="search-result-item">
            <span class="search-result-title">${esc(p.title)}</span>
            ${p.isPremium ? '<span class="badge-premium-xs">PRO</span>' : ''}
          </a>`
        ).join("");
      }
      searchResults.classList.add("open");
    }, 300);
  });
  document.addEventListener("click", e => {
    if (!e.target.closest("#nav-search-wrap")) {
      searchResults.classList.remove("open");
    }
  });

  // Auth state — update nav
  onAuthStateChanged(auth, async (user) => {
    const slot       = document.getElementById("nav-auth-slot");
    const mobileSlot = document.getElementById("mobile-auth-slot");
    if (!slot) return;

    if (user) {
      let profile = null;
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) profile = snap.data();
      } catch {}
      const name    = profile?.displayName || user.displayName || user.email?.split("@")[0] || "User";
      const coins   = profile?.coins ?? 0;
      const role    = profile?.role || "regular";
      const initials = name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
      const roleBadge = role === "pro"
        ? `<span class="nav-pro-badge">PRO</span>`
        : `<span class="nav-coin-badge">🪙 ${coins}</span>`;

      slot.innerHTML = `
        <div class="nav-user-menu" id="nav-user-btn">
          <div class="nav-avatar">${initials}</div>
          ${roleBadge}
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          <div class="nav-dropdown" id="nav-dropdown">
            <div class="nav-dropdown-header">
              <strong>${esc(name)}</strong>
              <span class="text-xs text-gray-400">${esc(user.email||"")}</span>
            </div>
            <a href="./dashboard.html" class="nav-dropdown-item">👤 My Dashboard</a>
            <a href="./dashboard.html#saved" class="nav-dropdown-item">🔖 Saved Prompts</a>
            <a href="./dashboard.html#coins" class="nav-dropdown-item">🪙 Coin History</a>
            ${role !== "pro" ? `<a href="./dashboard.html#upgrade" class="nav-dropdown-item upgrade">⭐ Upgrade to Pro</a>` : ""}
            <div class="nav-dropdown-div"></div>
            <button id="btn-nav-logout" class="nav-dropdown-item danger">Sign Out</button>
          </div>
        </div>`;

      mobileSlot.innerHTML = `
        <a href="./dashboard.html" style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--surface2);border-radius:12px;color:var(--text);font-weight:600;font-size:14px;">
          <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#4f46e5,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;">${initials}</div>
          <div><div>${esc(name)}</div><div style="font-size:12px;color:#6b7280;">🪙 ${coins} coins · ${role}</div></div>
        </a>
        <button id="btn-mobile-logout" style="display:flex;align-items:center;justify-content:center;width:100%;padding:12px;margin-top:8px;background:var(--surface2);border-radius:12px;color:#ef4444;font-size:14px;font-weight:600;border:none;cursor:pointer;">Sign Out</button>`;

      // Dropdown toggle
      const userBtn = document.getElementById("nav-user-btn");
      const dropdown = document.getElementById("nav-dropdown");
      userBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.toggle("open");
      });
      document.addEventListener("click", () => dropdown?.classList.remove("open"));

      // Logout buttons
      document.getElementById("btn-nav-logout")?.addEventListener("click", async () => {
        const { logout } = await import("./auth.js");
        await logout();
      });
      document.getElementById("btn-mobile-logout")?.addEventListener("click", async () => {
        const { logout } = await import("./auth.js");
        await logout();
      });
    }
  });
}

export function injectFooter(cfg = {}) {
  const year = new Date().getFullYear();
  document.body.insertAdjacentHTML("beforeend", `
  <footer class="footer" role="contentinfo">
    <div class="footer-inner">
      <div class="footer-brand">
        <a href="./index.html" class="nav-logo" aria-label="PromptVault Home">
          <div class="nav-logo-icon">✨</div>
          <span>PromptVault</span>
        </a>
        <p>The best AI prompt library for Midjourney, DALL·E, ChatGPT &amp; more.</p>
      </div>
      <div class="footer-cols">
        <div>
          <h4>Explore</h4>
          <a href="./prompts.html">All Prompts</a>
          <a href="./categories.html">Categories</a>
          <a href="./about.html">About</a>
        </div>
        <div>
          <h4>Account</h4>
          <a href="./auth.html">Sign In</a>
          <a href="./auth.html?tab=register">Register</a>
          <a href="./dashboard.html">Dashboard</a>
        </div>
        <div>
          <h4>Legal</h4>
          <a href="${cfg.privacyPolicyUrl||"#"}">Privacy Policy</a>
          <a href="${cfg.termsUrl||"#"}">Terms of Service</a>
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <p>© ${year} PromptVault · Built with ❤️ by ENOY SOFT</p>
    </div>
  </footer>`);
}

export function initAppBanner(cfg = {}) {
  if (!cfg.playStoreUrl) return;
  const banner = document.createElement("div");
  banner.className = "app-banner";
  banner.id = "app-banner";
  banner.innerHTML = `
    <button class="app-banner-close" id="app-banner-close" aria-label="Close">✕</button>
    <span class="app-banner-icon">📱</span>
    <div>
      <strong>Get the App</strong>
      <span>Free on Google Play</span>
    </div>
    <a href="${cfg.playStoreUrl}" class="app-banner-btn">Download</a>`;

  if (!sessionStorage.getItem("app-banner-closed")) {
    document.body.insertAdjacentElement("afterbegin", banner);
    document.getElementById("app-banner-close")?.addEventListener("click", () => {
      banner.remove();
      sessionStorage.setItem("app-banner-closed", "1");
    });
  }
}
