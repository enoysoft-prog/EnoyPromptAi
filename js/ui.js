// js/ui.js — Fixed: all helpers stable and mobile-safe

export function toast(msg, type = "success") {
  document.getElementById("pv-toast")?.remove();
  const bg = { success:"#16a34a", error:"#dc2626", info:"#4f46e5", warn:"#d97706" }[type] || "#16a34a";
  const icons = {
    success: `<svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="width:16px;height:16px;flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`,
    error:   `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="width:16px;height:16px;flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>`,
    info:    `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="width:16px;height:16px;flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01"/></svg>`,
    warn:    `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="width:16px;height:16px;flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01"/></svg>`
  };
  const el = document.createElement("div");
  el.id = "pv-toast";
  el.style.cssText = `position:fixed;bottom:20px;left:16px;right:16px;max-width:420px;margin:0 auto;z-index:99999;
    display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:12px;color:#fff;
    font-size:13.5px;font-weight:500;box-shadow:0 8px 32px rgba(0,0,0,.22);background:${bg};
    opacity:0;transform:translateY(6px);transition:all .25s;`;
  el.innerHTML = `${icons[type] || icons.info}<span>${msg}</span>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "translateY(0)"; });
  setTimeout(() => {
    el.style.opacity = "0"; el.style.transform = "translateY(6px)";
    setTimeout(() => el.remove(), 280);
  }, 3600);
}

export function confirm(msg, onOk, okLabel = "Delete", danger = true) {
  document.getElementById("pv-confirm")?.remove();
  const el = document.createElement("div");
  el.id = "pv-confirm";
  el.style.cssText = `position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.55);
    backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px;`;
  el.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:24px;max-width:360px;width:100%;
         box-shadow:0 24px 64px rgba(0,0,0,.22);text-align:center;">
      <div style="width:44px;height:44px;background:${danger ? "#fee2e2" : "#e0e7ff"};border-radius:50%;
           display:flex;align-items:center;justify-content:center;margin:0 auto 12px;">
        <svg style="width:20px;height:20px;color:${danger ? "#dc2626" : "#4f46e5"};" fill="none"
             stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          ${danger
            ? `<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>`
            : `<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>`}
        </svg>
      </div>
      <p style="font-size:13.5px;color:#4b5563;margin-bottom:20px;line-height:1.55;">${msg}</p>
      <div style="display:flex;gap:10px;">
        <button id="pvc-cancel" style="flex:1;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;
          font-size:13.5px;font-weight:500;cursor:pointer;background:#fff;color:#374151;">Cancel</button>
        <button id="pvc-ok" style="flex:1;padding:10px;border:none;border-radius:10px;font-size:13.5px;
          font-weight:600;cursor:pointer;background:${danger ? "#dc2626" : "#4f46e5"};color:#fff;">${okLabel}</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  document.getElementById("pvc-cancel").onclick = () => el.remove();
  document.getElementById("pvc-ok").onclick = () => { el.remove(); onOk(); };
  el.addEventListener("click", e => { if (e.target === el) el.remove(); });
}

export function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.style.display = "flex";
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() => { requestAnimationFrame(() => m.classList.add("modal-open")); });
}

export function closeModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove("modal-open");
  document.body.style.overflow = "";
  setTimeout(() => { m.style.display = "none"; }, 220);
}

export function btnLoad(btn, loading, orig) {
  if (!btn) return;
  if (loading) {
    btn.disabled = true;
    btn.innerHTML = `<svg class="animate-spin inline w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Saving…`;
  } else { btn.disabled = false; btn.innerHTML = orig; }
}

export function skeleton(tbody, cols = 5, rows = 4) {
  tbody.innerHTML = Array(rows).fill(0).map(() =>
    `<tr class="border-b border-gray-100">${Array(cols).fill(0).map(() =>
      `<td class="px-4 py-3.5"><div class="h-3.5 bg-gray-200 rounded animate-pulse"
        style="width:${45+Math.random()*45}%"></div></td>`).join("")}</tr>`).join("");
}

export function bindPreview(inputId, imgId) {
  const inp = document.getElementById(inputId);
  const img = document.getElementById(imgId);
  if (!inp || !img) return;
  inp.addEventListener("change", e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => { img.src = ev.target.result; img.classList.remove("hidden"); };
    r.readAsDataURL(f);
  });
}

export const trunc = (s, n = 60) => !s ? "—" : s.length > n ? s.slice(0, n) + "…" : s;
export const esc   = s => (s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
