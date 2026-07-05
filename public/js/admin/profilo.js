// Pagina profilo utente.
// - Modifica username / email / avatar
// - Cambio password con "unlock" a due step: prima devo verificare la
//   password attuale, poi si sblocca il form nuova password.
// - Il pattern di verifica riusa POST /api/auth/login (senza salvare il
//   nuovo token) invece di creare un endpoint /verify-password dedicato.

// Password vecchia gia' verificata in questa sessione della pagina.
// Se null significa che l'utente non ha ancora sbloccato il cambio pw.
// Viene azzerata dopo saveProfile o se ricarico la pagina.
let verifiedOldPw = null;

async function pageProfile() {
  const u = userInfo;

  document.getElementById("pageContent").innerHTML = `
    <div class="prof-card">

      <div class="prof-banner">
        <div class="prof-avatar-wrap">
          <div class="prof-avatar outfit" onclick="document.getElementById('avatarInput').click()">
            ${u.avatar_url ? `<img src="${u.avatar_url}">` : (u.username || "A")[0].toUpperCase()}
            <div class="prof-avatar-edit"></div>
          </div>
          <input type="file" id="avatarInput" accept="image/*" style="display:none" onchange="handleAvatarUpload(this)"/>
        </div>
      </div>

      <div class="prof-body">
        <div class="prof-name outfit">${esc(u.username)}</div>
        <div class="prof-email">${esc(u.email)} · <span class="b-admin" style="font-size:10px">${(u.role || "user").toUpperCase()}</span></div>
        <div class="prof-date">Membro dal ${u.created_at ? fd(u.created_at) : "—"}</div>
        <div class="prof-sep"></div>

        <div class="prof-section outfit">Modifica Profilo</div>
        <div class="fg">
          <label class="fl">Username</label>
          <input class="fi" id="pUser" value="${esc(u.username)}"/>
        </div>
        <div class="fg">
          <label class="fl">Email</label>
          <input class="fi" id="pEmail" value="${esc(u.email)}" type="email"/>
        </div>

        <div class="prof-sep"></div>

        <div class="prof-section outfit">Cambia Password</div>

        <div id="pwLocked" style="background:var(--s0,#f8fafc);border:1.5px dashed var(--border,#e2e8f0);border-radius:14px;padding:24px;text-align:center">
          <div style="font-size:32px;margin-bottom:10px;opacity:.5">🔒</div>
          <div style="font-size:14px;color:var(--text2,#64748b);margin-bottom:14px;line-height:1.5">Per motivi di sicurezza, inserisci la tua password attuale per sbloccare la modifica</div>
          <div style="display:flex;gap:8px;max-width:320px;margin:0 auto">
            <div style="position:relative;flex:1">
              <input class="fi" id="pVerifyPw" type="password" placeholder="Password attuale" autocomplete="new-password" style="padding-right:40px"/>
              <button type="button" class="pw-toggle-prof" onclick="togglePwProf('pVerifyPw',this)">•</button>
            </div>
            <button class="btn btn-p btn-sm" onclick="verifyAndUnlock()">Verifica</button>
          </div>
          <div id="verifyMsg" style="font-size:12px;margin-top:8px;min-height:18px"></div>
        </div>

        <div id="pwUnlocked" style="display:none">
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 16px;margin-bottom:16px;font-size:13px;color:#15803d;font-weight:500">Identità verificata — puoi cambiare la password</div>
          <div class="fg">
            <label class="fl">Nuova password</label>
            <div style="position:relative">
              <input class="fi" id="pNewPw" type="password" placeholder="Minimo 6 caratteri" autocomplete="new-password" style="padding-right:40px"/>
              <button type="button" class="pw-toggle-prof" onclick="togglePwProf('pNewPw',this)">•</button>
            </div>
          </div>
          <div class="fg">
            <label class="fl">Conferma nuova password</label>
            <div style="position:relative">
              <input class="fi" id="pConfPw" type="password" placeholder="Ripeti la nuova password" autocomplete="new-password" style="padding-right:40px"/>
              <button type="button" class="pw-toggle-prof" onclick="togglePwProf('pConfPw',this)">•</button>
            </div>
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
          <button class="btn btn-s" onclick="nav('dashboard')">Annulla</button>
          <button class="btn btn-p" onclick="saveProfile()">Salva Modifiche</button>
        </div>

      </div>
    </div>
  `;

  // Inietto lo stile del pulsante mostra/nascondi password una sola volta.
  if (!document.getElementById("profPwStyle")) {
    const s = document.createElement("style");
    s.id = "profPwStyle";
    s.textContent = `.pw-toggle-prof{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:16px;padding:6px;opacity:.45;transition:opacity .2s;color:var(--text,inherit)}.pw-toggle-prof:hover{opacity:.85}`;
    document.head.appendChild(s);
  }
}

// Toggle mostra/nascondi password.
function togglePwProf(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === "password") {
    input.type = "text";
    btn.textContent = "X";
  } else {
    input.type = "password";
    btn.textContent = "•";
  }
}

// Verifica la password attuale prima di permettere il cambio.
async function verifyAndUnlock() {
  const pw = document.getElementById("pVerifyPw").value;
  const msg = document.getElementById("verifyMsg");

  if (!pw) {
    msg.style.color = "#be123c";
    msg.textContent = "Inserisci la password";
    return;
  }

  msg.style.color = "var(--t6,#0d7a4d)";
  msg.textContent = "Verifica in corso...";

  try {
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userInfo.email, password: pw }),
    });

    if (r.ok) {
      verifiedOldPw = pw;
      document.getElementById("pwLocked").style.display = "none";
      document.getElementById("pwUnlocked").style.display = "block";
      toast("Identità verificata");
    } else {
      msg.style.color = "#be123c";
      msg.textContent = "✕ Password errata";
      document.getElementById("pVerifyPw").value = "";
      document.getElementById("pVerifyPw").focus();
    }
  } catch (e) {
    msg.style.color = "#be123c";
    msg.textContent = "Errore di connessione";
  }
}

// Upload avatar: leggo il file come base64 e lo mando direttamente nel campo avatar_url.
function handleAvatarUpload(input) {
  const file = input.files[0];
  if (!file) return;
  // Limite 2MB — sopra rischio di far esplodere il body JSON.
  if (file.size > 2 * 1024 * 1024) {
    toast("Immagine troppo grande (max 2MB)", "err");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const base64 = e.target.result;
    // Aggiorno l'anteprima subito, senza aspettare la risposta server.
    document.querySelector(".prof-avatar").innerHTML =
      `<img src="${base64}"><div class="prof-avatar-edit"></div>`;
    userInfo.avatar_url = base64;

    apiFetch("/me", {
      method: "PUT",
      body: JSON.stringify({
        username: userInfo.username,
        email: userInfo.email,
        avatar_url: base64,
      }),
    })
      .then(() => {
        localStorage.setItem("user", JSON.stringify(userInfo));
        updateHeader();
        toast("Avatar aggiornato!");
      })
      .catch((e) => toast(e.message, "err"));
  };
  reader.readAsDataURL(file);
}

// Salva le modifiche al profilo (con o senza cambio password).
async function saveProfile() {
  const username = document.getElementById("pUser").value.trim();
  const email = document.getElementById("pEmail").value.trim();
  // I campi password potrebbero non esistere se non ho sbloccato la sezione.
  const newPwEl = document.getElementById("pNewPw");
  const confPwEl = document.getElementById("pConfPw");
  const newPw = newPwEl ? newPwEl.value : "";
  const confPw = confPwEl ? confPwEl.value : "";

  if (!username || !email) {
    toast("Username e email obbligatori", "err");
    return;
  }

  // Se sta cambiando password valido tutti i vincoli.
  if (newPw) {
    if (newPw.length < 6) {
      toast("La nuova password deve avere almeno 6 caratteri", "err");
      return;
    }
    if (newPw !== confPw) {
      toast("Le password non coincidono", "err");
      return;
    }
    // Doppia sicurezza
    if (!verifiedOldPw) {
      toast("Devi prima verificare la tua identità", "err");
      return;
    }
  }

  try {
    const body = { username, email, avatar_url: userInfo.avatar_url };
    // Aggiungo i campi password solo se sto effettivamente cambiando.
    if (newPw && verifiedOldPw) {
      body.old_password = verifiedOldPw;
      body.new_password = newPw;
    }
    await apiFetch("/me", { method: "PUT", body: JSON.stringify(body) });
    userInfo.username = username;
    userInfo.email = email;
    localStorage.setItem("user", JSON.stringify(userInfo));
    updateHeader();
    // Reset dello stato "verificato": la prossima volta  rifare la verifica.
    verifiedOldPw = null;
    toast("Profilo aggiornato!");
    nav("profile");
  } catch (e) {
    toast(e.message, "err");
  }
}