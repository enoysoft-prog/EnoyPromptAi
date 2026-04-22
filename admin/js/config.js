// js/config.js
import { db }  from "./firebase.js";
import { toast, btnLoad } from "./ui.js";
import { doc, getDoc, setDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const CFG = () => doc(db,"config","app");

const DEFAULTS = {
  // App info
  appName:"PromptVault", appTagline:"Discover the Best AI Prompts",
  appVersion:"1.0.0", builtBy:"ENOY SOFT", contactEmail:"enoysoft@gmail.com",
  // UI text
  homeHeading:"PromptVault", homeTrendingLabel:"🔥 Trending",
  homeFreshLabel:"🕐 Fresh Picks",
  searchPlaceholder:"Search prompts, tools, categories…",
  unlockMessage:"Watch a short ad to unlock this premium prompt",
  // URLs
  privacyPolicyUrl:"", termsUrl:"", playStoreUrl:"",
  // AdMob App ID
  admobAppId:"ca-app-pub-3940256099942544~3347511713",
  // AdMob unit IDs
  admobBannerId:"", admobInterstitialId:"", admobRewardedId:"",
  admobNativeId:"", admobAppOpenId:"",
  // Feature flags
  showHotBadge:true, premiumEnabled:true, adsEnabled:true,
  showBannerAds:true, showInterstitialAds:true,
  showRewardedAds:true, showNativeAds:true, showAppOpenAds:true,
  // Interstitial settings
  interstitialCooldownMinutes:3, interstitialEveryNthDetail:4, interstitialEveryNthTab:5,
  // About
  aboutText:"PromptVault is your ultimate AI prompt discovery app. Browse, save, and use the best prompts for Midjourney, DALL·E 3, Stable Diffusion, Sora, ChatGPT, Claude, and more.\n\nBuilt with ❤️ by ENOY SOFT."
};

export async function loadConfig(){
  const loading=document.getElementById("cfg-loading");
  const form=document.getElementById("cfg-form");
  if(loading) loading.classList.remove("hidden");
  if(form)    form.classList.add("hidden");
  try {
    const snap=await getDoc(CFG());
    const data=snap.exists()?{...DEFAULTS,...snap.data()}:DEFAULTS;
    Object.entries(data).forEach(([k,v])=>{
      const el=document.getElementById("cfg-"+k);
      if(!el) return;
      if(el.type==="checkbox") el.checked=!!v;
      else if(el.tagName==="TEXTAREA") el.value=v??"";
      else el.value=v??"";
    });
    if(loading) loading.classList.add("hidden");
    if(form)    form.classList.remove("hidden");
  } catch(e){ toast("Load failed: "+e.message,"error"); }
}

export async function saveConfig(e){
  e?.preventDefault();
  const btn=document.getElementById("btn-save-cfg");
  btnLoad(btn,true,"Save Settings");
  try {
    const data={updatedAt:serverTimestamp()};
    Object.keys(DEFAULTS).forEach(k=>{
      const el=document.getElementById("cfg-"+k);
      if(!el) return;
      if(el.type==="checkbox") data[k]=el.checked;
      else if(el.type==="number") data[k]=parseFloat(el.value)||0;
      else data[k]=el.value.trim();
    });
    await setDoc(CFG(),data,{merge:true});
    toast("Settings saved ✓");
  } catch(e){ toast("Save failed: "+e.message,"error"); }
  finally{ btnLoad(btn,false,"Save Settings"); }
}

export function resetConfig(){
  Object.entries(DEFAULTS).forEach(([k,v])=>{
    const el=document.getElementById("cfg-"+k);
    if(!el) return;
    if(el.type==="checkbox") el.checked=!!v;
    else el.value=v??"";
  });
  toast("Reset to defaults (not saved yet)","info");
}
