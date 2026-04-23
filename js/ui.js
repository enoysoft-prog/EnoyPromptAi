// js/ui.js — UI helpers: cards, skeletons, toasts, modals, copy

import { formatNum } from "./db.js";

export function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Prompt card ───────────────────────────────────────────
/**
 * @param {object} p - prompt data
 * @param {string} userRole - "guest" | "regular" | "pro"
 */
export function renderPromptCard(p, userRole = "guest") {
  const imgUrl    = p.imageUrl || `https://picsum.photos/seed/${encodeURIComponent(p.id || "x")}/600/400`;
  const isPremium = !!p.isPremium;
  const locked    = isPremium && userRole !== "pro";
  const catLabel  = p.subcategoryName
    ? `${esc(p.categoryName || "")} › ${esc(p.subcategoryName)}`
    : esc(p.categoryName || p.category || "");

  return `
<article class="prompt-card" itemscope itemtype="https://schema.org/Article">
  <a href="./prompt.html?id=${esc(p.id)}" class="card-img-wrap" aria-label="${esc(p.title)}">
    <img src="${esc(imgUrl)}" alt="${esc(p.title)}" loading="lazy" itemprop="image"
         onerror="this.src='https://picsum.photos/seed/${esc(p.id || 'x')}/600/400'"/>
    <div class="card-img-overlay"></div>
    ${locked ? `<div class="lock-overlay" aria-label="Premium prompt">🔒</div>` : ""}
    <div class="card-badges-tl">
      ${p.isHot ? `<span class="badge badge-hot">🔥 Hot</span>` : ""}
    </div>
    <div class="card-badges-tr">
      ${isPremium
        ? `<span class="badge badge-premium">👑 PRO</span>`
        : `<span class="badge badge-free">Free</span>`}
    </div>
  </a>
  <div class="card-body">
    ${catLabel ? `<p class="card-cat" itemprop="articleSection">${catLabel}</p>` : ""}
    <h3 class="card-title" itemprop="name">
      <a href="./prompt.html?id=${esc(p.id)}">${esc(p.title || "Untitled")}</a>
    </h3>
    ${p.description
      ? `<p class="card-desc" itemprop="description">${esc((p.description || "").slice(0, 100))}${(p.description || "").length > 100 ? "…" : ""}</p>`
      : ""}
    <div class="card-footer">
      <div class="card-stats">
        ${p.likes ? `<span>❤ ${formatNum(p.likes)}</span>` : ""}
        ${p.views ? `<span>👁 ${formatNum(p.views)}</span>` : ""}
      </div>
      <a href="./prompt.html?id=${esc(p.id)}"
         class="card-btn ${locked ? "card-btn-premium" : ""}">
        ${locked ? "🔒 Unlock" : "View →"}
      </a>
    </div>
  </div>
</article>`;
}

// ── Category card ─────────────────────────────────────────
/**
 * FIX: stats can be { total, free, premium } object OR plain number — handle both
 */
export function renderCategoryCard(c, stats = {}) {
  const gradient = `linear-gradient(135deg,${c.gradientStart || "#3730A3"},${c.gradientEnd || "#7C3AED"})`;
  // Handle both plain number (legacy) and {total,free,premium} object
  const total   = typeof stats === "number" ? stats : (stats.total   || 0);
  const premium = typeof stats === "number" ? 0      : (stats.premium || 0);

  return `
<a href="./prompts.html?cat=${esc(c.id)}" class="cat-card" style="background:${gradient}"
   itemprop="url" aria-label="${esc(c.name)} — ${total} prompts">
  ${c.imageUrl ? `<img src="${esc(c.imageUrl)}" alt="${esc(c.name)}" class="cat-card-img" loading="lazy"/>` : ""}
  <div class="cat-card-body">
    ${c.icon ? `<div class="cat-icon" aria-hidden="true">${esc(c.icon)}</div>` : ""}
    <h3 class="cat-name" itemprop="name">${esc(c.name)}</h3>
    ${c.description ? `<p class="cat-desc">${esc(c.description)}</p>` : ""}
    <div class="cat-stats">
      <span>${total} prompts</span>
      ${premium ? `<span class="badge badge-premium-xs">👑 ${premium}</span>` : ""}
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
    <div class="skeleton sk-text sk-sm" style="width:40%"></div>
    <div class="skeleton sk-text" style="width:85%"></div>
    <div class="skeleton sk-text sk-md" style="width:65%"></div>
  </div>
</div>`).join("");
}

export function skeletonCatCards(n = 8) {
  return Array(n).fill(
    `<div class="cat-card" style="background:#e5e7eb;"><div class="skeleton" style="height:100%;min-height:140px;border-radius:16px;"></div></div>`
  ).join("");
}

// ── Toast ─────────────────────────────────────────────────
let _toastWrap;
function getWrap() {
  if (!_toastWrap || !document.body.contains(_toastWrap)) {
    _toastWrap = document.createElement("div");
    _toastWrap.style.cssText =
      "position:fixed;bottom:20px;right:16px;z-index:99999;display:flex;flex-direction:column;gap:8px;max-width:340px;";
    document.body.appendChild(_toastWrap);
  }
  return _toastWrap;
}

export function toast(msg, type = "success", duration = 3500) {
  const wrap  = getWrap();
  const colors = { success:"#10b981", error:"#ef4444", info:"#6366f1", warning:"#f59e0b" };
  const icons  = { success:"✓", error:"✕", info:"ℹ", warning:"⚠" };
  const el     = document.createElement("div");
  el.style.cssText = `
    display:flex;align-items:center;gap:10px;padding:12px 16px;
    background:#1e293b;color:#fff;border-radius:12px;
    box-shadow:0 8px 24px rgba(0,0,0,.25);font-size:14px;font-weight:500;
    border-left:4px solid ${colors[type] || colors.info};
    animation:pvToastIn .25s ease;word-break:break-word;`;
  el.innerHTML = `<span style="color:${colors[type]||colors.info};font-size:16px;flex-shrink:0">${icons[type] || "•"}</span><span>${esc(msg)}</span>`;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .3s";
    el.style.opacity    = "0";
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// ── Modal helpers ─────────────────────────────────────────
export function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add("open"); document.body.style.overflow = "hidden"; }
}
export function closeModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove("open"); document.body.style.overflow = ""; }
}

// ── Clipboard ─────────────────────────────────────────────
export async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = "✓ Copied!";
      setTimeout(() => { btn.textContent = orig; }, 2000);
    }
    toast("Copied to clipboard!");
    return true;
  } catch {
    // Fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0;";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = "✓ Copied!";
      setTimeout(() => { btn.textContent = orig; }, 2000);
    }
    toast("Copied!");
    return true;
  }
}

// ── App banner ────────────────────────────────────────────
export function initAppBanner(cfg = {}) {
  if (!cfg.playStoreUrl || sessionStorage.getItem("pv-banner-closed")) return;
  const el = document.createElement("div");
  el.className = "app-banner";
  el.innerHTML = `
    <button class="app-banner-close" aria-label="Close">✕</button>
    <span style="font-size:22px">📱</span>
    <div style="flex:1;min-width:0">
      <strong style="display:block;font-size:13px">Get the App</strong>
      <span style="font-size:12px;opacity:.75">Free on Google Play</span>
    </div>
    <a href="${esc(cfg.playStoreUrl)}" style="padding:8px 14px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none;flex-shrink:0">Download</a>`;
  document.body.insertAdjacentElement("afterbegin", el);
  el.querySelector(".app-banner-close").addEventListener("click", () => {
    el.remove();
    sessionStorage.setItem("pv-banner-closed", "1");
  });
}

// ── Inject toast animation CSS once ──────────────────────
(function() {
  if (document.getElementById("pv-toast-style")) return;
  const s = document.createElement("style");
  s.id = "pv-toast-style";
  s.textContent = "@keyframes pvToastIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}";
  document.head.appendChild(s);
})();
