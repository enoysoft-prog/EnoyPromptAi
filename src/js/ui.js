// src/js/ui.js — UI helpers for the PromptVault user site
import { cdnUrl, formatNum, timeSince } from "./db.js";

export const esc = s => (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

// ── Category gradient ──────────────────────────────────────
export const catGradient = c => `linear-gradient(135deg,${c.gradientStart||"#3730A3"},${c.gradientEnd||"#7C3AED"})`;

// ── Prompt card — no crop, natural ratio ───────────────────
export function renderPromptCard(p, userProfile = null) {
  const imgUrl  = cdnUrl(p.imageUrl,600) || `https://picsum.photos/seed/${p.id||"x"}/600/400`;
  const locked  = p.isPremium && !isUnlockedForUser(p, userProfile);
  const isPro   = userProfile?.role === "pro" || userProfile?.role === "admin";
  const catLabel = p.subcategoryName
    ? `${esc(p.categoryName||"")} › ${esc(p.subcategoryName)}`
    : esc(p.categoryName || p.category || "");

  return `
  <article class="prompt-card" itemscope itemtype="https://schema.org/Article" data-id="${p.id}">
    <a href="./prompt.html?id=${p.id}" class="card-img-wrap" aria-label="View ${esc(p.title)}">
      <img src="${imgUrl}" alt="${esc(p.title)}" loading="lazy" itemprop="image"
           onerror="this.src='https://picsum.photos/seed/${p.id||"x"}/600/400'"/>
      <div class="card-img-overlay"></div>
      ${locked && !isPro ? `<div class="lock-overlay" aria-label="Premium prompt">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:28px;height:28px;color:rgba(255,255,255,.9)">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
        </svg>
      </div>` : ""}
      <div class="card-badges-tl">${p.isHot ? `<span class="badge badge-hot">🔥 Hot</span>` : ""}</div>
      <div class="card-badges-tr">
        ${!p.isPremium ? `<span class="badge badge-free">Free</span>`
          : isPro ? `<span class="badge badge-pro">⭐ Pro</span>`
          : `<span class="badge badge-premium">Premium</span>`}
      </div>
      ${p.tool ? `<div class="card-tool-badge"><span class="tool-badge">${esc(p.tool)}</span></div>` : ""}
    </a>
    <div class="card-body">
      ${catLabel ? `<p class="card-cat" itemprop="articleSection">${catLabel}</p>` : ""}
      <h3 class="card-title" itemprop="name"><a href="./prompt.html?id=${p.id}">${esc(p.title||"Untitled")}</a></h3>
      ${p.description ? `<p class="card-desc" itemprop="description">${esc((p.description||"").slice(0,100))}${(p.description||"").length>100?"…":""}</p>` : ""}
      <div class="card-footer">
        <div class="card-stats">
          ${p.likes ? `<span>❤ ${formatNum(p.likes)}</span>` : ""}
          ${p.views ? `<span>👁 ${formatNum(p.views)}</span>` : ""}
        </div>
        <a href="./prompt.html?id=${p.id}" class="card-btn ${locked&&!isPro?"card-btn-premium":""}" aria-label="${locked&&!isPro?"Unlock prompt":"View prompt"}">
          ${locked && !isPro ? "🔒 Unlock" : "View →"}
        </a>
      </div>
    </div>
  </article>`;
}

function isUnlockedForUser(p, profile) {
  if (!p.isPremium) return true;
  if (!profile) return false;
  if (profile.role === "admin") return true;
  if (profile.role === "pro") {
    const exp = profile.proExpiresAt?.seconds ? profile.proExpiresAt.seconds*1000 : 0;
    if (Date.now() < exp) return true;
  }
  return (profile.unlockedPrompts||[]).includes(p.id);
}

// ── Category card with real counts ────────────────────────
export function renderCategoryCard(c, stats = {}) {
  const g     = catGradient(c);
  const total = stats.total   || 0;
  const free  = stats.free    || 0;
  const prem  = stats.premium || 0;
  if (c.imageUrl) {
    return `<a href="./prompts.html?cat=${c.id}" class="cat-card cat-card-img" aria-label="${esc(c.name)} — ${total} prompts">
      <img src="${cdnUrl(c.imageUrl,400)}" alt="${esc(c.name)}" loading="lazy" onerror="this.style.display='none'"/>
      <div class="cat-card-img-overlay"></div>
      <div class="cat-card-img-content">
        <span style="font-size:1.6rem;display:block;margin-bottom:4px;">${c.emoji||"📁"}</span>
        <h3 class="cat-name">${esc(c.name)}</h3>
        <p class="cat-meta">${total} prompt${total!==1?"s":""} · ${free} free</p>
      </div>
    </a>`;
  }
  return `<a href="./prompts.html?cat=${c.id}" class="cat-card" style="background:${g}" aria-label="${esc(c.name)} — ${total} prompts">
    <span class="cat-emoji">${c.emoji||"📁"}</span>
    <h3 class="cat-name">${esc(c.name)}</h3>
    <p class="cat-meta">${total} prompt${total!==1?"s":""}</p>
    ${total>0?`<p style="font-size:11px;color:rgba(255,255,255,.55);margin-top:2px;">${free} free · ${prem} premium</p>`:""}
  </a>`;
}

// ── Skeleton cards ─────────────────────────────────────────
export const skeletonCards = (n=6) => Array(n).fill(0).map(()=>`
  <div class="prompt-card skeleton-card" aria-hidden="true">
    <div class="sk-img" style="min-height:180px;"></div>
    <div class="card-body"><div class="sk-line sk-line-sm"></div><div class="sk-line sk-line-lg"></div><div class="sk-line sk-line-md"></div></div>
  </div>`).join("");

// ── User auth indicator (for nav) ──────────────────────────
export function renderUserMenu(profile) {
  if (!profile) {
    return `<a href="./auth.html" class="nav-download" aria-label="Sign in">Sign In</a>`;
  }
  const initials = (profile.displayName||profile.email||"U").split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
  const isPro    = profile.role === "pro" || profile.role === "admin";
  const coins    = profile.coins || 0;
  return `
  <div class="user-menu-wrap" style="position:relative;">
    <button id="user-menu-btn" class="user-menu-trigger" aria-label="User menu" aria-expanded="false">
      ${profile.avatarUrl
        ? `<img src="${esc(profile.avatarUrl)}" alt="${esc(profile.displayName||"You")}" class="user-avatar-sm" onerror="this.style.display='none'"/>`
        : `<div class="user-avatar-sm user-avatar-initials">${initials}</div>`}
      <span class="user-coins-badge" aria-label="${coins} coins">🪙 ${coins}</span>
      ${isPro ? `<span class="user-pro-badge">⭐ Pro</span>` : ""}
    </button>
    <div id="user-dropdown" class="user-dropdown" role="menu" style="display:none;">
      <div class="user-dropdown-header">
        <p class="user-dropdown-name">${esc(profile.displayName||"User")}</p>
        <p class="user-dropdown-email">${esc(profile.email||"")}</p>
        <p class="user-dropdown-coins">🪙 ${coins} coins</p>
      </div>
      <a href="./profile.html" class="user-dropdown-item" role="menuitem">👤 My Profile</a>
      <a href="./saved.html"   class="user-dropdown-item" role="menuitem">❤ Saved Prompts</a>
      <a href="./submit.html"  class="user-dropdown-item" role="menuitem">📤 Submit Prompt</a>
      ${!isPro ? `<a href="./pro.html" class="user-dropdown-item user-dropdown-pro" role="menuitem">⭐ Upgrade to Pro</a>` : ""}
      <div class="user-dropdown-divider"></div>
      <button id="logout-btn" class="user-dropdown-item user-dropdown-logout" role="menuitem">🚪 Sign Out</button>
    </div>
  </div>`;
}

// ── App download banner ────────────────────────────────────
export function initAppBanner(cfg = {}) {
  if (sessionStorage.getItem("banner_dismissed")) return;
  const storeUrl = cfg.playStoreUrl || "https://play.google.com/store/apps/details?id=com.enoysoft.promptvault";
  const banner   = document.createElement("div");
  banner.id = "app-banner"; banner.className = "app-banner";
  banner.innerHTML = `
    <div class="app-banner-inner">
      <div class="app-banner-icon">✨</div>
      <div class="app-banner-text">
        <p class="app-banner-title">Get PromptVault on Android</p>
        <p class="app-banner-sub">Browse 1000+ AI prompts · Free download</p>
      </div>
      <a href="${storeUrl}" class="app-banner-btn" aria-label="Download app">Download Free</a>
      <button id="close-banner" class="app-banner-close" aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>`;
  document.body.prepend(banner);
  const h = banner.offsetHeight;
  document.documentElement.style.setProperty("--banner-h", h+"px");
  document.getElementById("close-banner")?.addEventListener("click", () => {
    banner.style.opacity="0"; banner.style.transition="opacity .3s";
    setTimeout(()=>{ banner.remove(); document.documentElement.style.setProperty("--banner-h","0px"); },300);
    sessionStorage.setItem("banner_dismissed","1");
  });
}

// ── Toast ──────────────────────────────────────────────────
export function toast(msg, type="success") {
  document.getElementById("pv-site-toast")?.remove();
  const bg={success:"#065f46",error:"#7f1d1d",info:"#1e1b4b",warn:"#78350f"}[type]||"#065f46";
  const el=document.createElement("div");
  el.id="pv-site-toast"; el.setAttribute("role","status"); el.setAttribute("aria-live","polite");
  el.style.cssText=`position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(8px);
    padding:11px 20px;border-radius:10px;font-size:13.5px;font-weight:600;background:${bg};color:#fff;
    z-index:9999;opacity:0;transition:all .25s;white-space:nowrap;box-shadow:0 8px 32px rgba(0,0,0,.3);
    max-width:90vw;text-align:center;`;
  el.textContent=msg; document.body.appendChild(el);
  setTimeout(()=>{ el.style.opacity="1"; el.style.transform="translateX(-50%) translateY(0)"; },10);
  setTimeout(()=>{ el.style.opacity="0"; setTimeout(()=>el.remove(),300); },3200);
}

// ── Copy to clipboard ──────────────────────────────────────
export function copyText(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(()=>toast("Copied to clipboard ✓"));
  } else {
    const ta=document.createElement("textarea"); ta.value=text;
    ta.style.cssText="position:fixed;opacity:0;"; document.body.appendChild(ta);
    ta.focus(); ta.select(); document.execCommand("copy"); ta.remove();
    toast("Copied ✓");
  }
}

// ── Update SEO meta tags ───────────────────────────────────
export function updateMeta({title,description,image,url}={}) {
  if (title) {
    document.title = title+" | PromptVault";
    document.querySelector('meta[property="og:title"]')?.setAttribute("content",title+" | PromptVault");
    document.querySelector('meta[name="twitter:title"]')?.setAttribute("content",title+" | PromptVault");
  }
  if (description) {
    const d=description.slice(0,155);
    ["meta[name='description']","meta[property='og:description']","meta[name='twitter:description']"]
      .forEach(s=>document.querySelector(s)?.setAttribute("content",d));
  }
  if (image) {
    document.querySelector('meta[property="og:image"]')?.setAttribute("content",image);
    document.querySelector('meta[name="twitter:image"]')?.setAttribute("content",image);
  }
  if (url) {
    document.querySelector('meta[property="og:url"]')?.setAttribute("content",url);
    document.querySelector('link[rel="canonical"]')?.setAttribute("href",url);
  }
}
