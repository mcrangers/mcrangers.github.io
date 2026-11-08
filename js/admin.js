/* Admin: edits the JSON files in /data and uploads photos to /images/uploads through the GitHub API.
 * The GitHub key is pasted once per phone and kept in that phone's localStorage. */
const OWNER = "mcrangers", REPO = "mcrangers.github.io", BRANCH = "main";
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;
const TKEY = "mcrangers:adminKey";

/* ===== Site settings: every on/off switch and text setting lives here ===== */
const SETTINGS = [
  { section: "Show on the site" },
  { key: "showMerch", type: "toggle", title: "Merch", desc: "Merch page, menu link and the merch band on the home page.", def: true },
  { key: "merchOpen", type: "toggle", title: "Merch orders open", desc: "Off shows “Orders closed” instead of the order button.", def: true },
  { key: "showPastHikes", type: "toggle", title: "Past hikes list", desc: "On the Hikes page, under upcoming hikes.", def: true },
  { key: "commentsEnabled", type: "toggle", title: "Blog comments", desc: "Comment section under each blog post (CUHK emails only).", def: true },
  { key: "showBingo", type: "toggle", title: "Trail Bingo link", desc: "Adds Trail Bingo to the menu.", def: true },
  { section: "Words and links" },
  { key: "tagline", type: "textarea", title: "Home page tagline", desc: "Under the big headline." },
  { key: "about", type: "textarea", title: "About us", desc: "The About section on the home page." },
  { key: "instagram", type: "url", title: "Instagram link", desc: "e.g. https://www.instagram.com/mcrangers" },
  { key: "joinForm", type: "url", title: "Join the club form", desc: "Google Form link. Leave empty to hide the button." },
  { key: "merchForm", type: "url", title: "Merch order form", desc: "Google Form link for the Order merch button." },
  { key: "email", type: "email", title: "Contact email", desc: "Optional. Shows in the footer." },
  { section: "Comments setup (Firebase)" },
  { key: "firebase.apiKey", type: "text", title: "Firebase apiKey", desc: "From Firebase → Project settings → Your apps → Web app config." },
  { key: "firebase.authDomain", type: "text", title: "Firebase authDomain", desc: "Usually yourproject.firebaseapp.com" },
  { key: "firebase.projectId", type: "text", title: "Firebase projectId" },
  { key: "firebase.appId", type: "text", title: "Firebase appId" },
  { key: "commentAdmins", type: "list", title: "Comment moderators", desc: "CUHK emails that can delete any comment, separated by commas. Also add them in firestore.rules." },
];
/* ===== List editors ===== */
const LISTS = {
  hikes: {
    file: "hikes", title: "Hikes", add: "Add a hike", empty: "No hikes yet.",
    sub: h => [h.date, h.status === "open" ? "Sign-ups open" : h.status].filter(Boolean).join(" · "),
    img: h => h.image,
    fields: [
      { key: "title", label: "Hike name", type: "text", req: true },
      { key: "trail", label: "Trail", type: "text", help: "e.g. MacLehose Trail Stage 5" },
      { row: [{ key: "date", label: "Date", type: "date", req: true }, { key: "time", label: "Meet time", type: "text", help: "e.g. 9:00am" }] },
      { key: "meet", label: "Meeting point", type: "text" },
      { row: [{ key: "difficulty", label: "Difficulty", type: "select", options: ["Easy", "Moderate", "Hard"] }, { key: "status", label: "Sign-ups", type: "select", options: [["open", "Open"], ["full", "Full (waitlist)"], ["soon", "Opening soon"], ["closed", "Closed"], ["hidden", "Hidden"]] }] },
      { row: [{ key: "distance", label: "Distance", type: "text", help: "e.g. 8 km" }, { key: "duration", label: "Duration", type: "text", help: "e.g. 4 hours" }] },
      { key: "form", label: "Sign-up Google Form", type: "url", help: "The Sign up button opens this." },
      { key: "image", label: "Photo", type: "image" },
      { key: "notes", label: "What to bring / notes", type: "textarea", short: true },
      { key: "post", label: "Blog post after the hike", type: "postpick", help: "Links this hike to its story in Past hikes." },
    ],
    blank: () => ({ title: "", date: "", status: "open", difficulty: "Moderate" }),
  },
  posts: {
    file: "posts", title: "Blog posts", add: "Write a post", empty: "No posts yet.",
    sub: p => [p.date, p.hike].filter(Boolean).join(" · "),
    img: p => p.cover,
    fields: [
      { key: "title", label: "Title", type: "text", req: true },
      { row: [{ key: "date", label: "Date", type: "date", req: true }, { key: "author", label: "Written by", type: "text" }] },
      { key: "hike", label: "Hike / trail", type: "text" },
      { key: "summary", label: "Short summary", type: "textarea", short: true, help: "Shows on the blog cards." },
      { key: "cover", label: "Cover photo", type: "image" },
      { key: "body", label: "Story", type: "textarea", help: "Leave a blank line between paragraphs. Start a line with ## for a heading. **bold** for bold." },
      { key: "photos", label: "Photo gallery", type: "photos" },
    ],
    blank: () => ({ title: "", date: new Date().toISOString().slice(0, 10), author: "MC Rangers exco", photos: [] }),
  },
  merch: {
    file: "merch", title: "Merch", add: "Add an item", empty: "No merch yet.", ordered: true,
    sub: m => [m.price, m.sizes].filter(Boolean).join(" · "),
    img: m => m.image,
    fields: [
      { row: [{ key: "name", label: "Item name", type: "text", req: true }, { key: "price", label: "Price", type: "text", help: "e.g. HK$120" }] },
      { key: "desc", label: "Description", type: "textarea", short: true },
      { key: "sizes", label: "Sizes", type: "text", help: "e.g. S, M, L, XL" },
      { key: "image", label: "Photo", type: "image" },
    ],
    blank: () => ({ name: "" }),
  },
};

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const slug = s => String(s || "item").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "item";
let token = localStorage.getItem(TKEY) || "";
const data = {}, shas = {}, dirty = new Set();
const localImg = {}; // path -> dataURL, so new uploads show before the site rebuilds
let tab = "hikes", openIdx = null;

/* ---------- GitHub ---------- */
const gh = (path, opts = {}, tok = token) => fetch(API + path, { ...opts, cache: "no-store", headers: { Authorization: "Bearer " + tok, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(opts.headers || {}) } });
const b64e = s => btoa(unescape(encodeURIComponent(s)));
const b64d = s => decodeURIComponent(escape(atob(s.replace(/\n/g, ""))));
async function explain(r) {
  let msg = ""; try { msg = (await r.json()).message || ""; } catch (e) {}
  if (r.status === 401) return "That GitHub key isn't valid or has expired.";
  if (r.status === 403 && /approv|pending/i.test(msg)) return "This key is waiting for approval in the mcrangers organization (Settings → Personal access tokens → Pending requests).";
  if (r.status === 403) return "GitHub blocked it. The key needs Contents: Read and write on mcrangers.github.io.";
  if (r.status === 404) return "The key can't see mcrangers/mcrangers.github.io. Add that repository to the key.";
  if (r.status === 409) return "Someone else saved at the same time. Refresh and try again.";
  return `GitHub error ${r.status}. ${msg}`;
}
async function checkKey(tok) {
  const r = await gh("", {}, tok);
  if (!r.ok) throw new Error(await explain(r));
  const repo = await r.json();
  if (repo.permissions && repo.permissions.push === false) throw new Error("That key can only read. It needs Contents: Read and write.");
}
async function loadFile(name) {
  const r = await gh(`/contents/data/${name}.json?ref=${BRANCH}&t=${Date.now()}`);
  if (!r.ok) throw new Error(await explain(r));
  const j = await r.json(); shas[name] = j.sha; data[name] = JSON.parse(b64d(j.content));
}
async function putFile(path, b64, message, sha) {
  const body = { message, content: b64, branch: BRANCH }; if (sha) body.sha = sha;
  const r = await gh(`/contents/${path}`, { method: "PUT", body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await explain(r));
  return (await r.json()).content.sha;
}

/* ---------- photos: shrink on the phone, then upload ---------- */
function shrink(file, max = 1600) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      res(c.toDataURL("image/jpeg", .82));
    };
    img.onerror = () => rej(new Error("That file isn't a photo the browser can open. Try a JPG or PNG."));
    img.src = url;
  });
}
async function upload(file, base) {
  const dataUrl = await shrink(file);
  const path = `images/uploads/${slug(base)}-${Date.now().toString(36)}.jpg`;
  await putFile(path, dataUrl.split(",")[1], `Upload ${path}`);
  localImg[path] = dataUrl;
  return path;
}
const src = p => localImg[p] || p;

/* ---------- screens ---------- */
const show = id => ["connect", "editor"].forEach(s => $("#" + s).classList.toggle("hidden", s !== id));
async function enter() {
  $("#pane").innerHTML = `<div class="panel">Loading…</div>`; show("editor");
  try { await Promise.all(["site", "hikes", "posts", "merch"].map(loadFile)); }
  catch (e) { $("#pane").innerHTML = `<div class="panel adm-err">${esc(e.message)}</div>`; return; }
  $("#topRight").innerHTML = `<button class="btn ghost sm" style="color:var(--on-night)" id="outBtn" type="button">Disconnect</button>`;
  $("#outBtn").onclick = () => { if (dirty.size && !confirmLeave()) return; localStorage.removeItem(TKEY); location.reload(); };
  render();
}
const confirmLeave = () => window.confirm ? window.confirm("You have unsaved changes. Leave anyway?") : true;
$("#connectForm").onsubmit = async e => {
  e.preventDefault();
  const tok = $("#tok").value.trim(), err = m => $("#connectErr").textContent = m;
  if (!tok) return err("Paste your GitHub key.");
  $("#connectBtn").textContent = "Connecting…"; err("");
  try { await checkKey(tok); token = tok; localStorage.setItem(TKEY, tok); await enter(); } catch (e2) { err(e2.message); }
  $("#connectBtn").textContent = "Connect";
};
document.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => {
  tab = b.dataset.tab; openIdx = null;
  document.querySelectorAll("[data-tab]").forEach(x => x.setAttribute("aria-selected", x === b));
  render(); window.scrollTo(0, 0);
});
function markDirty(name) { dirty.add(name); $("#saveBar").classList.remove("hidden"); $("#saveMsg").textContent = "You have unsaved changes"; $("#saveBtn").disabled = false; $("#saveBtn").textContent = "Save"; }
addEventListener("beforeunload", e => { if (dirty.size) { e.preventDefault(); e.returnValue = ""; } });

/* ---------- render ---------- */
function render() { tab === "site" ? renderSettings() : renderList(tab); }

const getPath = (o, k) => k.split(".").reduce((a, p) => a == null ? a : a[p], o);
const setPath = (o, k, v) => { const ps = k.split("."); let a = o; ps.slice(0, -1).forEach(p => { if (typeof a[p] !== "object" || !a[p]) a[p] = {}; a = a[p]; }); a[ps.at(-1)] = v; };

function renderSettings() {
  const s = data.site; let html = "", open = false;
  SETTINGS.forEach(f => {
    if (f.section) { html += (open ? "</div>" : "") + `<div class="panel"><h2>${esc(f.section)}</h2>`; open = true; return; }
    const v = getPath(s, f.key);
    if (f.type === "toggle") html += `<div class="toggle"><div><b>${esc(f.title)}</b><small>${esc(f.desc || "")}</small></div><label class="switch"><input type="checkbox" data-k="${f.key}" ${v !== false && (v ?? f.def) ? "checked" : ""} aria-label="${esc(f.title)}"><span></span></label></div>`;
    else if (f.type === "textarea") html += `<label for="s-${f.key}">${esc(f.title)}</label><textarea class="short" id="s-${f.key}" data-k="${f.key}">${esc(v || "")}</textarea>${f.desc ? `<div class="help">${esc(f.desc)}</div>` : ""}`;
    else html += `<label for="s-${f.key}">${esc(f.title)}</label><input type="${f.type === "list" ? "text" : f.type}" id="s-${f.key}" data-k="${f.key}" data-type="${f.type}" value="${esc(f.type === "list" ? (v || []).join(", ") : v || "")}" spellcheck="false">${f.desc ? `<div class="help">${esc(f.desc)}</div>` : ""}`;
  });
  $("#pane").innerHTML = html + "</div>";
  $("#pane").querySelectorAll("[data-k]").forEach(el => {
    el.oninput = el.onchange = () => {
      const v = el.type === "checkbox" ? el.checked : el.dataset.type === "list" ? el.value.split(",").map(x => x.trim()).filter(Boolean) : el.value.trim();
      setPath(data.site, el.dataset.k, v); markDirty("site");
    };
  });
}

function fieldHTML(f, item, i) {
  const id = `f-${i}-${f.key}`, v = item[f.key];
  const help = f.help ? `<div class="help">${esc(f.help)}</div>` : "";
  const lab = `<label for="${id}">${esc(f.label)}${f.req ? " *" : ""}</label>`;
  switch (f.type) {
    case "textarea": return `<div>${lab}<textarea id="${id}" data-f="${f.key}" class="${f.short ? "short" : ""}">${esc(v || "")}</textarea>${help}</div>`;
    case "select": return `<div>${lab}<select id="${id}" data-f="${f.key}">${f.options.map(o => { const [val, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}" ${v === val ? "selected" : ""}>${esc(t)}</option>`; }).join("")}</select>${help}</div>`;
    case "postpick": return `<div>${lab}<select id="${id}" data-f="${f.key}"><option value="">None</option>${(data.posts || []).filter(p => p.id).map(p => `<option value="${esc(p.id)}" ${v === p.id ? "selected" : ""}>${esc(p.title)}</option>`).join("")}</select>${help}</div>`;
    case "image": return `<div>${lab}<div class="imgfield">${v ? `<img class="thumb" src="${esc(src(v))}" alt="">` : ""}<input type="text" id="${id}" data-f="${f.key}" value="${esc(v || "")}" placeholder="images/…" spellcheck="false"><span class="btn ghost sm upl">${v ? "Change photo" : "Upload photo"}<input type="file" accept="image/*" data-up="${f.key}" aria-label="Upload ${esc(f.label)}"></span></div><div class="help" data-uphelp="${f.key}"></div></div>`;
    case "photos": return `<div><label>${esc(f.label)}</label><div class="photos">${(v || []).map((p, j) => `<div class="ph"><img src="${esc(src(p))}" alt=""><button type="button" data-rm="${j}" aria-label="Remove photo">×</button></div>`).join("")}</div><span class="btn ghost sm upl" style="margin-top:10px">Add photos<input type="file" accept="image/*" multiple data-upmany="${f.key}" aria-label="Add photos"></span><div class="help" data-uphelp="${f.key}">You can pick several at once.</div></div>`;
    default: return `<div>${lab}<input type="${f.type}" id="${id}" data-f="${f.key}" value="${esc(v || "")}" ${f.type === "url" ? 'placeholder="https://forms.gle/…" spellcheck="false"' : ""}>${help}</div>`;
  }
}
function renderList(name) {
  const L = LISTS[name], arr = data[name];
  let order = arr.map((x, i) => i);
  if (!L.ordered) order.sort((a, b) => String(arr[b].date || "").localeCompare(String(arr[a].date || "")));
  $("#pane").innerHTML = `<div class="adm-head"><h2>${L.title}</h2><button class="btn dark sm" type="button" id="addBtn">+ ${L.add}</button></div>
    ${arr.length ? "" : `<div class="empty-adm">${L.empty}</div>`}
    ${order.map(i => { const it = arr[i], im = L.img(it); return `<div class="item ${openIdx === i ? "open" : ""}" data-i="${i}">
      <button class="item-top" type="button" aria-expanded="${openIdx === i}">${im ? `<img src="${esc(src(im))}" alt="">` : `<span class="noimg"></span>`}<span class="t"><b>${esc(it.title || it.name || "Untitled")}</b><small>${esc(L.sub(it))}</small></span><span class="chev" aria-hidden="true">▾</span></button>
      <div class="item-body">${openIdx === i ? L.fields.map(f => f.row ? `<div class="row2">${f.row.map(g => fieldHTML(g, it, i)).join("")}</div>` : fieldHTML(f, it, i)).join("") + `
        <div class="item-actions">${L.ordered ? `<span class="order"><button type="button" data-mv="-1" aria-label="Move up">↑</button><button type="button" data-mv="1" aria-label="Move down">↓</button></span>` : "<span></span>"}<button class="btn danger sm" type="button" data-del>Delete</button></div>` : ""}</div>
    </div>`; }).join("")}`;
  $("#addBtn").onclick = () => { arr.unshift(L.blank()); openIdx = 0; markDirty(name); render(); setTimeout(() => { const f = $(".item.open input"); if (f) f.focus(); }, 30); };
  $("#pane").querySelectorAll(".item").forEach(el => {
    const i = +el.dataset.i, it = arr[i];
    el.querySelector(".item-top").onclick = () => { openIdx = openIdx === i ? null : i; render(); };
    if (openIdx !== i) return;
    el.querySelectorAll("[data-f]").forEach(inp => inp.oninput = inp.onchange = () => {
      it[inp.dataset.f] = inp.value.trim();
      if (!it[inp.dataset.f]) delete it[inp.dataset.f];
      markDirty(name);
      const top = el.querySelector(".item-top b"); if (top && (inp.dataset.f === "title" || inp.dataset.f === "name")) top.textContent = inp.value || "Untitled";
    });
    el.querySelectorAll("[data-up]").forEach(inp => inp.onchange = async () => {
      const h = el.querySelector(`[data-uphelp="${inp.dataset.up}"]`); if (!inp.files[0]) return;
      h.textContent = "Uploading…";
      try { it[inp.dataset.up] = await upload(inp.files[0], it.title || it.name); markDirty(name); render(); }
      catch (e) { h.textContent = e.message; }
    });
    el.querySelectorAll("[data-upmany]").forEach(inp => inp.onchange = async () => {
      const k = inp.dataset.upmany, h = el.querySelector(`[data-uphelp="${k}"]`), files = [...inp.files];
      it[k] = it[k] || [];
      for (let n = 0; n < files.length; n++) {
        h.textContent = `Uploading ${n + 1} of ${files.length}…`;
        try { it[k].push(await upload(files[n], it.title || "photo")); markDirty(name); } catch (e) { h.textContent = e.message; return; }
      }
      render();
    });
    el.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { it.photos.splice(+b.dataset.rm, 1); markDirty(name); render(); });
    el.querySelectorAll("[data-mv]").forEach(b => b.onclick = () => { const j = i + +b.dataset.mv; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; openIdx = j; markDirty(name); render(); });
    const del = el.querySelector("[data-del]");
    del.onclick = () => {
      if (del.dataset.c !== "1") { del.dataset.c = "1"; del.textContent = "Tap again to delete"; return; }
      arr.splice(i, 1); openIdx = null; markDirty(name); render();
    };
  });
}

/* ---------- save ---------- */
function problems() {
  for (const name of dirty) {
    if (name === "site") continue;
    const L = LISTS[name];
    for (const it of data[name]) {
      const miss = L.fields.flatMap(f => f.row || [f]).filter(f => f.req && !it[f.key]).map(f => f.label);
      if (miss.length) return `${L.title}: “${it.title || it.name || "Untitled"}” needs ${miss.join(" and ")}.`;
    }
  }
  return "";
}
function ensureIds(name) {
  if (name === "site") return;
  const used = new Set();
  data[name].forEach(it => {
    let id = it.id || slug(it.title || it.name) + (it.date ? "-" + it.date.slice(0, 7) : "");
    while (used.has(id)) id += "-2";
    it.id = id; used.add(id);
  });
}
$("#saveBtn").onclick = async () => {
  const p = problems(); if (p) { $("#saveMsg").textContent = p; return; }
  const btn = $("#saveBtn"); btn.disabled = true; btn.textContent = "Saving…";
  const names = [...dirty];
  try {
    for (const n of names) {
      ensureIds(n);
      shas[n] = await putFile(`data/${n}.json`, b64e(JSON.stringify(data[n], null, 2) + "\n"), `Admin: update ${n}`, shas[n]);
      dirty.delete(n);
    }
  } catch (e) { $("#saveMsg").textContent = e.message; btn.disabled = false; btn.textContent = "Try again"; return; }
  btn.textContent = "Saved"; $("#saveMsg").textContent = "Saved. Going live on the website…";
  const want = JSON.stringify(data[names.at(-1)]);
  for (let t = 0; t < 40; t++) {
    await new Promise(r => setTimeout(r, 6000));
    if (dirty.size) return;
    try {
      const live = await fetch(`data/${names.at(-1)}.json?t=${Date.now()}`, { cache: "no-store" }).then(r => r.json());
      if (JSON.stringify(live) === want) { $("#saveMsg").textContent = "Live now on the website."; setTimeout(() => { if (!dirty.size) $("#saveBar").classList.add("hidden"); }, 4000); return; }
    } catch (e) {}
  }
  $("#saveMsg").textContent = "Saved. The website can take a few minutes to update.";
};

/* ---------- start ---------- */
if (token) enter().catch(() => show("connect")); else show("connect");
