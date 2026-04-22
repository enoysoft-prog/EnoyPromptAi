// js/ui.js — UI helpers: cards, skeletons, toast, modals

import { formatNum } from "./db.js";

export function esc(s) {
  return String(s ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

export function catGradient(c) {
  return `linear-gradient(135deg,${c.gradientStart||"#3730A3"},${c.gradientEnd||"#7C3AED"})`;
}

// ── Prompt card ───────────────────────────────────────────
export function renderPromptCard(p, userRole = "guest") {
  const imgUrl = p.imageUrl || `https://picsum.photos/seed/${p.id||"x"}/600/400`;
  const locked = p.isPremium && userRole !== "pro";
  const catLabel = p.subcategoryName
    ? `${esc(p.categoryName||"")} › ${esc(p.subcategoryName)}`
    : esc(p.categoryName || p.category || "");

  return `
  <article class="prompt-card" itemscope itemtype="https://schema.org/Article">
    <a href="./prompt.html?id=${esc(p.id)}" class="card-img-wrap" aria-label="View ${esc(p.title)}">
      <img src="${esc(imgUrl)}" alt="${esc(p.title)}" loading="lazy" itemprop="image"
           onerror="this.src='https://picsum.photos/seed/${esc(p.id||'x')}/600/400'"/>
      <div class="card-img-overlay"></div>
      ${locked ? `<div class="lock-overlay" aria-label="Premium prompt">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:28px;height:28px;color:rgba(255,255,255,.9)">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
        </svg></div>` : ""}
      <div class="card-badges-tl">
        ${p.isHot ? `<span class="badge badge-hot">🔥 Hot</span>` : ""}
      </div>
      <div class="card-badges-tr">
        ${p.isPremium ? `<span class="badge badge-premium">👑 PRO</span>` : `<span class="badge badge-free">Free</span>`}
      </div>
    </a>
    <div class="card-body">
      ${catLabel ? `<p class="card-cat" itemprop="articleSection">${catLabel}</p>` : ""}
      <h3 class="card-title" itemprop="name">
        <a href="./prompt.html?id=${esc(p.id)}">${esc(p.title||"Untitled")}</a>
      </h3>
      ${p.description ? `<p class="card-desc" itemprop="description">${esc((p.description||"").slice(0,100))}${(p.description||"").length>100?"…":""}</p>` : ""}
      <div class="card-footer">
        <div class="card-stats">
          ${p.likes ? `<span>❤ ${formatNum(p.likes)}</span>` : ""}
          ${p.views ? `<span>👁 ${formatNum(p.views)}</span>` : ""}
        </div>
        <a href="./prompt.html?id=${esc(p.id)}" class="card-btn ${locked?"card-btn-premium":""}">
          ${locked ? "🔒 Unlock" : "View →"}
        </a>
      </div>
    </div>
  </article>`;
}

// ── Category card ─────────────────────────────────────────
export function renderCategoryCard(c, stats = {}) {
  const g     = catGradient(c);
  const total = stats.total || 0;
  const free  = stats.free  || 0;
  const prem  = stats.premium || 0;

  return `
  <a href="./prompts.html?cat=${esc(c.id)}" class="cat-card" style="background:${g}" itemprop="url" aria-label="${esc(c.name)} prompts — ${total} total">
    ${c.imageUrl ? `<img src="${esc(c.imageUrl)}" alt="${esc(c.name)}" class="cat-card-img" loading="lazy"/>` : ""}
    <div class="cat-card-body">
      ${c.icon ? `<div class="cat-icon" aria-hidden="true">${esc(c.icon)}</div>` : ""}
      <h3 class="cat-name" itemprop="name">${esc(c.name)}</h3>
      ${c.description ? `<p class="cat-desc">${esc(c.description)}</p>` : ""}
      <div class="cat-stats">
        <span>${total} prompts</span>
        ${prem ? `<span class="badge badge-premium-xs">👑 ${prem}</span>` : ""}
      </div>
    </div>
  </a>`;
}

// ── Skeleton loaders ──────────────────────────────────────
export function skeletonCards(n = 6) {
  return Array(n).fill(`
    <div class="prompt-card skeleton-card">
      <div class="skeleton sk-img"></div>
      <div class="card-body">
        <div class="skeleton sk-text sk-sm"></div>
        <div class="skeleton sk-text"></div>
        <div class="skeleton sk-text sk-md"></div>
      </div>
    </div>`).join("");
}

export function skeletonCatCards(n = 8) {
  return Array(n).fill(`<div class="cat-card skeleton-card"><div class="skeleton" style="height:160px;border-radius:16px;"></div></div>`).join("");
}

// ── Toast notifications ───────────────────────────────────
let _toastContainer;
function getToastContainer() {
  if (!_toastContainer) {
    _toastContainer = document.createElement("div");
    _toastContainer.id = "toast-container";
    _toastContainer.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;";
    document.body.appendChild(_toastContainer);
  }
  return _toastContainer;
}

export function toast(msg, type = "success", duration = 3500) {
  const container = getToastContainer();
  const colors = {
    success: "#10b981",
    error:   "#ef4444",
    info:    "#6366f1",
    warning: "#f59e0b"
  };
  const icons = { success:"✓", error:"✕", info:"ℹ", warning:"⚠" };
  const el = document.createElement("div");
  el.style.cssText = `
    display:flex;align-items:center;gap:10px;padding:12px 18px;
    background:#1e293b;color:#fff;border-radius:12px;
    box-shadow:0 8px 24px rgba(0,0,0,.25);font-size:14px;font-weight:500;
    border-left:4px solid ${colors[type]||colors.info};
    animation:toastIn .25s ease;max-width:320px;`;
  el.innerHTML = `<span style="color:${colors[type]||colors.info};font-size:16px;">${icons[type]||"•"}</span><span>${esc(msg)}</span>`;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity="0"; el.style.transition="opacity .3s"; setTimeout(()=>el.remove(), 300); }, duration);
}

// ── Modal helpers ─────────────────────────────────────────
export function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add("open"); document.body.style.overflow="hidden"; }
}
export function closeModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove("open"); document.body.style.overflow=""; }
}
export function closeAllModals() {
  document.querySelectorAll(".modal.open").forEach(m => {
    m.classList.remove("open");
  });
  document.body.style.overflow="";
}

// ── Copy to clipboard ─────────────────────────────────────
export async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = "✓ Copied!";
      setTimeout(() => { btn.innerHTML = orig; }, 2000);
    }
    toast("Copied to clipboard!");
    return true;
  } catch {
    toast("Copy failed — try manually", "error");
    return false;
  }
}

// ── Coin display widget ───────────────────────────────────
export function renderCoinWidget(coins, role) {
  const badge = role === "pro"
    ? `<span class="coin-pro-badge">⭐ PRO</span>`
    : `<span class="coin-count">🪙 ${coins} coins</span>`;
  return `<div class="coin-widget">${badge}</div>`;
}

// ── Add CSS animation if not already present ──────────────
if (!document.getElementById("toast-style")) {
  const s = document.createElement("style");
  s.id = "toast-style";
  s.textContent = "@keyframes toastIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}";
  document.head.appendChild(s);
}
