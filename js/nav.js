// js/nav.js — Auth-aware navigation bar
import { auth, onAuthStateChanged } from "./auth.js";
import { db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const PAGE = window.location.pathname.split("/").pop() || "index.html";

const NAV_LINKS = [
  { href:"index.html",      label:"Home"       },
  { href:"prompts.html",    label:"Prompts"    },
  { href:"categories.html", label:"Categories" },
  { href:"about.html",      label:"About"      },
];

export function esc(s) {
  return String(s ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

export function injectNav(cfg = {}) {
  // ── Inject search dropdown CSS once ──────────────────
  if (!document.getElementById("pv-nav-style")) {
    const style = document.createElement("style");
    style.id = "pv-nav-style";
    style.textContent = `
      .search-results-wrap {
        display: none;
        position: absolute; top: calc(100% + 8px); left: 0; right: 0;
        background: var(--surface, #fff);
        border: 1.5px solid var(--border2, #e5e7eb);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,.15);
        z-index: 500;
        overflow: hidden;
        max-height: 320px;
        overflow-y: auto;
      }
      .search-results-wrap.open { display: block; }
      .search-result-item {
        display: flex; align-items: center; justify-content: space-between;
        padding: 10px 14px; text-decoration: none;
        color: var(--text, #111); font-size: 13px;
        transition: background .15s;
      }
      .search-result-item:hover { background: var(--surface2, #f3f4f6); }
      .search-result-title { font-weight: 500; }
      .search-no-result { padding: 14px; font-size: 13px; color: var(--text2, #9ca3af); text-align: center; }
      .badge-premium-xs {
        font-size: 10px; padding: 2px 6px; background: #fef3c7;
        color: #b45309; border-radius: 20px; font-weight: 700; white-space: nowrap;
      }
      .app-banner {
        display: flex; align-items: center; gap: 12px;
        padding: 10px 16px;
        background: linear-gradient(135deg, #4f46e5, #7c3aed);
        color: #fff; font-size: 13px; position: relative;
      }
      .app-banner-close {
        background: none; border: none; color: rgba(255,255,255,.7);
        font-size: 16px; cursor: pointer; padding: 0 4px; flex-shrink: 0;
      }
    `;
    document.head.appendChild(style);
  }

  const navHtml = `
<nav class="navbar" role="navigation" aria-label="Main navigation">
  <div class="nav-inner">
    <a href="./index.html" class="nav-logo" aria-label="PromptVault Home">
      <div class="nav-logo-icon" aria-hidden="true">✨</div>
      <span>PromptVault</span>
    </a>
    <div class="nav-links" role="menubar">
      ${NAV_LINKS.map(l =>
        `<a href="./${l.href}" role="menuitem" ${PAGE === l.href ? 'class="active"' : ""}>${l.label}</a>`
      ).join("")}
    </div>
    <div class="nav-spacer"></div>
    <div class="nav-search" id="nav-search-wrap" style="position:relative;">
      <svg class="nav-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
      </svg>
      <input id="nav-search-input" type="search" placeholder="Search prompts…"
             aria-label="Search prompts" autocomplete="off"/>
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

<div class="mobile-nav-drawer" id="mobile-drawer" role="dialog" aria-modal="true" aria-label="Navigation">
  <div class="mobile-nav-backdrop" id="drawer-backdrop"></div>
  <div class="mobile-nav-panel">
    <button class="mobile-nav-close" id="drawer-close" aria-label="Close">✕</button>
    <div style="margin-bottom:20px;">
      <a href="./index.html" style="display:flex;align-items:center;gap:10px;font-size:18px;font-weight:800;">
        <div class="nav-logo-icon">✨</div>
        <span style="background:linear-gradient(135deg,#a78bfa,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">PromptVault</span>
      </a>
    </div>
    ${NAV_LINKS.map(l =>
      `<a href="./${l.href}" ${PAGE === l.href ? 'class="active"' : ""}>${l.label}</a>`
    ).join("")}
    <div id="mobile-auth-slot" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">
      <a href="./auth.html" style="display:flex;align-items:center;justify-content:center;padding:12px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border-radius:12px;font-size:14px;font-weight:700;text-decoration:none;">Sign In / Register</a>
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
  backdrop?.addEventListener("click",  close);
  closeBtn?.addEventListener("click",  close);

  // Search with live results
  const searchInput   = document.getElementById("nav-search-input");
  const searchResults = document.getElementById("nav-search-results");
  let timer;
  searchInput?.addEventListener("input", () => {
    clearTimeout(timer);
    const q = searchInput.value.trim();
    if (!q) { searchResults.innerHTML = ""; searchResults.classList.remove("open"); return; }
    timer = setTimeout(async () => {
      try {
        const { getPrompts } = await import("./db.js");
        const { items } = await getPrompts({ search: q });
        if (!items.length) {
          searchResults.innerHTML = `<div class="search-no-result">No results for "${esc(q)}"</div>`;
        } else {
          searchResults.innerHTML = items.slice(0, 6).map(p =>
            `<a href="./prompt.html?id=${esc(p.id)}" class="search-result-item">
               <span class="search-result-title">${esc(p.title)}</span>
               ${p.isPremium ? '<span class="badge-premium-xs">👑 PRO</span>' : ""}
             </a>`
          ).join("");
        }
        searchResults.classList.add("open");
      } catch {}
    }, 280);
  });
  document.addEventListener("click", e => {
    if (!e.target.closest("#nav-search-wrap")) {
      searchResults.classList.remove("open");
    }
  });

  // Auth-aware nav slot
  onAuthStateChanged(auth, async (user) => {
    const slot       = document.getElementById("nav-auth-slot");
    const mobileSlot = document.getElementById("mobile-auth-slot");
    if (!slot) return;

    if (!user) {
      slot.innerHTML = `<a href="./auth.html" class="btn-nav-login">Sign In</a>`;
      if (mobileSlot) mobileSlot.innerHTML = `<a href="./auth.html" style="display:flex;align-items:center;justify-content:center;padding:12px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border-radius:12px;font-size:14px;font-weight:700;text-decoration:none;">Sign In / Register</a>`;
      return;
    }

    // Load profile
    let profile = null;
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) profile = snap.data();
    } catch {}

    const name     = profile?.displayName || user.displayName || user.email?.split("@")[0] || "User";
    const coins    = profile?.coins ?? 0;
    const role     = profile?.role  || "regular";
    const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "U";
    const isPro    = role === "pro";

    slot.innerHTML = `
      <div class="nav-user-menu" id="nav-user-btn" style="cursor:pointer;position:relative;">
        <div class="nav-avatar" style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;">${esc(initials)}</div>
        ${isPro
          ? `<span style="font-size:11px;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;padding:2px 7px;border-radius:20px;font-weight:800;">PRO</span>`
          : `<span style="font-size:12px;color:var(--text2,#9ca3af);font-weight:600;">🪙 ${coins}</span>`}
        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        <div id="nav-dropdown" style="display:none;position:absolute;top:calc(100%+8px);right:0;width:210px;background:var(--surface,#fff);border:1.5px solid var(--border2,#e5e7eb);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.15);z-index:300;overflow:hidden;">
          <div style="padding:12px 14px 8px;border-bottom:1px solid var(--border,#e5e7eb);">
            <strong style="display:block;font-size:13px;color:var(--text,#111)">${esc(name)}</strong>
            <span style="font-size:11px;color:var(--text2,#9ca3af)">${esc(user.email || "")}</span>
          </div>
          <a href="./dashboard.html" style="display:block;padding:9px 14px;font-size:13px;color:var(--text,#111);text-decoration:none;transition:background .15s" onmouseover="this.style.background='var(--surface2,#f3f4f6)'" onmouseout="this.style.background=''">👤 My Dashboard</a>
          <a href="./dashboard.html#saved" style="display:block;padding:9px 14px;font-size:13px;color:var(--text,#111);text-decoration:none" onmouseover="this.style.background='var(--surface2,#f3f4f6)'" onmouseout="this.style.background=''">🔖 Saved Prompts</a>
          <a href="./dashboard.html#coins" style="display:block;padding:9px 14px;font-size:13px;color:var(--text,#111);text-decoration:none" onmouseover="this.style.background='var(--surface2,#f3f4f6)'" onmouseout="this.style.background=''">🪙 Coins: ${coins}</a>
          ${!isPro ? `<a href="./dashboard.html#upgrade" style="display:block;padding:9px 14px;font-size:13px;color:#7c3aed;font-weight:700;text-decoration:none" onmouseover="this.style.background='var(--surface2,#f3f4f6)'" onmouseout="this.style.background=''">⭐ Upgrade to Pro</a>` : ""}
          <div style="height:1px;background:var(--border,#e5e7eb);margin:4px 0;"></div>
          <button id="btn-nav-logout" style="display:block;width:100%;padding:9px 14px;font-size:13px;color:#ef4444;text-align:left;background:none;border:none;cursor:pointer;font-weight:500;" onmouseover="this.style.background='var(--surface2,#f3f4f6)'" onmouseout="this.style.background=''">Sign Out</button>
        </div>
      </div>`;

    // Dropdown toggle
    const userBtn  = document.getElementById("nav-user-btn");
    const dropdown = document.getElementById("nav-dropdown");
    userBtn?.addEventListener("click", e => {
      e.stopPropagation();
      const isOpen = dropdown.style.display === "block";
      dropdown.style.display = isOpen ? "none" : "block";
      dropdown.style.top = "calc(100% + 8px)";
    });
    document.addEventListener("click", () => {
      if (dropdown) dropdown.style.display = "none";
    });

    // Logout
    document.getElementById("btn-nav-logout")?.addEventListener("click", async () => {
      try {
        const { logout } = await import("./auth.js");
        await logout();
      } catch { window.location.href = "./index.html"; }
    });

    // Mobile slot
    if (mobileSlot) {
      mobileSlot.innerHTML = `
        <a href="./dashboard.html" style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--surface2,#f3f4f6);border-radius:12px;text-decoration:none;color:var(--text,#111);font-weight:600;font-size:14px;margin-bottom:8px;">
          <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#4f46e5,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;flex-shrink:0;">${esc(initials)}</div>
          <div>
            <div>${esc(name)}</div>
            <div style="font-size:11px;color:var(--text2,#9ca3af);">🪙 ${coins} · ${isPro ? "Pro ⭐" : "Regular"}</div>
          </div>
        </a>
        <button id="btn-mobile-logout" style="width:100%;padding:10px;background:var(--surface2,#f3f4f6);border:none;border-radius:10px;color:#ef4444;font-size:13px;font-weight:600;cursor:pointer;">Sign Out</button>`;
      document.getElementById("btn-mobile-logout")?.addEventListener("click", async () => {
        try {
          const { logout } = await import("./auth.js");
          await logout();
        } catch { window.location.href = "./index.html"; }
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
      <a href="./index.html" class="nav-logo">
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
        ${cfg.privacyPolicyUrl ? `<a href="${esc(cfg.privacyPolicyUrl)}">Privacy Policy</a>` : ""}
        ${cfg.termsUrl         ? `<a href="${esc(cfg.termsUrl)}">Terms of Service</a>`        : ""}
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
  import("./ui.js").then(({ initAppBanner: fn }) => fn(cfg)).catch(() => {});
}
