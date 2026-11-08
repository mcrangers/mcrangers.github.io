/* Comments on blog posts. Accounts and comments are stored in Firebase (free plan).
 * Only verified CUHK emails (@link.cuhk.edu.hk or @cuhk.edu.hk) can post; anyone can read.
 * firestore.rules in this repo enforces the same thing on the server. */
const V = "13.2.0";
const CUHK = /@(link\.)?cuhk\.edu\.hk$/i;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const box = () => $("#cBox"), list = () => $("#cList");

function ago(ms) {
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " h ago";
  return new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
const friendly = e => {
  const c = (e && e.code) || "";
  if (c.includes("email-already-in-use")) return "That email already has an account. Sign in instead.";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found")) return "Email or password is wrong.";
  if (c.includes("weak-password")) return "Use at least 6 characters for your password.";
  if (c.includes("too-many-requests")) return "Too many tries. Wait a few minutes and try again.";
  if (c.includes("permission-denied")) return "You can't do that. Make sure your CUHK email is verified.";
  if (c.includes("network")) return "No connection. Check your internet and try again.";
  return "Something went wrong. Try again.";
};

async function start(post, site) {
  if (site.commentsEnabled === false) return;
  const cfg = site.firebase || {};
  if (!cfg.apiKey || !cfg.projectId) {
    list().innerHTML = "";
    box().innerHTML = `<div class="c-empty">Comments open soon.</div>`;
    return;
  }
  list().innerHTML = `<li class="c-empty">Loading comments…</li>`;
  let fb;
  try {
    const [app, auth, fs] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`)
    ]);
    const a = app.initializeApp({ apiKey: cfg.apiKey, authDomain: cfg.authDomain || `${cfg.projectId}.firebaseapp.com`, projectId: cfg.projectId, appId: cfg.appId });
    fb = { ...auth, ...fs, auth: auth.getAuth(a), db: fs.getFirestore(a) };
  } catch (e) {
    list().innerHTML = `<li class="c-empty">Comments couldn't load. Check your connection and refresh.</li>`;
    return;
  }
  const admins = (site.commentAdmins || []).map(x => String(x).toLowerCase());
  const col = fb.collection(fb.db, "comments");
  let user = null, comments = [];

  const canDelete = c => user && (c.uid === user.uid || admins.includes(String(user.email).toLowerCase()));
  function drawList() {
    if (!comments.length) { list().innerHTML = `<li class="c-empty">No comments yet. Be the first from the hike.</li>`; return; }
    list().innerHTML = comments.map(c => `<li class="c-item">
      <div class="c-top"><span class="c-name"><span class="av" aria-hidden="true">${esc((c.name || "?").trim().charAt(0).toUpperCase())}</span>${esc(c.name)}</span><span class="c-time">${c.createdAt ? ago(c.createdAt.toMillis()) : "just now"}</span></div>
      <p class="c-text">${esc(c.text)}</p>
      ${canDelete(c) ? `<button class="c-del" type="button" data-id="${esc(c.id)}">Delete</button>` : ""}
    </li>`).join("");
    list().querySelectorAll(".c-del").forEach(b => b.onclick = async () => {
      if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Tap again to delete"; return; }
      try { await fb.deleteDoc(fb.doc(fb.db, "comments", b.dataset.id)); } catch (e) { b.textContent = friendly(e); }
    });
  }
  fb.onSnapshot(fb.query(col, fb.where("postId", "==", post.id)), snap => {
    comments = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.createdAt ? a.createdAt.toMillis() : Infinity) - (b.createdAt ? b.createdAt.toMillis() : Infinity));
    drawList();
  }, () => { list().innerHTML = `<li class="c-empty">Comments couldn't load right now.</li>`; });

  /* ----- the box under the comments changes with sign-in state ----- */
  function signInBox(mode = "in", msg = "") {
    const up = mode === "up";
    box().innerHTML = `<form class="c-box" id="authForm" novalidate>
      <div class="c-tabs" role="tablist"><button type="button" role="tab" aria-selected="${!up}" data-m="in">Sign in</button><button type="button" role="tab" aria-selected="${up}" data-m="up">Create account</button></div>
      <h3>${up ? "Create an account" : "Sign in to comment"}</h3>
      <p class="hint">${up ? "Use your CUHK email (…@link.cuhk.edu.hk). We'll send a link to confirm it's you." : "Only CUHK emails can comment."}</p>
      ${up ? `<label for="aName">Name shown on comments</label><input id="aName" maxlength="40" autocomplete="nickname" required>` : ""}
      <label for="aEmail">CUHK email</label><input id="aEmail" type="email" inputmode="email" autocomplete="email" placeholder="1155xxxxxx@link.cuhk.edu.hk" required>
      <label for="aPass">Password</label><input id="aPass" type="password" autocomplete="${up ? "new-password" : "current-password"}" minlength="6" required>
      <div class="c-err" id="aErr" role="alert">${esc(msg)}</div>
      <div class="c-row"><button class="btn" type="submit">${up ? "Create account" : "Sign in"}</button>${up ? "" : `<button class="c-link" type="button" id="forgot">Forgot password?</button>`}</div>
    </form>`;
    box().querySelectorAll("[data-m]").forEach(b => b.onclick = () => signInBox(b.dataset.m));
    const err = m => $("#aErr").textContent = m;
    if ($("#forgot")) $("#forgot").onclick = async () => {
      const email = $("#aEmail").value.trim();
      if (!CUHK.test(email)) return err("Type your CUHK email first.");
      try { await fb.sendPasswordResetEmail(fb.auth, email); $("#aErr").outerHTML = `<p class="c-ok">Reset link sent. Check your CUHK inbox and Junk folder.</p>`; } catch (e) { err(friendly(e)); }
    };
    $("#authForm").onsubmit = async e => {
      e.preventDefault();
      const email = $("#aEmail").value.trim(), pass = $("#aPass").value;
      if (!CUHK.test(email)) return err("Use your CUHK email, ending in @link.cuhk.edu.hk.");
      if (pass.length < 6) return err("Use at least 6 characters for your password.");
      const btn = e.submitter || box().querySelector("button[type=submit]"); btn.disabled = true;
      try {
        if (up) {
          const name = $("#aName").value.trim();
          if (!name) { btn.disabled = false; return err("Add the name people will see."); }
          const cred = await fb.createUserWithEmailAndPassword(fb.auth, email, pass);
          await fb.updateProfile(cred.user, { displayName: name });
          await fb.sendEmailVerification(cred.user, { url: location.href });
        } else await fb.signInWithEmailAndPassword(fb.auth, email, pass);
      } catch (e2) { err(friendly(e2)); btn.disabled = false; }
    };
  }
  function verifyBox(msg = "") {
    box().innerHTML = `<div class="c-box">
      <h3>Check your CUHK inbox</h3>
      <p class="hint">We sent a confirmation link to <b>${esc(user.email)}</b>. Open it, then come back and tap “I've confirmed”. It often lands in <b>Junk</b>.</p>
      <div class="c-err" role="alert">${esc(msg)}</div>
      <div class="c-row"><button class="btn" type="button" id="vDone">I've confirmed</button><button class="c-link" type="button" id="vAgain">Send it again</button><button class="c-link" type="button" id="vOut">Sign out</button></div>
    </div>`;
    $("#vDone").onclick = async () => { await user.reload(); await user.getIdToken(true); user.emailVerified ? writeBox() : verifyBox("Not confirmed yet. Open the link in the email first."); };
    $("#vAgain").onclick = async () => { try { await fb.sendEmailVerification(user, { url: location.href }); verifyBox("Sent again."); } catch (e) { verifyBox(friendly(e)); } };
    $("#vOut").onclick = () => fb.signOut(fb.auth);
  }
  function writeBox(msg = "") {
    box().innerHTML = `<form class="c-box" id="cForm" novalidate>
      <p class="c-who">Commenting as <b>${esc(user.displayName || user.email.split("@")[0])}</b> · <button class="c-link" type="button" id="cOut">Sign out</button></p>
      <label for="cText">Your comment</label>
      <textarea id="cText" maxlength="1000" placeholder="How was the hike?" required></textarea>
      <div class="c-err" id="cErr" role="alert">${esc(msg)}</div>
      <div class="c-row"><button class="btn" type="submit">Post comment</button></div>
    </form>`;
    $("#cOut").onclick = () => fb.signOut(fb.auth);
    $("#cForm").onsubmit = async e => {
      e.preventDefault();
      const text = $("#cText").value.trim();
      if (!text) return $("#cErr").textContent = "Write something first.";
      const btn = box().querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = "Posting…";
      try {
        await fb.addDoc(col, { postId: post.id, text, name: (user.displayName || user.email.split("@")[0]).slice(0, 40), uid: user.uid, createdAt: fb.serverTimestamp() });
        $("#cText").value = ""; $("#cErr").textContent = "";
      } catch (e2) { $("#cErr").textContent = friendly(e2); }
      btn.disabled = false; btn.textContent = "Post comment";
    };
  }
  fb.onAuthStateChanged(fb.auth, u => {
    user = u; drawList();
    if (!u) return signInBox();
    if (!CUHK.test(u.email || "")) { fb.signOut(fb.auth); return signInBox("in", "Only CUHK emails can comment."); }
    u.emailVerified ? writeBox() : verifyBox();
  });
}

if (window.MCR && window.MCR.post) start(window.MCR.post, window.MCR.site);
else window.addEventListener("mcr:post", e => start(e.detail.post, e.detail.site), { once: true });
