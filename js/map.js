/* MC Rangers map. Pins come from data/hikes.json (any hike or activity with a "location").
   Clicking a pin shows the trip and links to its blog post. Uses Leaflet + OpenStreetMap/CARTO tiles. */
(() => {
const LEAFLET = "https://unpkg.com/leaflet@1.9.4/dist/leaflet";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const parseDate = d => { const [y, m, dd] = String(d || "").split("-").map(Number); return y ? new Date(y, (m || 1) - 1, dd || 1) : null; };
const fmt = d => { const t = parseDate(d); return t ? `${t.getDate()} ${MONTHS[t.getMonth()]} ${t.getFullYear()}` : ""; };
const isPast = h => { const t = parseDate(h.date), n = new Date(); n.setHours(0, 0, 0, 0); return t && t < n; };

function parseLoc(v) {
  const s = String(v || "");
  const m = s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/) || s.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/) || s.match(/(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (!m) return null;
  const lat = +m[1], lng = +m[2];
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lat, lng] : null;
}

// Small line icons per activity type (24px grid, stroke = currentColor)
const ICONS = {
  Hike: '<path d="M3 20l6-10 4 6 3-4 5 8z"/><path d="M9 10l1.5 2.5"/>',
  Rafting: '<path d="M3 16c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0"/><path d="M5 12h14l-2 3H7z"/><path d="M14 4l-5 11"/>',
  Kayaking: '<path d="M3 15c3 2 15 2 18 0"/><path d="M6 6l12 12"/><path d="M5 5l2-1 1 2-2 1z"/><path d="M17 17l2 1-1 2-2-1z"/>',
  Cycling: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-7h5l3 7M10 9l2 7h-6M14 6h2"/>',
  Camping: '<path d="M3 20L12 5l9 15z"/><path d="M12 20l-3-5h6z"/>',
  Beach: '<path d="M3 19c2 1 4 1 6 0s4-1 6 0 4 1 6 0"/><path d="M12 15V6"/><path d="M5 8a7 4 0 0 1 14 0z"/>',
  Other: '<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>'
};
const svg = t => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[t] || ICONS.Other}</svg>`;
const typeOf = h => ICONS[h.type] ? h.type : (h.type ? "Other" : "Hike");

let leafletP;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  return leafletP ||= new Promise((res, rej) => {
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = LEAFLET + ".css"; document.head.appendChild(css);
    const js = document.createElement("script"); js.src = LEAFLET + ".js"; js.onload = () => res(window.L); js.onerror = rej; document.head.appendChild(js);
  });
}

function popup(h, posts) {
  const post = h.post && posts.find(p => p.id === h.post);
  const img = (post && post.cover) || h.image;
  const up = !isPast(h);
  const form = /^https?:\/\//.test(h.form || "") ? h.form : "";
  let cta = "";
  if (post) cta = `<a class="btn sm dark" href="post.html?p=${encodeURIComponent(post.id)}">Read the story &rarr;</a>`;
  else if (up && h.status === "open" && form) cta = `<a class="btn sm dark" href="${esc(form)}" target="_blank" rel="noopener">Sign up &rarr;</a>`;
  else if (up) cta = `<a class="btn sm ghost" href="hikes.html">See details</a>`;
  else cta = `<span class="pop-note">Story coming soon</span>`;
  return `<div class="pop">${img ? `<img src="${esc(img)}" alt="" width="280" height="150">` : ""}
    <div class="pop-b"><div class="pop-meta"><span class="pop-type t-${typeOf(h)}">${svg(typeOf(h))}${esc(typeOf(h))}</span>${up ? '<span class="pop-up">Upcoming</span>' : ""}</div>
    <h3>${esc(h.title)}</h3><p>${esc([fmt(h.date), h.trail].filter(Boolean).join(" · "))}</p>${cta}</div></div>`;
}

async function build(el, hikes, posts, opts) {
  const L = await loadLeaflet();
  const pts = hikes.filter(h => h.status !== "hidden").map(h => ({ h, ll: parseLoc(h.location) })).filter(x => x.ll);
  const map = L.map(el, { scrollWheelZoom: !!opts.full, zoomControl: true, attributionControl: true, tap: true });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  const markers = pts.map(({ h, ll }) => {
    const t = typeOf(h), up = !isPast(h);
    const icon = L.divIcon({ className: "", html: `<span class="pin t-${t}${up ? " up" : ""}">${svg(t)}</span>`, iconSize: [38, 38], iconAnchor: [19, 36], popupAnchor: [0, -32] });
    const m = L.marker(ll, { icon, title: h.title, keyboard: true, alt: h.title }).addTo(map).bindPopup(popup(h, posts), { maxWidth: 280, minWidth: 240, className: "mcr-pop" });
    m._h = h; return m;
  });
  const fit = list => {
    if (!list.length) return map.setView([22.36, 114.17], 10);
    map.fitBounds(L.featureGroup(list).getBounds().pad(0.25), { maxZoom: 13 });
  };
  fit(markers);
  if (!pts.length) el.insertAdjacentHTML("beforeend", `<div class="map-empty">No pins yet. Add a map location to a hike in Admin.</div>`);

  // Filter chips + place list on the full map page
  if (opts.full) {
    const types = [...new Set(pts.map(x => typeOf(x.h)))];
    const chips = document.getElementById("mapChips"), list = document.getElementById("mapList");
    let cur = "All";
    const apply = () => {
      const vis = markers.filter(m => cur === "All" || (cur === "Upcoming" ? !isPast(m._h) : typeOf(m._h) === cur));
      markers.forEach(m => vis.includes(m) ? m.addTo(map) : m.remove());
      fit(vis);
      list.innerHTML = vis.sort((a, b) => String(b._h.date).localeCompare(String(a._h.date))).map(m => `<li><button type="button" data-id="${esc(m._h.id || m._h.title)}"><span class="pin sm t-${typeOf(m._h)}${isPast(m._h) ? "" : " up"}">${svg(typeOf(m._h))}</span><span><b>${esc(m._h.title)}</b><small>${esc([fmt(m._h.date), typeOf(m._h)].join(" · "))}</small></span></button></li>`).join("");
      list.querySelectorAll("button").forEach(b => b.onclick = () => {
        const m = vis.find(x => (x._h.id || x._h.title) === b.dataset.id);
        map.flyTo(m.getLatLng(), 14, { duration: .8 }); setTimeout(() => m.openPopup(), 850);
        el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
      });
    };
    const opts2 = ["All", ...(pts.some(x => !isPast(x.h)) ? ["Upcoming"] : []), ...types];
    chips.innerHTML = opts2.length > 2 ? opts2.map(t => `<button type="button" class="chip" aria-pressed="${t === cur}">${t === "All" || t === "Upcoming" ? "" : svg(t)}${t}</button>`).join("") : "";
    chips.querySelectorAll("button").forEach(b => b.onclick = () => { cur = b.textContent; chips.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); apply(); });
    apply();
    // map.html?h=<hike id> opens that pin
    const want = new URLSearchParams(location.search).get("h");
    const m = want && markers.find(x => x._h.id === want);
    if (m) { map.setView(m.getLatLng(), 14); m.openPopup(); }
  }
  // Leaflet needs a size recalculation if the container was hidden or resized
  setTimeout(() => map.invalidateSize(), 200);
  addEventListener("resize", () => map.invalidateSize());
}

function start({ site, hikes, posts }) {
  if (site.showMap === false) {
    document.querySelectorAll('[data-map="full"]').forEach(el => el.innerHTML = `<div class="map-empty">The map is switched off right now.</div>`);
    return;
  }
  document.querySelectorAll("[data-map]").forEach(el => {
    const go = () => build(el, hikes, posts, { full: el.dataset.map === "full" }).catch(() => { el.innerHTML = `<div class="map-empty">The map couldn't load. Check your connection and refresh.</div>`; });
    // Home page map loads only when it scrolls near view
    if (el.dataset.map === "full" || !("IntersectionObserver" in window)) return go();
    const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); go(); } }, { rootMargin: "400px" });
    io.observe(el);
  });
}
if (window.MCR && window.MCR.hikes) start(window.MCR);
else window.addEventListener("mcr:data", e => start(e.detail), { once: true });
})();
