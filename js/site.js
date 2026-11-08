/* MC Rangers site. All content comes from the JSON files in /data, which the admin page edits. */
(() => {
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const page = document.body.dataset.page;
const get = f => fetch(`data/${f}.json?t=${Date.now()}`, { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null);

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const parseDate = d => { const [y, m, dd] = String(d || "").split("-").map(Number); return y ? new Date(y, (m || 1) - 1, dd || 1) : null; };
const fmtDate = (d, long) => { const t = parseDate(d); if (!t) return ""; return long ? t.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" }) : `${t.getDate()} ${MONTHS[t.getMonth()]} ${t.getFullYear()}`; };
const today = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
const isPast = h => { const t = parseDate(h.date); return t && t < today(); };
const link = u => u && /^https?:\/\//.test(u) ? u : "";

/* ---------- shared chrome ---------- */
const menu = $(".menu-btn"), nav = $("#nav");
if (menu) menu.onclick = () => { const o = nav.classList.toggle("open"); menu.setAttribute("aria-expanded", o); menu.textContent = o ? "Close" : "Menu"; };
document.querySelectorAll("[data-year]").forEach(e => e.textContent = new Date().getFullYear());

function applySite(site) {
  document.querySelectorAll("[data-flag]").forEach(el => el.classList.toggle("hidden", site[el.dataset.flag] === false));
  document.querySelectorAll("[data-text]").forEach(el => el.textContent = site[el.dataset.text] || "");
  document.querySelectorAll("[data-link]").forEach(el => {
    const k = el.dataset.link, v = site[k];
    const href = k === "email" ? (v ? "mailto:" + v : "") : link(v);
    if (href) { el.href = href; el.classList.remove("hidden"); } else el.classList.add("hidden");
  });
}

/* ---------- hikes ---------- */
const statusText = { open: "Sign-ups open", full: "Full · waitlist", closed: "Sign-ups closed", soon: "Opening soon" };
function hikeCard(h, site) {
  const t = parseDate(h.date);
  const st = h.status || "open";
  const form = link(h.form);
  const cta = st === "open" && form
    ? `<a class="btn dark" href="${esc(form)}" target="_blank" rel="noopener">Sign up<span class="sr-only"> for ${esc(h.title)}</span> &rarr;</a>`
    : st === "full" && form
      ? `<a class="btn ghost" href="${esc(form)}" target="_blank" rel="noopener">Join the waitlist</a>`
      : `<span class="btn" aria-disabled="true">${st === "soon" ? "Opening soon" : "Sign-ups closed"}</span>`;
  const facts = [["When", [fmtDate(h.date, true), h.time].filter(Boolean).join(" · ")], ["Meet", h.meet], ["Distance", h.distance], ["Time", h.duration]]
    .filter(f => f[1]).map(f => `<div><dt>${f[0]}</dt><dd>${esc(f[1])}</dd></div>`).join("");
  return `<article class="hike reveal">
    <div class="hike-img">${h.image ? `<img src="${esc(h.image)}" alt="${esc(h.title)}" loading="lazy" width="1200" height="900">` : ""}
      ${t ? `<div class="date-chip" aria-hidden="true"><b>${t.getDate()}</b><span>${MONTHS[t.getMonth()]}</span></div>` : ""}</div>
    <div class="hike-body">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="status ${st}">${statusText[st] || st}</span>${h.difficulty ? `<span class="diff ${esc(h.difficulty)}">${esc(h.difficulty)}</span>` : ""}</div>
      <h3>${esc(h.title)}</h3>
      ${h.trail ? `<p class="trail">${esc(h.trail)}</p>` : ""}
      ${facts ? `<dl class="facts">${facts}</dl>` : ""}
      ${h.notes ? `<p class="hike-notes">${esc(h.notes)}</p>` : ""}
      <div class="hike-cta">${cta}</div>
    </div>
  </article>`;
}
const noHikes = `<div class="empty"><b>No hikes posted yet</b>The next one is on its way. Follow us on Instagram so you don't miss it.</div>`;
const upcoming = hikes => hikes.filter(h => !isPast(h) && h.status !== "hidden").sort((a, b) => String(a.date).localeCompare(String(b.date)));

/* ---------- posts ---------- */
function postCard(p, cls = "") {
  return `<a class="post-card ${cls} reveal" href="post.html?p=${encodeURIComponent(p.id)}">
    <div class="pc-img">${p.cover ? `<img src="${esc(p.cover)}" alt="" loading="lazy" width="1200" height="900">` : ""}</div>
    <div class="pc-body"><div class="meta">${esc(fmtDate(p.date))}${p.hike ? " · " + esc(p.hike) : ""}</div><h3>${esc(p.title)}</h3>${p.summary ? `<p>${esc(p.summary)}</p>` : ""}</div>
  </a>`;
}
const byNewest = ps => ps.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
function postGrid(ps) {
  if (!ps.length) return `<div class="empty" style="grid-column:span 12"><b>No posts yet</b>After the next hike, the story goes up here.</div>`;
  return ps.map((p, i) => postCard(p, i === 0 ? (ps.length === 1 ? "feature solo" : "feature") : "")).join("");
}
// Tiny, safe formatter: paragraphs, "## " headings, **bold**, ![alt](src) images, links
function inline(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}
function renderBody(text) {
  return String(text || "").split(/\n\s*\n/).map((b, i) => {
    b = b.trim(); if (!b) return "";
    const img = b.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (img) return `<img src="${esc(img[2])}" alt="${esc(img[1])}" loading="lazy">`;
    if (b.startsWith("## ")) return `<h2>${inline(b.slice(3))}</h2>`;
    return `<p${i === 0 ? ' class="lede"' : ""}>${inline(b).replace(/\n/g, "<br>")}</p>`;
  }).join("");
}

/* ---------- merch ---------- */
function orderBar(site) {
  const f = link(site.merchForm), open = site.merchOpen !== false;
  return `<div><b>${open ? "Ready to order?" : "Orders are closed for now"}</b><p>${open ? "Fill in the Google Form with your items and sizes. We'll confirm by email and arrange collection on campus." : "We'll post on Instagram when the next batch opens."}</p></div>
    ${open && f ? `<a class="btn" href="${esc(f)}" target="_blank" rel="noopener">Order merch &rarr;</a>` : `<span class="btn" aria-disabled="true">Orders closed</span>`}`;
}

/* ---------- reveal on scroll ---------- */
function reveal() {
  const els = document.querySelectorAll(".reveal:not(.in)");
  if (!("IntersectionObserver" in window)) return els.forEach(e => e.classList.add("in"));
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
  els.forEach(e => io.observe(e));
}

/* ---------- lightbox ---------- */
function lightbox(src, alt) {
  const d = document.createElement("div");
  d.className = "lightbox"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-label", "Photo");
  d.innerHTML = `<img src="${esc(src)}" alt="${esc(alt)}"><button class="btn" type="button">Close</button>`;
  const close = () => { d.remove(); document.removeEventListener("keydown", key); };
  const key = e => { if (e.key === "Escape") close(); };
  d.onclick = e => { if (e.target === d || e.target.tagName === "BUTTON") close(); };
  document.addEventListener("keydown", key); document.body.appendChild(d); d.querySelector("button").focus();
}

/* ---------- pages ---------- */
(async () => {
  const [site, hikes, posts, merch] = await Promise.all([get("site"), get("hikes"), get("posts"), get("merch")]);
  const S = site || {}, H = hikes || [], P = byNewest(posts || []), M = merch || [];
  window.MCR = { site: S, posts: P };
  applySite(S);

  if (page === "index") {
    const up = upcoming(H).slice(0, 2);
    $("#nextHikes").innerHTML = up.length ? up.map(h => hikeCard(h, S)).join("") : noHikes;
    $("#latestPosts").innerHTML = postGrid(P.slice(0, 3));
    $("#merchImgs").innerHTML = M.filter(m => m.image).slice(0, 2).map(m => `<img src="${esc(m.image)}" alt="${esc(m.name)}" loading="lazy" width="800" height="800">`).join("");
  }
  if (page === "hikes") {
    const up = upcoming(H);
    $("#upcoming").innerHTML = up.length ? up.map(h => hikeCard(h, S)).join("") : noHikes;
    const past = H.filter(isPast).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const ids = new Set(P.map(p => p.id));
    if (!past.length) $("#pastSec").classList.add("hidden");
    $("#past").innerHTML = past.map(h => `<li><time datetime="${esc(h.date)}">${esc(fmtDate(h.date))}</time><div><b>${esc(h.title)}</b>${h.trail ? `<div class="t">${esc(h.trail)}</div>` : ""}</div>${h.post && ids.has(h.post) ? `<a href="post.html?p=${encodeURIComponent(h.post)}">Read the story &rarr;</a>` : "<span></span>"}</li>`).join("");
  }
  if ($("#allPosts")) $("#allPosts").innerHTML = postGrid(P);
  if (page === "merch") {
    $("#products").innerHTML = M.length ? M.map(m => `<article class="product reveal">${m.image ? `<img src="${esc(m.image)}" alt="${esc(m.name)}" loading="lazy" width="800" height="800">` : ""}
      <div class="pb"><div class="row"><h3>${esc(m.name)}</h3>${m.price ? `<span class="price">${esc(m.price)}</span>` : ""}</div>${m.desc ? `<p>${esc(m.desc)}</p>` : ""}${m.sizes ? `<div class="sizes">Sizes: ${esc(m.sizes)}</div>` : ""}</div></article>`).join("")
      : `<div class="empty"><b>New merch coming soon</b>Check back after the next design drop.</div>`;
    $("#orderBar").innerHTML = orderBar(S);
    if (S.showMerch === false) $("#products").innerHTML = `<div class="empty"><b>Merch is taking a break</b>Check back soon.</div>`, $("#orderBar").classList.add("hidden");
  }
  if (document.getElementById("article")) {
    const id = new URLSearchParams(location.search).get("p");
    const p = P.find(x => x.id === id);
    if (!p) {
      $("#aTitle").textContent = "Post not found";
      $("#aBody").innerHTML = `<p>This post may have moved. <a href="blog.html">See all posts</a>.</p>`;
      $("#aCover").remove(); $("#commentsSec").classList.add("hidden");
    } else {
      document.title = `${p.title} · MC Rangers`;
      $("#aTitle").textContent = p.title;
      $("#aMeta").textContent = [fmtDate(p.date, true), p.hike, p.author].filter(Boolean).join(" · ");
      if (p.cover) { $("#aCover").src = p.cover; $("#aCover").alt = p.title; } else $("#aCover").remove();
      $("#aBody").innerHTML = renderBody(p.body);
      const ph = (p.photos || []).filter(x => x && x !== p.cover);
      $("#aGallery").innerHTML = ph.map((src, i) => `<button type="button" data-src="${esc(src)}" aria-label="Open photo ${i + 1}"><img src="${esc(src)}" alt="" loading="lazy"></button>`).join("");
      $("#aGallery").querySelectorAll("button").forEach(b => b.onclick = () => lightbox(b.dataset.src, p.title));
      window.MCR.post = p;
      window.dispatchEvent(new CustomEvent("mcr:post", { detail: { post: p, site: S } }));
    }
  }
  reveal();
})();
})();
