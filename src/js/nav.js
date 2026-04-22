// src/js/nav.js — Auth-aware navbar + footer
import { getAppConfig, searchPrompts, cdnUrl } from "./db.js";
import { onUserChange, logout } from "./auth.js";
import { renderUserMenu, esc, toast } from "./ui.js";

const PAGE = window.location.pathname.split("/").pop() || "index.html";

const NAV_LINKS = [
  { href:"index.html",     label:"Home" },
  { href:"prompts.html",   label:"Prompts" },
  { href:"categories.html",label:"Categories" },
  { href:"about.html",     label:"About" },
];

let _currentProfile = null;

export async function injectNav(cfg = {}) {
  const storeUrl = cfg.playStoreUrl || "https://play.google.com/store/apps/details?id=com.enoysoft.promptvault";

  const html = `
  <nav class="navbar" role="navigation" aria-label="Main navigation">
    <div class="nav-inner">
      <a href="./index.html" class="nav-logo" aria-label="PromptVault Home">
        <div class="nav-logo-icon">✨</div><span>PromptVault</span>
      </a>
      <div class="nav-links" role="menubar">
        ${NAV_LINKS.map(l=>`<a href="./${l.href}" role="menuitem" ${PAGE===l.href?'class="active"':''}>${l.label}</a>`).join("")}
      </div>
      <div class="nav-spacer"></div>
      <div style="position:relative;" id="nav-search-wrap">
        <svg class="nav-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input id="nav-search-input" type="search" placeholder="Search prompts…" aria-label="Search prompts" autocomplete="off" class="nav-search-input"/>
        <div id="nav-search-results" class="search-results-wrap" role="listbox"></div>
      </div>
      <div id="nav-user-area">
        <a href="./auth.html" class="nav-download">Sign In</a>
      </div>
      <button class="nav-hamburger" id="nav-hamburger" aria-label="Open menu" aria-expanded="false">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>
    </div>
  </nav>
  <div class="mobile-nav-drawer" id="mobile-drawer">
    <div class="mobile-nav-backdrop" id="drawer-backdrop"></div>
    <div class="mobile-nav-panel" id="drawer-panel">
      <button class="mobile-nav-close" id="drawer-close" aria-label="Close menu"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
      <div style="margin-bottom:20px;"><a href="./index.html" style="display:flex;align-items:center;gap:10px;font-size:18px;font-weight:800;"><div class="nav-logo-icon">✨</div><span style="background:linear-gradient(135deg,#a78bfa,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">PromptVault</span></a></div>
      <div style="padding:10px 0 14px;border-bottom:1px solid var(--border);margin-bottom:10px;">
        <input id="drawer-search" type="search" placeholder="Search prompts…" autocomplete="off" style="width:100%;background:var(--surface2);border:1.5px solid var(--border2);border-radius:10px;padding:10px 14px;font-size:14px;color:var(--text);outline:none;" aria-label="Search"/>
      </div>
      ${NAV_LINKS.map(l=>`<a href="./${l.href}" ${PAGE===l.href?'class="active"':''}>${l.label}</a>`).join("")}
      <div id="mobile-user-section" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">
        <a href="./auth.html" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border-radius:10px;font-size:14px;font-weight:700;">Sign In / Register</a>
      </div>
      <div style="margin-top:auto;padding-top:20px;border-top:1px solid var(--border);margin-top:20px;">
        <a href="${storeUrl}" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;background:var(--surface2);border:1px solid var(--border2);color:var(--text);border-radius:10px;font-size:13.5px;font-weight:600;">📱 Download App</a>
      </div>
    </div>
  </div>`;

  document.body.insertAdjacentHTML("afterbegin", html);

  // Mobile drawer
  const hamburger = document.getElementById("nav-hamburger");
  const drawer    = document.getElementById("mobile-drawer");
  const open  = ()=>{ drawer.classList.add("open"); hamburger.setAttribute("aria-expanded","true"); document.body.style.overflow="hidden"; };
  const close = ()=>{ drawer.classList.remove("open"); hamburger.setAttribute("aria-expanded","false"); document.body.style.overflow=""; };
  hamburger?.addEventListener("click",open);
  document.getElementById("drawer-backdrop")?.addEventListener("click",close);
  document.getElementById("drawer-close")?.addEventListener("click",close);
  document.addEventListener("keydown",e=>{ if(e.key==="Escape") close(); });
  document.getElementById("drawer-search")?.addEventListener("keydown",e=>{
    if(e.key==="Enter"&&e.target.value.trim()) window.location.href=`./prompts.html?q=${encodeURIComponent(e.target.value.trim())}`;
  });

  initNavSearch();
  initUserMenu();
}

function initUserMenu() {
  onUserChange((user, profile) => {
    _currentProfile = profile;
    const area    = document.getElementById("nav-user-area");
    const mobile  = document.getElementById("mobile-user-section");
    if (!area) return;

    area.innerHTML = renderUserMenu(profile);

    if (mobile) {
      if (profile) {
        mobile.innerHTML = `
          <a href="./profile.html" style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--surface2);border-radius:10px;font-size:14px;font-weight:600;color:var(--text);margin-bottom:8px;">👤 My Profile</a>
          <a href="./pro.html" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:10px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border-radius:10px;font-size:13.5px;font-weight:700;margin-bottom:8px;">⭐ ${profile.role==="pro"?"Pro Member":"Upgrade to Pro"}</a>
          <button id="mobile-logout" style="width:100%;padding:10px;background:transparent;border:1.5px solid var(--border2);border-radius:10px;font-size:13.5px;color:var(--text2);cursor:pointer;">🚪 Sign Out</button>`;
        document.getElementById("mobile-logout")?.addEventListener("click", handleLogout);
      } else {
        mobile.innerHTML = `<a href="./auth.html" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border-radius:10px;font-size:14px;font-weight:700;">Sign In / Register</a>`;
      }
    }

    // Dropdown toggle
    const btn = document.getElementById("user-menu-btn");
    const dd  = document.getElementById("user-dropdown");
    if (btn && dd) {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        const open = dd.style.display !== "none";
        dd.style.display = open ? "none" : "block";
        btn.setAttribute("aria-expanded", String(!open));
      });
      document.addEventListener("click", () => { dd.style.display="none"; btn.setAttribute("aria-expanded","false"); });
      dd.addEventListener("click", e => e.stopPropagation());
    }

    document.getElementById("logout-btn")?.addEventListener("click", handleLogout);
  });
}

async function handleLogout() {
  await logout();
  toast("Signed out successfully");
  setTimeout(() => window.location.href="./index.html", 800);
}

function initNavSearch() {
  const input   = document.getElementById("nav-search-input");
  const results = document.getElementById("nav-search-results");
  if (!input || !results) return;
  let timer;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { results.classList.remove("open"); return; }
    timer = setTimeout(async () => {
      try {
        const items = await searchPrompts(q);
        results.innerHTML = (!items.length)
          ? `<div style="padding:14px 16px;font-size:13px;color:var(--text3);">No results for "${esc(q)}"</div>`
          : items.slice(0,6).map(p=>`
            <div class="search-result-item" onclick="window.location.href='./prompt.html?id=${p.id}'" role="option" tabindex="0">
              <img class="search-result-img" src="${cdnUrl(p.imageUrl,80)||'https://placehold.co/40x40/1a1a2e/fff?text=?'}" alt="${esc(p.title)}" loading="lazy" onerror="this.src='https://placehold.co/40x40/1a1a2e/fff?text=?'"/>
              <div class="search-result-info">
                <p class="search-result-title">${esc(p.title)}</p>
                <p class="search-result-cat">${esc(p.categoryName||"")}${p.tool?" · "+esc(p.tool):""}</p>
              </div>
              <span class="badge ${p.isPremium?"badge-premium":"badge-free"} search-result-badge">${p.isPremium?"Premium":"Free"}</span>
            </div>`).join("")
            + `<div style="padding:10px 14px;border-top:1px solid var(--border);"><a href="./prompts.html?q=${encodeURIComponent(q)}" style="font-size:12.5px;color:var(--accent);font-weight:600;">See all results →</a></div>`;
        results.classList.add("open");
      } catch(e) {}
    }, 350);
  });
  input.addEventListener("keydown", e => {
    if (e.key==="Enter"&&input.value.trim()) { results.classList.remove("open"); window.location.href=`./prompts.html?q=${encodeURIComponent(input.value.trim())}`; }
    if (e.key==="Escape") { results.classList.remove("open"); input.blur(); }
  });
  document.addEventListener("click", e => { if(!document.getElementById("nav-search-wrap")?.contains(e.target)) results.classList.remove("open"); });
}

export function injectFooter(cfg = {}) {
  const storeUrl = cfg.playStoreUrl || "https://play.google.com/store/apps/details?id=com.enoysoft.promptvault";
  const year     = new Date().getFullYear();
  document.body.insertAdjacentHTML("beforeend", `
  <button class="scroll-top-btn" id="scroll-top" aria-label="Scroll to top"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 15l7-7 7 7"/></svg></button>
  <footer class="footer" role="contentinfo">
    <div class="footer-inner">
      <div class="footer-brand">
        <div class="footer-logo"><div class="footer-logo-icon">✨</div><span style="background:linear-gradient(135deg,#a78bfa,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">PromptVault</span></div>
        <p class="footer-desc">Discover, save and use the best AI prompts for Midjourney, DALL·E 3, Claude, ChatGPT and more.</p>
        <a href="${storeUrl}" class="footer-app-badge">📱 Download on Google Play</a>
      </div>
      <div><p class="footer-col-title">Browse</p>
        <nav class="footer-links"><a href="./prompts.html">All Prompts</a><a href="./categories.html">Categories</a><a href="./prompts.html?type=free">Free Prompts</a><a href="./prompts.html?type=hot">🔥 Trending</a></nav></div>
      <div><p class="footer-col-title">Account</p>
        <nav class="footer-links"><a href="./auth.html">Sign In / Register</a><a href="./profile.html">My Profile</a><a href="./saved.html">Saved Prompts</a><a href="./submit.html">Submit a Prompt</a><a href="./pro.html">⭐ Go Pro</a></nav></div>
      <div><p class="footer-col-title">Company</p>
        <nav class="footer-links"><a href="./about.html">About Us</a><a href="${cfg.privacyPolicyUrl||'#'}">Privacy Policy</a><a href="${cfg.termsUrl||'#'}">Terms of Service</a><a href="mailto:${cfg.contactEmail||'enoysoft@gmail.com'}">Contact</a></nav></div>
    </div>
    <div class="footer-bottom">
      <p class="footer-copy">© ${year} PromptVault by ENOY SOFT. All rights reserved.</p>
    </div>
  </footer>`);
  const btn=document.getElementById("scroll-top");
  if(btn){ window.addEventListener("scroll",()=>btn.classList.toggle("visible",window.scrollY>400)); btn.addEventListener("click",()=>window.scrollTo({top:0,behavior:"smooth"})); }
}
