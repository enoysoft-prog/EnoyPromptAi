// js/dashboard.js — Updated with user stats
import { db } from "./firebase.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

async function safeDocs(colName) {
  try { return (await getDocs(collection(db, colName))).docs.map(d => d.data()); }
  catch (e) { console.warn("safeDocs", colName, e.message); return []; }
}

async function safeCount(colName) {
  try { return (await getDocs(collection(db, colName))).size; }
  catch (e) { return 0; }
}

export async function loadDashboard() {
  try {
    const [prompts, catCount, subCount, toolCount, users] = await Promise.all([
      safeDocs("prompts"),
      safeCount("categories"),
      safeCount("subcategories"),
      safeCount("tools"),
      safeDocs("users")
    ]);

    const free    = prompts.filter(p => !p.isPremium).length;
    const premium = prompts.filter(p =>  p.isPremium).length;
    const hot     = prompts.filter(p =>  p.isHot).length;

    // Prompt stats
    set("ds-total",   prompts.length);
    set("ds-free",    free);
    set("ds-premium", premium);
    set("ds-hot",     hot);
    set("ds-cats",    catCount);
    set("ds-subcats", subCount);
    set("ds-tools",   toolCount);

    // User stats
    const totalUsers   = users.length;
    const activeUsers  = users.filter(u => u.status === "active").length;
    const pendingUsers = users.filter(u => u.status === "pending").length;
    const bannedUsers  = users.filter(u => u.status === "banned").length;

    set("ds-users",         totalUsers);
    set("ds-users-active",  activeUsers);
    set("ds-users-pending", pendingUsers);
    set("ds-users-banned",  bannedUsers);

    // Pending badge in nav
    const badge = document.getElementById("users-pending-badge");
    if (badge) {
      badge.textContent   = pendingUsers;
      badge.style.display = pendingUsers > 0 ? "flex" : "none";
    }

    renderBreakdown(prompts);
    renderRecentUsers(users);
    renderRecent(prompts.sort((a,b) => (b.dateAdded||"").localeCompare(a.dateAdded||"")).slice(0,5));

  } catch (e) {
    console.error("Dashboard error:", e);
  }
}

function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function renderBreakdown(prompts) {
  const el = document.getElementById("ds-breakdown");
  if (!el) return;
  if (!prompts.length) { el.innerHTML = `<p class="text-sm text-gray-400 text-center py-4">No prompts yet</p>`; return; }
  const map = {};
  prompts.forEach(p => { const k = p.categoryName||p.category||"other"; map[k]=(map[k]||0)+1; });
  const total  = Object.values(map).reduce((a,b)=>a+b,0)||1;
  const colors = ["#6366f1","#ef4444","#10b981","#f59e0b","#3b82f6","#8b5cf6","#ec4899","#14b8a6"];
  el.innerHTML = Object.entries(map).sort(([,a],[,b])=>b-a).map(([cat,cnt],i) => {
    const pct = Math.round((cnt/total)*100);
    return `<div class="flex items-center gap-3">
      <span class="text-xs text-gray-500 w-20 shrink-0 capitalize truncate">${cat}</span>
      <div class="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div style="width:${pct}%;background:${colors[i%colors.length]}"
             class="h-full rounded-full transition-all duration-700"></div>
      </div>
      <span class="text-xs font-semibold text-gray-700 w-6 text-right">${cnt}</span>
    </div>`;
  }).join("");
}

function renderRecentUsers(users) {
  const el = document.getElementById("ds-recent-users");
  if (!el) return;
  const recent = [...users]
    .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0))
    .slice(0,5);
  if (!recent.length) {
    el.innerHTML = `<p class="text-sm text-gray-400 text-center py-6">No users yet</p>`;
    return;
  }
  el.innerHTML = recent.map(u => {
    const STATUS_COLORS = { active:"bg-green-100 text-green-700", pending:"bg-amber-100 text-amber-700", banned:"bg-red-100 text-red-700" };
    const sc = STATUS_COLORS[u.status] || STATUS_COLORS.pending;
    const initials = u.displayName ? u.displayName.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2) : (u.email||"U").charAt(0).toUpperCase();
    const joined = u.createdAt?.seconds ? new Date(u.createdAt.seconds*1000).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "—";
    return `<div class="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
      ${u.avatarUrl
        ? `<img src="${u.avatarUrl}" class="w-9 h-9 rounded-full object-cover shrink-0" onerror="this.style.display='none'"/>`
        : `<div class="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
             style="background:linear-gradient(135deg,#4f46e5,#7c3aed)">${initials}</div>`}
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-gray-900 truncate">${u.displayName||"—"}</p>
        <p class="text-xs text-gray-400 truncate">${u.email||"—"} · ${joined}</p>
      </div>
      <span class="text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${sc}">${u.status||"pending"}</span>
    </div>`;
  }).join("");
}

function renderRecent(prompts) {
  const el = document.getElementById("ds-recent");
  if (!el) return;
  if (!prompts.length) { el.innerHTML = `<p class="text-sm text-gray-400 text-center py-6">No prompts yet</p>`; return; }
  el.innerHTML = prompts.map(p => `
    <div class="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
      <img src="${p.imageUrl||"https://placehold.co/40x40/e8e8e8/999?text=?"}"
           class="w-10 h-10 rounded-xl object-cover bg-gray-100 shrink-0" loading="lazy"
           onerror="this.src='https://placehold.co/40x40/e8e8e8/999?text=!'"/>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-gray-900 truncate">${p.title||"—"}</p>
        <p class="text-xs text-gray-400">${p.tool||""} · ${p.categoryName||p.category||""}</p>
      </div>
      ${p.isPremium
        ? `<span class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium shrink-0">Premium</span>`
        : `<span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium shrink-0">Free</span>`}
    </div>`).join("");
}
