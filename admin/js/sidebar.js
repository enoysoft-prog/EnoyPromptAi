// admin/js/sidebar.js — Full sidebar with all pages
import { auth }    from "./firebase.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

const LINKS = [
  { href:"dashboard.html",    label:"Dashboard",    section:"content",
    icon:`<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>` },
  { href:"prompts.html",      label:"Prompts",      section:"content",
    icon:`<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>` },
  { href:"submissions.html",  label:"Submissions",  section:"content", badge:"sub-pending-badge",
    icon:`<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>` },
  { href:"categories.html",   label:"Categories",   section:"content",
    icon:`<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>` },
  { href:"tools.html",        label:"AI Tools",     section:"content",
    icon:`<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>` },
  // Users & Coins
  { href:"users.html",        label:"Users",        section:"users", badge:"users-pending-badge",
    icon:`<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>` },
  { href:"coins.html",        label:"Coins & Plans", section:"users",
    icon:`<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>` },
  // Settings
  { href:"config.html",       label:"App Config",   section:"settings",
    icon:`<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>` },
];

export function injectSidebar() {
  const page = window.location.pathname.split("/").pop() || "dashboard.html";
  const sections = { content:"Content", users:"Users & Coins", settings:"Settings" };
  const grouped = {};
  LINKS.forEach(l => {
    if (!grouped[l.section]) grouped[l.section] = [];
    grouped[l.section].push(l);
  });

  let navHtml = "";
  Object.entries(grouped).forEach(([sec, links]) => {
    navHtml += `<p class="text-indigo-400 text-[10px] font-bold uppercase tracking-widest px-3 mb-1.5 mt-3 first:mt-0">${sections[sec]}</p>`;
    navHtml += links.map(l => {
      const active = page === l.href;
      const badge  = l.badge
        ? `<span id="${l.badge}" style="display:none;background:#ef4444;color:#fff;font-size:10px;font-weight:700;min-width:18px;height:18px;border-radius:9px;align-items:center;justify-content:center;padding:0 4px;margin-left:auto;">0</span>`
        : "";
      return `<a href="./${l.href}" class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active?"bg-white/15 text-white":"text-indigo-200 hover:bg-white/10 hover:text-white"}">
        <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">${l.icon}</svg>
        <span>${l.label}</span>${badge}
      </a>`;
    }).join("");
  });

  const sidebarContent = `
    <div class="px-5 py-5 border-b border-white/10 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-white/15 rounded-xl flex items-center justify-center text-lg">✨</div>
        <div><p class="text-white font-bold text-sm">PromptVault</p><p class="text-indigo-300 text-xs">Admin Panel</p></div>
      </div>
      <button id="sidebar-close" class="lg:hidden p-1.5 rounded-lg hover:bg-white/10 text-indigo-300">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <nav class="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">${navHtml}</nav>
    <div class="px-4 py-4 border-t border-white/10 flex items-center gap-3">
      <div id="sb-initials" class="w-8 h-8 bg-indigo-400 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">A</div>
      <p id="sb-email" class="text-white text-xs font-medium truncate flex-1">admin</p>
      <button id="btn-logout" title="Sign out" class="p-1.5 rounded-lg hover:bg-white/10 text-indigo-300 hover:text-white transition shrink-0">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
      </button>
    </div>`;

  // Desktop sidebar
  const slot = document.getElementById("sidebar-slot");
  if (slot) {
    const aside = document.createElement("aside");
    aside.id = "sidebar";
    aside.className = "sidebar-bg w-64 min-h-screen flex flex-col shrink-0 hidden lg:flex";
    aside.innerHTML = sidebarContent;
    slot.replaceWith(aside);
  }

  // Mobile drawer
  const drawer = document.createElement("div");
  drawer.id = "mobile-drawer";
  drawer.style.cssText = "position:fixed;inset:0;z-index:9000;display:none;";
  drawer.innerHTML = `<div id="drawer-backdrop" style="position:absolute;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(2px);"></div>
    <aside class="sidebar-bg relative w-72 max-w-[85vw] h-full flex flex-col shadow-2xl transition-transform duration-300 -translate-x-full" id="drawer-aside">${sidebarContent}</aside>`;
  document.body.appendChild(drawer);

  const open  = () => { drawer.style.display="block"; requestAnimationFrame(()=>document.getElementById("drawer-aside")?.classList.remove("-translate-x-full")); };
  const close = () => { document.getElementById("drawer-aside")?.classList.add("-translate-x-full"); setTimeout(()=>{drawer.style.display="none";},300); };

  document.querySelectorAll(".btn-hamburger").forEach(b=>b.addEventListener("click",open));
  document.getElementById("drawer-backdrop")?.addEventListener("click",close);
  setTimeout(()=>{
    document.querySelectorAll("#sidebar-close").forEach(b=>b.addEventListener("click",close));
    document.querySelectorAll("#btn-logout").forEach(b=>b.addEventListener("click",async()=>{ await signOut(auth); window.location.replace("./index.html"); }));
  },100);
}
