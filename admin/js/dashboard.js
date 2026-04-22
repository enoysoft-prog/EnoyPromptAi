// admin/js/dashboard.js — Full stats including users, coins, submissions
import { db } from "./firebase.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

async function safeGet(col) {
  try { return (await getDocs(collection(db,col))).docs.map(d=>d.data()); }
  catch(e) { console.warn(col,e.message); return []; }
}

export async function loadDashboard() {
  const [prompts,cats,subs,tools,users,txs] = await Promise.all([
    safeGet("prompts"), safeGet("categories"), safeGet("prompt_submissions"),
    safeGet("tools"),   safeGet("users"),       safeGet("coin_transactions")
  ]);

  const free    = prompts.filter(p=>!p.isPremium).length;
  const premium = prompts.filter(p=> p.isPremium).length;

  // Prompts
  set("ds-total",   prompts.length);
  set("ds-free",    free);
  set("ds-premium", premium);
  set("ds-hot",     prompts.filter(p=>p.isHot).length);
  set("ds-cats",    cats.length);
  set("ds-tools",   tools.length);

  // Users
  const active  = users.filter(u=>u.status==="active").length;
  const pending = users.filter(u=>u.status==="pending").length;
  const pro     = users.filter(u=>u.role==="pro").length;
  set("ds-users",         users.length);
  set("ds-users-active",  active);
  set("ds-users-pending", pending);
  set("ds-users-pro",     pro);

  // Submissions
  const subPending  = subs.filter(s=>s.status==="pending").length;
  const subApproved = subs.filter(s=>s.status==="approved").length;
  set("ds-sub-pending",  subPending);
  set("ds-sub-approved", subApproved);

  // Coins
  const totalCoins = txs.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
  const totalSpent = txs.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
  set("ds-coins-earned", totalCoins);
  set("ds-coins-spent",  totalSpent);

  // Pending badges
  const b1=document.getElementById("sub-pending-badge");
  if(b1){b1.textContent=subPending;b1.style.display=subPending>0?"flex":"none";}
  const b2=document.getElementById("users-pending-badge");
  if(b2){b2.textContent=pending;b2.style.display=pending>0?"flex":"none";}

  renderCategoryChart(prompts);
  renderRecentUsers(users);
  renderRecentPrompts(prompts);
}

function set(id,v){ const el=document.getElementById(id); if(el)el.textContent=v; }

function renderCategoryChart(prompts) {
  const el=document.getElementById("ds-breakdown"); if(!el)return;
  if(!prompts.length){el.innerHTML=`<p class="text-sm text-gray-400 text-center py-4">No prompts</p>`;return;}
  const map={}; prompts.forEach(p=>{const k=p.categoryName||p.category||"other";map[k]=(map[k]||0)+1;});
  const total=Object.values(map).reduce((a,b)=>a+b,0)||1;
  const colors=["#6366f1","#ef4444","#10b981","#f59e0b","#3b82f6","#8b5cf6","#ec4899"];
  el.innerHTML=Object.entries(map).sort(([,a],[,b])=>b-a).map(([cat,cnt],i)=>`
    <div class="flex items-center gap-3">
      <span class="text-xs text-gray-500 w-20 shrink-0 capitalize truncate">${cat}</span>
      <div class="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div style="width:${Math.round((cnt/total)*100)}%;background:${colors[i%colors.length]}" class="h-full rounded-full"></div>
      </div>
      <span class="text-xs font-semibold text-gray-700 w-5 text-right">${cnt}</span>
    </div>`).join("");
}

function renderRecentUsers(users) {
  const el=document.getElementById("ds-recent-users"); if(!el)return;
  const recent=[...users].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)).slice(0,5);
  if(!recent.length){el.innerHTML=`<p class="text-sm text-gray-400 text-center py-6">No users</p>`;return;}
  el.innerHTML=recent.map(u=>{
    const S={active:"bg-green-100 text-green-700",pending:"bg-amber-100 text-amber-700",banned:"bg-red-100 text-red-700"};
    const sc=S[u.status]||S.pending;
    const ini=(u.displayName||u.email||"U").split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
    return `<div class="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
      ${u.avatarUrl
        ?`<img src="${u.avatarUrl}" class="w-9 h-9 rounded-full object-cover shrink-0" onerror="this.style.display='none'"/>`
        :`<div class="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style="background:linear-gradient(135deg,#4f46e5,#7c3aed)">${ini}</div>`}
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-gray-900 truncate">${u.displayName||"—"}</p>
        <p class="text-xs text-gray-400 truncate">${u.email||"—"}</p>
      </div>
      <span class="text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${sc}">${u.status}</span>
    </div>`;
  }).join("");
}

function renderRecentPrompts(prompts) {
  const el=document.getElementById("ds-recent"); if(!el)return;
  const recent=[...prompts].sort((a,b)=>(b.dateAdded||"").localeCompare(a.dateAdded||"")).slice(0,5);
  if(!recent.length){el.innerHTML=`<p class="text-sm text-gray-400 text-center py-6">No prompts</p>`;return;}
  el.innerHTML=recent.map(p=>`
    <div class="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <img src="${p.imageUrl||"https://placehold.co/40x40/e8e8e8/999?text=?"}"
           class="w-10 h-10 rounded-xl object-cover bg-gray-100 shrink-0" loading="lazy"
           onerror="this.src='https://placehold.co/40x40/e8e8e8/999?text=!'"/>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-gray-900 truncate">${p.title||"—"}</p>
        <p class="text-xs text-gray-400">${p.tool||""} · ${p.categoryName||p.category||""}</p>
      </div>
      ${p.isPremium
        ?`<span class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full shrink-0">Premium</span>`
        :`<span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full shrink-0">Free</span>`}
    </div>`).join("");
}
