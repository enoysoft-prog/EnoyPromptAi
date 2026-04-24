// js/ui.js — Prompt cards, category cards, skeletons, toast, copy
import { cdnUrl, formatNum } from "./db.js";

export function esc(s) {
  return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ── Prompt card ───────────────────────────────────────────
export function renderPromptCard(p, userRole="guest") {
  const imgUrl  = cdnUrl(p.imageUrl, 600) || `https://picsum.photos/seed/${encodeURIComponent(p.id||"x")}/600/400`;
  const locked  = !!p.isPremium && userRole !== "pro";
  const catLabel = p.subcategoryName
    ? `${esc(p.categoryName||"")} › ${esc(p.subcategoryName)}`
    : esc(p.categoryName || p.category || "");

  return `
<article class="prompt-card" itemscope itemtype="https://schema.org/Article">
  <a href="./prompt.html?id=${esc(p.id)}" class="card-img-wrap" aria-label="${esc(p.title)}">
    <img src="${esc(imgUrl)}" alt="${esc(p.title)}" loading="lazy" itemprop="image"
         onerror="this.src='https://picsum.photos/seed/${esc(p.id||'x')}/600/400'"/>
    <div class="card-img-overlay" style="pointer-events:none;position:absolute;inset:0;background:linear-gradient(to bottom,transparent 60%,rgba(0,0,0,.6));"></div>
    ${locked?`<div class="lock-overlay"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:28px;height:28px;color:rgba(255,255,255,.9)"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg></div>`:""}
    <div class="card-badges-tl">${p.isHot?`<span class="badge badge-hot">🔥 Hot</span>`:""}</div>
    <div class="card-badges-tr">${p.isPremium?`<span class="badge badge-premium">👑 PRO</span>`:`<span class="badge badge-free">Free</span>`}</div>
  </a>
  <div class="card-body">
    ${catLabel?`<p class="card-cat" itemprop="articleSection">${catLabel}</p>`:""}
    <h3 class="card-title" itemprop="name"><a href="./prompt.html?id=${esc(p.id)}">${esc(p.title||"Untitled")}</a></h3>
    ${p.description?`<p class="card-desc" itemprop="description">${esc((p.description||"").slice(0,90))}${(p.description||"").length>90?"…":""}</p>`:""}
    <div class="card-footer">
      <div class="card-stats">
        ${p.likes?`<span>❤ ${formatNum(p.likes)}</span>`:""}
        ${p.views?`<span>👁 ${formatNum(p.views)}</span>`:""}
      </div>
      <a href="./prompt.html?id=${esc(p.id)}" class="card-btn ${locked?"card-btn-premium":""}">${locked?"🔒 Unlock":"View →"}</a>
    </div>
  </div>
</article>`;
}

// ── Category card ─────────────────────────────────────────
export function renderCategoryCard(c, stats={}) {
  const g     = `linear-gradient(135deg,${c.gradientStart||"#3730A3"},${c.gradientEnd||"#7C3AED"})`;
  // FIX: support both {total,free,premium} object AND plain number
  const total   = typeof stats==="number" ? stats : (stats.total||0);
  const premium = typeof stats==="number" ? 0      : (stats.premium||0);

  if (c.imageUrl) {
    return `
<a href="./prompts.html?cat=${esc(c.id)}" class="cat-card" style="background:${g}">
  <img src="${esc(cdnUrl(c.imageUrl,400)||c.imageUrl)}" alt="${esc(c.name)}"
       style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.35;border-radius:inherit;" loading="lazy"
       onerror="this.remove()"/>
  <div style="position:relative;z-index:1">
    ${c.icon?`<div style="font-size:2rem;margin-bottom:8px">${esc(c.icon)}</div>`:""}
    <h3 style="font-size:15px;font-weight:800;color:#fff;margin-bottom:4px">${esc(c.name)}</h3>
    <p style="font-size:12px;color:rgba(255,255,255,.7)">${total} prompts${premium?` · 👑 ${premium}`:""}</p>
  </div>
</a>`;
  }
  return `
<a href="./prompts.html?cat=${esc(c.id)}" class="cat-card" style="background:${g}">
  ${c.icon?`<div style="font-size:2.5rem;margin-bottom:10px">${esc(c.icon)}</div>`:""}
  <h3 style="font-size:15px;font-weight:800;color:#fff;margin-bottom:4px">${esc(c.name)}</h3>
  ${c.description?`<p style="font-size:12px;color:rgba(255,255,255,.7);margin-bottom:8px">${esc(c.description.slice(0,60))}…</p>`:""}
  <p style="font-size:12px;color:rgba(255,255,255,.8);font-weight:600">${total} prompts${premium?` · 👑 ${premium}`:""}</p>
</a>`;
}

// ── Skeleton cards ────────────────────────────────────────
export function skeletonCards(n=6) {
  return Array(n).fill(`
<div class="prompt-card skeleton-card" aria-hidden="true">
  <div style="background:var(--surface2);height:200px;border-radius:12px 12px 0 0;animation:sk-pulse 1.5s infinite"></div>
  <div style="padding:16px">
    <div style="height:11px;width:40%;background:var(--surface2);border-radius:6px;margin-bottom:10px;animation:sk-pulse 1.5s infinite"></div>
    <div style="height:14px;width:85%;background:var(--surface2);border-radius:6px;margin-bottom:8px;animation:sk-pulse 1.5s infinite"></div>
    <div style="height:12px;width:65%;background:var(--surface2);border-radius:6px;animation:sk-pulse 1.5s infinite"></div>
  </div>
</div>`).join("");
}

// ── Toast ─────────────────────────────────────────────────
export function toast(msg, type="success", duration=3500) {
  if (!document.getElementById("pv-toast-style")) {
    const s=document.createElement("style"); s.id="pv-toast-style";
    s.textContent=`@keyframes pvToastIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`;
    document.head.appendChild(s);
  }
  let wrap = document.getElementById("pv-toasts");
  if (!wrap) {
    wrap=document.createElement("div"); wrap.id="pv-toasts";
    wrap.style.cssText="position:fixed;bottom:20px;right:16px;z-index:99999;display:flex;flex-direction:column;gap:8px;max-width:320px;";
    document.body.appendChild(wrap);
  }
  const c={success:"#10b981",error:"#ef4444",info:"#6366f1",warning:"#f59e0b"};
  const i={success:"✓",error:"✕",info:"ℹ",warning:"⚠"};
  const el=document.createElement("div");
  el.style.cssText=`display:flex;align-items:center;gap:10px;padding:11px 16px;background:#1e293b;color:#fff;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.3);font-size:13.5px;font-weight:500;border-left:4px solid ${c[type]||c.info};animation:pvToastIn .25s ease;`;
  el.innerHTML=`<span style="color:${c[type]||c.info};font-size:15px;flex-shrink:0">${i[type]||"•"}</span><span>${esc(msg)}</span>`;
  wrap.appendChild(el);
  setTimeout(()=>{el.style.transition="opacity .3s";el.style.opacity="0";setTimeout(()=>el.remove(),300);},duration);
}

// ── Copy to clipboard ─────────────────────────────────────
export async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    if (btn) { const o=btn.textContent; btn.textContent="✓ Copied!"; setTimeout(()=>btn.textContent=o,2000); }
    toast("Copied to clipboard!");
    return true;
  } catch {
    // Fallback
    const ta=document.createElement("textarea"); ta.value=text;
    ta.style.cssText="position:fixed;opacity:0;pointer-events:none";
    document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    if (btn) { const o=btn.textContent; btn.textContent="✓ Copied!"; setTimeout(()=>btn.textContent=o,2000); }
    toast("Copied!"); return true;
  }
}

// ── App banner ────────────────────────────────────────────
export function initAppBanner(cfg={}) {
  if (!cfg.playStoreUrl || sessionStorage.getItem("pv-banner-x")) return;
  const el=document.createElement("div"); el.className="app-banner";
  el.innerHTML=`<button onclick="this.parentElement.remove();sessionStorage.setItem('pv-banner-x','1')" style="background:none;border:none;color:rgba(255,255,255,.7);font-size:18px;cursor:pointer">✕</button>
    <span style="font-size:20px">📱</span>
    <div style="flex:1"><strong style="display:block;font-size:13px">PromptVault App</strong><span style="font-size:12px;opacity:.75">Free on Google Play</span></div>
    <a href="${esc(cfg.playStoreUrl)}" style="padding:7px 14px;background:#fff;color:#4f46e5;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none;">Download</a>`;
  document.body.insertAdjacentElement("afterbegin", el);
}
