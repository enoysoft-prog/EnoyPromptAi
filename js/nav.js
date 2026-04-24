// js/nav.js — Auth-aware navigation, appended to original injectNav/injectFooter API
import { auth, onAuthStateChanged } from "./auth.js";
import { db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { getPrompts } from "./db.js";

const PAGE = window.location.pathname.split("/").pop() || "index.html";

const NAV_LINKS = [
  { href:"index.html",      label:"Home" },
  { href:"prompts.html",    label:"Prompts" },
  { href:"categories.html", label:"Categories" },
  { href:"about.html",      label:"About" },
];

function esc(s) {
  return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

export function injectNav(cfg={}) {
  const storeUrl = cfg.playStoreUrl || "#";

  // Inject search results CSS
  if (!document.getElementById("pv-nav-ext-style")) {
    const s = document.createElement("style");
    s.id = "pv-nav-ext-style";
    s.textContent = `
      .nav-user-wrap { position:relative; display:flex; align-items:center; gap:8px; }
      .nav-user-avatar {
        width:32px; height:32px; border-radius:50%;
        background:linear-gradient(135deg,#4f46e5,#7c3aed);
        color:#fff; font-size:12px; font-weight:700;
        display:flex; align-items:center; justify-content:center;
        cursor:pointer; flex-shrink:0;
      }
      .nav-user-dropdown {
        display:none; position:absolute; top:calc(100% + 10px); right:0;
        width:220px; background:var(--surface);
        border:1.5px solid var(--border2); border-radius:14px;
        box-shadow:0 12px 40px rgba(0,0,0,.4); z-index:500; overflow:hidden;
      }
      .nav-user-dropdown.open { display:block; }
      .nav-user-dropdown a, .nav-user-dropdown button {
        display:block; width:100%; padding:10px 16px; font-size:13px;
        color:var(--text); text-decoration:none; text-align:left;
        background:none; border:none; cursor:pointer; transition:background .15s;
      }
      .nav-user-dropdown a:hover, .nav-user-dropdown button:hover { background:var(--surface2); }
      .nav-user-dropdown .dd-header {
        padding:12px 16px; border-bottom:1px solid var(--border);
        font-size:12px; color:var(--text2);
      }
      .nav-user-dropdown .dd-header strong { display:block; color:var(--text); font-size:13px; margin-bottom:1px; }
      .nav-user-dropdown .dd-sep { height:1px; background:var(--border); margin:4px 0; }
      .nav-user-dropdown .dd-danger { color:#ef4444 !important; }
      .nav-coin-pill {
        font-size:11px; font-weight:700; padding:3px 8px;
        background:rgba(245,158,11,.15); color:#fbbf24;
        border:1px solid rgba(245,158,11,.3); border-radius:20px; white-space:nowrap;
      }
      .nav-pro-pill {
        font-size:11px; font-weight:800; padding:3px 8px;
        background:linear-gradient(135deg,#f59e0b,#ef4444);
        color:#fff; border-radius:20px; white-space:nowrap;
      }
      .search-results-dropdown {
        display:none; position:absolute; top:calc(100% + 6px); left:0; right:0;
        background:var(--surface); border:1.5px solid var(--border2);
        border-radius:12px; box-shadow:0 8px 32px rgba(0,0,0,.35);
        z-index:500; overflow:hidden; max-height:280px; overflow-y:auto;
      }
      .search-results-dropdown.open { display:block; }
      .search-result-item {
        display:flex; align-items:center; justify-content:space-between;
        padding:10px 14px; text-decoration:none; color:var(--text);
        font-size:13px; gap:8px; transition:background .15s;
      }
      .search-result-item:hover { background:var(--surface2); }
      .search-no-result { padding:14px; font-size:13px; color:var(--text2); text-align:center; }
    `;
    document.head.appendChild(s);
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
        `<a href="./${l.href}" role="menuitem" ${PAGE===l.href?'class="active"':""} >${l.label}</a>`
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
      <div id="nav-search-results" class="search-results-dropdown"></div>
    </div>
    <div id="nav-auth-slot" style="display:flex;align-items:center;gap:8px;">
      <a href="./auth.html" class="btn btn-primary" style="padding:7px 16px;font-size:13px;">Sign In</a>
    </div>
    ${storeUrl !== "#" ? `
    <a href="${esc(storeUrl)}" class="nav-download" aria-label="Download on Google Play">
      📱 Get App
    </a>` : ""}
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
    <button class="mobile-nav-close" id="drawer-close" aria-label="Close">✕</button>
    <a href="./index.html" style="display:flex;align-items:center;gap:10px;font-size:18px;font-weight:800;margin-bottom:20px;">
      <div class="nav-logo-icon">✨</div>
      <span style="background:linear-gradient(135deg,#a78bfa,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">PromptVault</span>
    </a>
    ${NAV_LINKS.map(l =>
      `<a href="./${l.href}" ${PAGE===l.href?'class="active"':""} >${l.label}</a>`
    ).join("")}
    <div id="mobile-auth-slot" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">
      <a href="./auth.html" style="display:flex;align-items:center;justify-content:center;padding:12px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border-radius:12px;font-size:14px;font-weight:700;text-decoration:none;">Sign In / Register</a>
    </div>
  </div>
</div>`;

  document.body.insertAdjacentHTML("afterbegin", navHtml);

  // Mobile drawer
  const open  = () => { document.getElementById("mobile-drawer").classList.add("open"); document.getElementById("nav-hamburger").setAttribute("aria-expanded","true"); document.body.style.overflow="hidden"; };
  const close = () => { document.getElementById("mobile-drawer").classList.remove("open"); document.getElementById("nav-hamburger").setAttribute("aria-expanded","false"); document.body.style.overflow=""; };
  document.getElementById("nav-hamburger")?.addEventListener("click", open);
  document.getElementById("drawer-backdrop")?.addEventListener("click", close);
  document.getElementById("drawer-close")?.addEventListener("click", close);

  // Live search
  const si = document.getElementById("nav-search-input");
  const sr = document.getElementById("nav-search-results");
  let timer;
  si?.addEventListener("input", () => {
    clearTimeout(timer);
    const q = si.value.trim();
    if (!q) { sr.innerHTML=""; sr.classList.remove("open"); return; }
    timer = setTimeout(async () => {
      try {
        const { items } = await getPrompts({ search:q });
        if (!items.length) {
          sr.innerHTML = `<div class="search-no-result">No results for "${esc(q)}"</div>`;
        } else {
          sr.innerHTML = items.slice(0,6).map(p =>
            `<a href="./prompt.html?id=${esc(p.id)}" class="search-result-item">
               <span style="font-weight:500;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(p.title)}</span>
               ${p.isPremium?`<span style="font-size:10px;padding:2px 6px;background:rgba(245,158,11,.2);color:#fbbf24;border-radius:20px;flex-shrink:0;">👑 PRO</span>`:""}
             </a>`
          ).join("");
        }
        sr.classList.add("open");
      } catch {}
    }, 280);
  });
  document.addEventListener("click", e => {
    if (!e.target.closest("#nav-search-wrap")) sr.classList.remove("open");
  });

  // Auth-aware slot
  onAuthStateChanged(auth, async user => {
    const slot = document.getElementById("nav-auth-slot");
    const mslot = document.getElementById("mobile-auth-slot");
    if (!slot) return;

    if (!user) {
      slot.innerHTML = `<a href="./auth.html" class="btn btn-primary" style="padding:7px 16px;font-size:13px;">Sign In</a>`;
      if (mslot) mslot.innerHTML = `<a href="./auth.html" style="display:flex;align-items:center;justify-content:center;padding:12px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border-radius:12px;font-size:14px;font-weight:700;text-decoration:none;">Sign In / Register</a>`;
      return;
    }
    let profile = null;
    try { const s=await getDoc(doc(db,"users",user.uid)); if(s.exists()) profile=s.data(); } catch{}
    const name     = profile?.displayName||user.displayName||user.email?.split("@")[0]||"User";
    const coins    = profile?.coins??0;
    const role     = profile?.role||"regular";
    const initials = name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2)||"U";
    const isPro    = role==="pro";

    slot.innerHTML = `
      <div class="nav-user-wrap" id="nav-user-wrap">
        ${isPro
          ? `<span class="nav-pro-pill">⭐ PRO</span>`
          : `<span class="nav-coin-pill">🪙 ${coins}</span>`}
        <div class="nav-user-avatar" id="nav-user-toggle" title="${esc(name)}">${esc(initials)}</div>
        <div class="nav-user-dropdown" id="nav-user-dropdown">
          <div class="dd-header">
            <strong>${esc(name)}</strong>
            ${esc(user.email||"")}
          </div>
          <a href="./dashboard.html">👤 Dashboard</a>
          <a href="./dashboard.html#saved">🔖 Saved Prompts</a>
          <a href="./dashboard.html#coins">🪙 Coins: ${coins}</a>
          ${!isPro?`<a href="./dashboard.html#upgrade">⭐ Upgrade to Pro</a>`:""}
          <div class="dd-sep"></div>
          <button id="btn-nav-signout" class="dd-danger">Sign Out</button>
        </div>
      </div>`;

    const toggle   = document.getElementById("nav-user-toggle");
    const dropdown = document.getElementById("nav-user-dropdown");
    toggle?.addEventListener("click", e => { e.stopPropagation(); dropdown.classList.toggle("open"); });
    document.addEventListener("click", () => dropdown?.classList.remove("open"));
    document.getElementById("btn-nav-signout")?.addEventListener("click", async () => {
      const { logout } = await import("./auth.js");
      await logout();
    });

    if (mslot) {
      mslot.innerHTML = `
        <a href="./dashboard.html" style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--surface2);border-radius:12px;text-decoration:none;margin-bottom:8px;">
          <div class="nav-user-avatar" style="flex-shrink:0">${esc(initials)}</div>
          <div style="min-width:0">
            <div style="font-size:13px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</div>
            <div style="font-size:11px;color:var(--text2)">🪙 ${coins} · ${isPro?"Pro ⭐":"Regular"}</div>
          </div>
        </a>
        <button id="mobile-signout-btn" style="width:100%;padding:10px;background:none;border:1.5px solid var(--border2);border-radius:10px;color:#ef4444;font-size:13px;font-weight:600;cursor:pointer;">Sign Out</button>`;
      document.getElementById("mobile-signout-btn")?.addEventListener("click", async () => {
        const { logout } = await import("./auth.js");
        await logout();
      });
    }
  });
}

export function injectFooter(cfg={}) {
  const year = new Date().getFullYear();
  document.body.insertAdjacentHTML("beforeend", `
<footer class="footer" role="contentinfo">
  <div class="footer-inner">
    <div class="footer-brand">
      <a href="./index.html" class="nav-logo">
        <div class="nav-logo-icon">✨</div><span>PromptVault</span>
      </a>
      <p>The best AI prompt library for Midjourney, DALL·E, ChatGPT &amp; more.</p>
    </div>
    <div class="footer-links">
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
        ${cfg.privacyPolicyUrl?`<a href="${esc(cfg.privacyPolicyUrl)}">Privacy Policy</a>`:""}
        ${cfg.termsUrl?`<a href="${esc(cfg.termsUrl)}">Terms</a>`:""}
      </div>
    </div>
  </div>
  <div class="footer-bottom">
    <p>© ${year} PromptVault · Built with ❤️ by ENOY SOFT</p>
  </div>
</footer>`);
}

export function initAppBanner(cfg={}) {
  if (!cfg.playStoreUrl || sessionStorage.getItem("pv-banner-x")) return;
  const el = document.createElement("div");
  el.className = "app-banner";
  el.innerHTML = `
    <button onclick="this.parentElement.remove();sessionStorage.setItem('pv-banner-x','1')" style="background:none;border:none;color:rgba(255,255,255,.7);font-size:18px;cursor:pointer;padding:0 4px">✕</button>
    <span style="font-size:20px">📱</span>
    <div style="flex:1"><strong style="display:block;font-size:13px">PromptVault App</strong><span style="font-size:12px;opacity:.75">Free on Google Play</span></div>
    <a href="${esc(cfg.playStoreUrl)}" style="padding:7px 14px;background:#fff;color:#4f46e5;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none;">Download</a>`;
  document.body.insertAdjacentElement("afterbegin", el);
}
