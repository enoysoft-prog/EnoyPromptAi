// js/cloudinary.js
// Cloud: do6mkxzxl  |  Preset: pv_upload (Unsigned)
const CLOUD  = "do6mkxzxl";
const PRESET = "pv_upload";
const URL    = `https://api.cloudinary.com/v1_1/${CLOUD}/auto/upload`;

export async function uploadImage(file, folder = "promptvault", onProgress = null) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", PRESET);
    fd.append("folder", folder);
    fd.append("public_id", `${Date.now()}_${Math.random().toString(36).slice(2,7)}`);
    const xhr = new XMLHttpRequest();
    if (onProgress) xhr.upload.onprogress = e => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded/e.total)*100));
    };
    xhr.open("POST", URL, true);
    xhr.onload = () => {
      if (xhr.status === 200) {
        const r = JSON.parse(xhr.responseText);
        resolve({ url: r.secure_url, public_id: r.public_id });
      } else {
        const e = JSON.parse(xhr.responseText);
        reject(new Error(e.error?.message || "Upload failed"));
      }
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(fd);
  });
}

export function cdnUrl(url, w = 600) {
  if (!url || !url.includes("cloudinary.com")) return url;
  return url.replace("/upload/", `/upload/w_${w},q_auto,f_auto/`);
}

export function showProgress(containerId, pct) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (pct < 100) {
    el.innerHTML = `<div class="flex items-center gap-2 mt-1.5">
      <div class="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
        <div class="bg-indigo-600 h-full transition-all" style="width:${pct}%"></div>
      </div>
      <span class="text-xs text-gray-500">${pct}%</span></div>`;
  } else {
    el.innerHTML = `<p class="text-xs text-green-600 mt-1 flex items-center gap-1">
      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
      </svg>Uploaded ✓</p>`;
    setTimeout(() => { if (el) el.innerHTML = ""; }, 2000);
  }
}
