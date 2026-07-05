const PR = {
  me: null,       // dati utente completi caricati da GET /me
  saving: false,  // lock anti doppio-click sul salva info
};

// Carica i dati utente e disegna la pagina.
async function loadProfilePage() {
  if (!NM.user) {
    return goLogin();
  }

  renderProfileSkeleton();
  const res = await api("/api/user/me");
  if (!res.ok) {
    if (res.status === 401) return goLogin();
    renderProfileError(res.data.error || "Impossibile caricare il profilo");
    return;
  }
  PR.me = res.data;
  document.title = "NETMED";

  renderProfileHero();
  renderProfileForms();
}

// Placeholder grigio mentre parte la fetch dei dati.
function renderProfileSkeleton() {
  const hero = document.getElementById("upHero");
  if (!hero) return;
  hero.innerHTML = `
    <div class="up-hero-banner"></div>
    <div class="up-hero-body up-loading">
      <div class="up-avatar sk" style="background:var(--surface-2);color:transparent">.</div>
      <div class="up-id">
        <div class="up-id-name">.</div>
        <div class="up-id-email">.</div>
      </div>
    </div>
  `;
}

// Header del profilo: banner + avatar cliccabile + nome + card "profilo verificato".
function renderProfileHero() {
  const hero = document.getElementById("upHero");
  if (!hero || !PR.me) return;
  const initial = (PR.me.username || "U").charAt(0).toUpperCase();
  const isAdmin = PR.me.role === "admin";
  const hasAvatar = !!PR.me.avatar_url;

  //Avatar: se ho una foto la mostro, altrimenti prima lettera del nome.
  const avatarInner = hasAvatar
    ? `<img src="${escapeHtml(PR.me.avatar_url)}" alt="Foto profilo" class="up-avatar-img" loading="lazy"/>`
    : escapeHtml(initial);

  // Card "profilo verificato": visibile solo agli utenti creator (is_verified=true).
  // L'admin non ha profilo creator (non pubblica) quindi lo escludo qui.
  const isVerified = !!PR.me.is_verified && !isAdmin;
  const vp = PR.me.verified_profile || {};
  const hasAnyVp = !!(vp.title || vp.organization || vp.credentials || vp.bio);
  const verifiedCard = isVerified
    ? `
    <div class="up-verified-card" id="upVerifiedCard">
      <div class="up-verified-head">
        <span class="verified-tick lg"></span>
        <span>Account verificato NETMED</span>
        <button type="button" class="up-verified-edit" onclick="prToggleVerifiedEdit(true)">
          ${hasAnyVp ? "Modifica" : "Aggiungi specifiche"}
        </button>
      </div>
      ${
        hasAnyVp
          ? `
        ${vp.title ? `<div class="up-verified-row"><b>Titolo:</b> ${escapeHtml(vp.title)}</div>` : ""}
        ${vp.organization ? `<div class="up-verified-row"><b>Organizzazione:</b> ${escapeHtml(vp.organization)}</div>` : ""}
        ${vp.credentials ? `<div class="up-verified-row"><b>Credenziali:</b> ${escapeHtml(vp.credentials)}</div>` : ""}
        ${vp.bio ? `<div class="up-verified-row up-verified-bio">${escapeHtml(vp.bio)}</div>` : ""}
      `
          : `
        <div class="up-verified-row up-verified-empty">
          Compila le tue specifiche professionali: appariranno nella tua pagina pubblica e accanto ai tuoi video.
        </div>
      `
      }
      ${PR.me.verified_at ? `<div class="up-verified-meta">Verificato ${timeAgo(PR.me.verified_at)}</div>` : ""}
    </div>
    <div class="up-verified-card up-verified-edit-form" id="upVerifiedEdit" style="display:none">
      <div class="up-verified-head">
        <span class="verified-tick lg"></span>
        <span>Modifica profilo verificato</span>
      </div>
      <div class="up-vf-row">
        <label>Titolo professionale</label>
        <input type="text" id="vpTitle" maxlength="120"
               placeholder="es. Dott.ssa, Prof., MD, Specialista in cardiologia"
               value="${escapeHtml(vp.title || "")}"/>
      </div>
      <div class="up-vf-row">
        <label>Organizzazione</label>
        <input type="text" id="vpOrg" maxlength="160"
               placeholder="es. Ospedale San Raffaele, Università di Bologna"
               value="${escapeHtml(vp.organization || "")}"/>
      </div>
      <div class="up-vf-row">
        <label>Credenziali / Albo</label>
        <input type="text" id="vpCred" maxlength="200"
               placeholder="es. Albo Medici Roma n. 12345, ORCID 0000-0001-..."
               value="${escapeHtml(vp.credentials || "")}"/>
      </div>
      <div class="up-vf-row">
        <label>Bio breve</label>
        <textarea id="vpBio" maxlength="600" rows="3"
                  placeholder="Una breve presentazione visibile nella tua pagina pubblica (max 600 caratteri)">${escapeHtml(vp.bio || "")}</textarea>
      </div>
      <div class="up-vf-row">
        <label>Email di contatto pubblica <span style="color:var(--text3);font-weight:400">(opzionale)</span></label>
        <input type="email" id="vpEmail" maxlength="120"
               placeholder="email@ospedalexyz.it"
               value="${escapeHtml(vp.public_email || "")}"/>
        <div style="font-size:12px;color:var(--text3);margin-top:4px;line-height:1.5">
          Visibile agli altri utenti nella tua pagina creator. Lasciala vuota se non vuoi essere contattato via email.
        </div>
      </div>
      <div class="up-vf-row">
        <label>Telefono / WhatsApp <span style="color:var(--text3);font-weight:400">(opzionale)</span></label>
        <input type="tel" id="vpPhone" maxlength="40"
               placeholder="+39 348 123 4567"
               value="${escapeHtml(vp.public_phone || "")}"/>
        <div style="font-size:12px;color:var(--text3);margin-top:4px;line-height:1.5">
          Visibile agli altri utenti. Utile se ricevi richieste di consulto a distanza.
        </div>
      </div>
      <div class="up-vf-actions">
        <button type="button" class="up-id-link" onclick="prToggleVerifiedEdit(false)">Annulla</button>
        <button type="button" class="up-vf-save" onclick="prSaveVerifiedProfile()">Salva</button>
      </div>
    </div>
  `
    : "";

  hero.innerHTML = `
    <div class="up-hero-banner"></div>
    <div class="up-hero-body">
      <div class="up-avatar up-avatar-edit"
           role="button" tabindex="0"
           title="Cambia foto profilo"
           onclick="prPickAvatar()"
           onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();prPickAvatar();}">
        ${avatarInner}
        <button type="button" class="up-avatar-badge" onclick="prPickAvatar()" aria-label="Cambia foto profilo">+</button>
        <input type="file" id="upAvatarFile"
               accept="image/png,image/jpeg,image/webp,image/gif"
               style="display:none"
               onchange="prUploadAvatar(this)"/>
      </div>
      <div class="up-id">
        <div class="up-id-name">
          <span>${escapeHtml(PR.me.username)}</span>
          ${verifiedTickHTML(isVerified, vp, "lg")}
          ${isAdmin ? `<span class="up-id-badge">Admin</span>` : ""}
        </div>
        <div class="up-id-email">${escapeHtml(PR.me.email || "")}</div>
        <div class="up-id-meta">Iscritto ${timeAgo(PR.me.created_at)}</div>
        <div class="up-id-actions">
          ${hasAvatar ? `<button type="button" class="up-id-link danger" onclick="prRemoveAvatar()">Rimuovi foto</button>` : ""}
        </div>
        ${verifiedCard}
      </div>
    </div>
  `;
}

// Apre il file picker per cambiare la foto profilo.
function prPickAvatar() {
  const f = document.getElementById("upAvatarFile");
  if (f) f.click();
}

// Legge il file scelto, valida tipo e peso, e lo manda al backend
async function prUploadAvatar(input) {
  if (!input || !input.files || !input.files[0]) return;
  const file = input.files[0];

  if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) {
    toast("Formato non supportato. Usa PNG, JPG, WEBP o GIF.", "err");
    input.value = "";
    return;
  }
  if (file.size > 600 * 1024) {
    toast("Immagine troppo grande (max 600 KB).", "err");
    input.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onerror = () => toast("Lettura file non riuscita", "err");
  reader.onload = async () => {
    const dataUrl = reader.result;
    toast("Caricamento foto…", "info");
    const res = await api("/api/user/me/avatar", {
      method: "POST",
      body: { data_url: dataUrl },
    });
    input.value = "";
    if (!res.ok) {
      toast(res.data.error || "Caricamento non riuscito", "err");
      return;
    }
    PR.me = { ...PR.me, ...res.data.user };
    // Aggiorno anche localStorage cosi' l'header vede subito il nuovo avatar.
    if (NM.user) {
      NM.user.avatar_url = res.data.user.avatar_url;
      localStorage.setItem(
        "user",
        JSON.stringify({
          id: NM.user.id,
          username: NM.user.username,
          email: NM.user.email,
          role: NM.user.role,
          avatar_url: res.data.user.avatar_url,
        })
      );
    }
    renderProfileHero();
    if (typeof renderHeaderUser === "function") renderHeaderUser();
    toast("Foto profilo aggiornata", "ok");
  };
  reader.readAsDataURL(file);
}

// Cancella la foto profilo, torno all'avatar con l'iniziale.
async function prRemoveAvatar() {
  const ok = await nmConfirm({
    title: "Rimuovere la foto profilo?",
    message: "La tua immagine attuale verrà eliminata e tornerai all'avatar predefinito.",
    okLabel: "Rimuovi",
    cancelLabel: "Annulla",
    danger: true,
  });
  if (!ok) return;
  const res = await api("/api/user/me/avatar", { method: "DELETE" });
  if (!res.ok) {
    toast(res.data.error || "Rimozione non riuscita", "err");
    return;
  }
  PR.me.avatar_url = null;
  if (NM.user) {
    NM.user.avatar_url = null;
    localStorage.setItem(
      "user",
      JSON.stringify({
        id: NM.user.id,
        username: NM.user.username,
        email: NM.user.email,
        role: NM.user.role,
        avatar_url: null,
      })
    );
  }
  renderProfileHero();
  if (typeof renderHeaderUser === "function") renderHeaderUser();
  toast("Foto profilo rimossa", "ok");
}

// Mostra/nasconde il form di modifica del profilo verificato.
function prToggleVerifiedEdit(show) {
  const card = document.getElementById("upVerifiedCard");
  const edit = document.getElementById("upVerifiedEdit");
  if (!card || !edit) return;
  card.style.display = show ? "none" : "";
  edit.style.display = show ? "" : "none";
  if (show) {
    setTimeout(() => document.getElementById("vpTitle")?.focus(), 30);
  }
}

// Manda al backend i nuovi dati del profilo verificato.
async function prSaveVerifiedProfile() {
  const title = (document.getElementById("vpTitle").value || "").trim();
  const organization = (document.getElementById("vpOrg").value || "").trim();
  const credentials = (document.getElementById("vpCred").value || "").trim();
  const bio = (document.getElementById("vpBio").value || "").trim();
  const publicEmail = (document.getElementById("vpEmail")?.value || "").trim();
  const publicPhone = (document.getElementById("vpPhone")?.value || "").trim();

  // Validazione base dei contatti pubblici.
  if (publicEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(publicEmail)) {
    toast("Email di contatto non valida", "err");
    return;
  }
  if (publicPhone && publicPhone.length > 40) {
    toast("Telefono troppo lungo", "err");
    return;
  }

  const res = await api("/api/user/me/verified-profile", {
    method: "PUT",
    body: {
      title,
      organization,
      credentials,
      bio,
      public_email: publicEmail,
      public_phone: publicPhone,
    },
  });
  if (!res.ok) {
    toast(res.data.error || "Salvataggio non riuscito", "err");
    return;
  }
  PR.me = { ...PR.me, ...res.data.user };
  renderProfileHero();
  if (typeof renderHeaderUser === "function") renderHeaderUser();
  toast("Profilo verificato aggiornato", "ok");
}

// Disegna le sezioni del profilo (impostazioni, info, richiesta creator, password, elimina).
function renderProfileForms() {
  const box = document.getElementById("upForms");
  if (!box || !PR.me) return;

  const isAdmin = PR.me.role === "admin";
  const isVerified = !!PR.me.is_verified;
  const reqPending = !!PR.me.verified_request;

  // "Diventa creator": solo per utenti standard (no admin, no già verificati).
  let becomeCreatorHtml = "";
  if (!isAdmin && !isVerified) {
    if (reqPending) {
      becomeCreatorHtml = `
        <section class="up-section">
          <div class="up-section-h">
            <h2>Richiesta creator</h2>
          </div>
          <div class="up-creator-pending">
            <strong>Richiesta inviata.</strong>
            <span>Un amministratore verifichera' la tua richiesta. Riceverai una notifica quando sara' approvata o rifiutata.</span>
          </div>
        </section>
      `;
    } else {
      becomeCreatorHtml = `
        <section class="up-section">
          <div class="up-section-h">
            <h2>Diventa creator</h2>
          </div>
          <p class="up-section-d">
            Sei un medico o un professionista sanitario? Invia una richiesta
            per diventare creator: potrai caricare video divulgativi e moderare
            i commenti dei tuoi spettatori. Un admin verifichera' i dati.
          </p>
          <div class="up-form">
            <div class="up-fg">
              <label class="up-fl">Titolo</label>
              <input class="up-fi" id="upReqTitle" type="text" maxlength="60" list="upReqTitleList" placeholder="Dr., Dr.ssa, Prof.…" autocomplete="off"/>
              <datalist id="upReqTitleList">
                <option value="Dr."></option><option value="Dr.ssa"></option>
                <option value="Dott."></option><option value="Dott.ssa"></option>
                <option value="Prof."></option><option value="Prof.ssa"></option>
              </datalist>
            </div>
            <div class="up-fg">
              <label class="up-fl">Qualifica / specializzazione</label>
              <input class="up-fi" id="upReqQual" type="text" maxlength="120" list="upReqQualList" placeholder="es. Cardiologo, Fisioterapista…" autocomplete="off"/>
              <datalist id="upReqQualList">
                <option value="Medico di medicina generale"></option>
                <option value="Cardiologo"></option><option value="Cardiologa"></option>
                <option value="Neurologo"></option><option value="Neurologa"></option>
                <option value="Ortopedico"></option><option value="Ortopedica"></option>
                <option value="Fisioterapista"></option>
                <option value="Pediatra"></option>
                <option value="Ginecologo"></option><option value="Ginecologa"></option>
                <option value="Dermatologo"></option><option value="Dermatologa"></option>
                <option value="Oculista"></option>
                <option value="Otorinolaringoiatra"></option>
                <option value="Psicologo"></option><option value="Psicologa"></option>
                <option value="Psichiatra"></option>
                <option value="Radiologo"></option><option value="Radiologa"></option>
                <option value="Chirurgo"></option><option value="Chirurga"></option>
                <option value="Infermiere"></option><option value="Infermiera"></option>
                <option value="Specializzando"></option><option value="Specializzanda"></option>
                <option value="Docente universitario"></option>
              </datalist>
            </div>
            <div class="up-fg span2">
              <label class="up-fl">Organizzazione</label>
              <input class="up-fi" id="upReqOrg" type="text" maxlength="160" placeholder="Ospedale, universita', studio…" autocomplete="off"/>
              <div class="up-fhint">Facoltativa. Aiuta l'admin a verificare la tua richiesta.</div>
            </div>
          </div>
          <div class="up-form-actions">
            <button class="up-btn primary" id="upReqBtn" onclick="prSubmitCreatorRequest()">Invia richiesta</button>
          </div>
        </section>
      `;
    }
  }

  // Leggo tema e lingua correnti da localStorage / NMI18n.
  const curTheme = (typeof localStorage !== "undefined" && localStorage.getItem("nm_theme")) || "dark";
  const curLang = (typeof window.NMI18n === "object" && typeof window.NMI18n.getLang === "function")
    ? window.NMI18n.getLang()
    : ((typeof localStorage !== "undefined" && localStorage.getItem("nm_lang")) || "it");

  box.innerHTML = `
    <!-- Impostazioni: tema + lingua -->
    <section class="up-section">
      <div class="up-section-h">
        <h2 data-i18n="profile.settings">Impostazioni</h2>
      </div>
      <p class="up-section-d" data-i18n="profile.settings_desc">Personalizza l'aspetto e la lingua dell'interfaccia. Le scelte vengono salvate sul tuo browser.</p>
      <div class="up-form">
        <div class="up-fg">
          <label class="up-fl" data-i18n="profile.theme">Tema</label>
          <div class="up-seg" role="radiogroup" aria-label="Tema chiaro/scuro" style="display:inline-flex;background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:4px;gap:4px">
            <button type="button" role="radio" aria-checked="${curTheme==='light'}"
                    class="up-seg-btn ${curTheme==='light'?'active':''}" onclick="prSetTheme('light')"
                    style="padding:8px 14px;border:0;background:${curTheme==='light'?'var(--primary)':'transparent'};color:${curTheme==='light'?'#fff':'var(--text)'};border-radius:7px;font-weight:600;cursor:pointer;font-size:13px;display:inline-flex;align-items:center;gap:7px">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
              <span data-i18n="profile.theme_light">Chiaro</span>
            </button>
            <button type="button" role="radio" aria-checked="${curTheme==='dark'}"
                    class="up-seg-btn ${curTheme==='dark'?'active':''}" onclick="prSetTheme('dark')"
                    style="padding:8px 14px;border:0;background:${curTheme==='dark'?'var(--primary)':'transparent'};color:${curTheme==='dark'?'#fff':'var(--text)'};border-radius:7px;font-weight:600;cursor:pointer;font-size:13px;display:inline-flex;align-items:center;gap:7px">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              <span data-i18n="profile.theme_dark">Scuro</span>
            </button>
          </div>
        </div>
        <div class="up-fg">
          <label class="up-fl" data-i18n="profile.language">Lingua</label>
          <div class="up-seg" role="radiogroup" aria-label="Lingua interfaccia" style="display:inline-flex;background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:4px;gap:4px">
            <button type="button" role="radio" aria-checked="${curLang==='it'}"
                    class="up-seg-btn ${curLang==='it'?'active':''}" onclick="prSetLang('it')"
                    style="padding:8px 14px;border:0;background:${curLang==='it'?'var(--primary)':'transparent'};color:${curLang==='it'?'#fff':'var(--text)'};border-radius:7px;font-weight:700;cursor:pointer;font-size:13px;min-width:54px">IT</button>
            <button type="button" role="radio" aria-checked="${curLang==='en'}"
                    class="up-seg-btn ${curLang==='en'?'active':''}" onclick="prSetLang('en')"
                    style="padding:8px 14px;border:0;background:${curLang==='en'?'var(--primary)':'transparent'};color:${curLang==='en'?'#fff':'var(--text)'};border-radius:7px;font-weight:700;cursor:pointer;font-size:13px;min-width:54px">EN</button>
          </div>
        </div>
      </div>
    </section>

    <!-- Info anagrafica -->
    <section class="up-section">
      <div class="up-section-h">
        <h2>Informazioni profilo</h2>
      </div>
      <p class="up-section-d">Aggiorna l'username del tuo account. L'email non può essere modificata, contatta l'admin se serve.</p>
      <div class="up-form">
        <div class="up-fg">
          <label class="up-fl">Username</label>
          <input class="up-fi" id="upUsername" type="text" maxlength="60" minlength="3" value="${escapeHtml(PR.me.username || "")}"/>
          <div class="up-fhint">Tra 3 e 60 caratteri. Visibile pubblicamente sui commenti.</div>
        </div>
        <div class="up-fg">
          <label class="up-fl">Email <span class="up-fl-lock" aria-label="Non modificabile">*</span></label>
          <input class="up-fi" id="upEmail" type="email" value="${escapeHtml(PR.me.email || "")}" readonly disabled aria-readonly="true"/>
          <div class="up-fhint">Usata per accedere. Non modificabile dall'utente.</div>
        </div>
      </div>
      <div class="up-form-actions">
        <button class="up-btn ghost" onclick="prResetInfo()">Annulla</button>
        <button class="up-btn primary" id="upInfoBtn" onclick="prSaveInfo()">Salva modifiche</button>
      </div>
    </section>

    ${becomeCreatorHtml}

    <!-- Cambio password -->
    <section class="up-section">
      <div class="up-section-h">
        <h2>Sicurezza</h2>
      </div>
      <p class="up-section-d">Cambia la tua password. Min 8 caratteri, una maiuscola, una minuscola, una cifra, un simbolo.</p>
      <div class="up-form">
        <div class="up-fg span2">
          <label class="up-fl">Password attuale</label>
          <div class="up-pw-wrap">
            <!-- readonly + onfocus="removeAttribute('readonly')": trick per
                 impedire al browser di autocompilare la password attuale. -->
            <input class="up-fi up-pw-input" id="upPwdOld" type="password"
                   autocomplete="off" autocorrect="off" autocapitalize="off"
                   spellcheck="false" readonly
                   onfocus="this.removeAttribute('readonly')"/>
            <button type="button" class="up-pw-toggle" onclick="prTogglePw('upPwdOld', this)" aria-label="Mostra/nascondi password"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
          </div>
          <div class="up-fhint">Per sicurezza la password attuale non viene precompilata dal browser.</div>
        </div>
        <div class="up-fg">
          <label class="up-fl">Nuova password</label>
          <div class="up-pw-wrap">
            <input class="up-fi up-pw-input" id="upPwdNew" type="password" minlength="8"
                   autocomplete="new-password" oninput="prUpdatePwdStrength()"/>
            <button type="button" class="up-pw-toggle" onclick="prTogglePw('upPwdNew', this)" aria-label="Mostra/nascondi password"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
          </div>
          <div class="up-pw-meter" aria-hidden="true">
            <div class="up-pw-meter-bar" id="upPwdMeterBar"></div>
          </div>
          <div class="up-fhint" id="upPwdStrengthHint">Min 8 caratteri, maiuscola, minuscola, cifra, simbolo.</div>
        </div>
        <div class="up-fg">
          <label class="up-fl">Conferma nuova password</label>
          <div class="up-pw-wrap">
            <input class="up-fi up-pw-input" id="upPwdConf" type="password" minlength="8" autocomplete="new-password"/>
            <button type="button" class="up-pw-toggle" onclick="prTogglePw('upPwdConf', this)" aria-label="Mostra/nascondi password"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
          </div>
          <div class="up-fhint" id="upPwdMatchHint"></div>
        </div>
      </div>
      <div class="up-form-actions">
        <button class="up-btn ghost" onclick="prResetPassword()">Pulisci</button>
        <button class="up-btn primary" id="upPwdBtn" onclick="prChangePassword()">Aggiorna password</button>
      </div>
    </section>

    <!-- Elimina account (il logout sta nel dropdown dell'header) -->
    <section class="up-section danger">
      <div class="up-section-h">
        <h2>Elimina account</h2>
      </div>
      <div class="up-danger-row">
        <div class="up-danger-info">
          <strong>Elimina account</strong>
          <span>${
            isAdmin
              ? "Gli amministratori non possono cancellare il proprio account dalla pagina utente."
              : "Verra' registrata nell'audit log. Perderai commenti, voti, preferiti e segnalazioni."
          }</span>
        </div>
        <button class="up-btn danger" onclick="prOpenDelete()" ${isAdmin ? "disabled" : ""}>
          Elimina account
        </button>
      </div>
    </section>
  `;

  // Controllo live che le due nuove password coincidano.
  const conf = document.getElementById("upPwdConf");
  const np = document.getElementById("upPwdNew");
  const hint = document.getElementById("upPwdMatchHint");
  function checkMatch() {
    if (!conf.value) {
      hint.className = "up-fhint";
      hint.textContent = "";
      return;
    }
    if (conf.value === np.value) {
      hint.className = "up-fhint";
      hint.style.color = "var(--green)";
      hint.textContent = "Le password corrispondono";
    } else {
      hint.className = "up-fhint err";
      hint.style.color = "";
      hint.textContent = "Le password non corrispondono";
    }
  }
  if (conf && np) {
    conf.addEventListener("input", checkMatch);
    np.addEventListener("input", checkMatch);
  }
}

// Salva username + email. L'email in realta' e' readonly, la mando comunque col valore originale cosi' non accetto modifiche via DevTools.
async function prSaveInfo() {
  if (PR.saving) return;
  const username = document.getElementById("upUsername").value.trim();
  const email = PR.me && PR.me.email ? PR.me.email : "";

  if (!username || username.length < 3) {
    toast("Username troppo corto (min 3 caratteri)", "err");
    return;
  }
  if (username.length > 60) {
    toast("Username troppo lungo (max 60 caratteri)", "err");
    return;
  }

  PR.saving = true;
  const btn = document.getElementById("upInfoBtn");
  if (btn) btn.disabled = true;

  const res = await api("/api/user/me", {
    method: "PUT",
    body: { username, email },
  });

  PR.saving = false;
  if (btn) btn.disabled = false;

  if (!res.ok) {
    toast(res.data.error || "Salvataggio fallito", "err");
    return;
  }

  // Nuovo token se e' cambiato lo username (il payload JWT lo contiene).
  if (res.data.token) {
    localStorage.setItem("token", res.data.token);
    NM.token = res.data.token;
  }
  if (res.data.user) {
    localStorage.setItem(
      "user",
      JSON.stringify({
        id: res.data.user.id,
        username: res.data.user.username,
        email: res.data.user.email,
        role: res.data.user.role,
      })
    );
    NM.user = res.data.user;
  }
  PR.me = { ...PR.me, ...res.data.user };
  renderProfileHero();
  renderHeaderUser();
  toast("Profilo aggiornato", "ok");
}

// Ripristina i campi ai valori originali (in caso di annulla).
function prResetInfo() {
  if (!PR.me) return;
  document.getElementById("upUsername").value = PR.me.username || "";
  const eml = document.getElementById("upEmail");
  if (eml) eml.value = PR.me.email || "";
}

// Invia la richiesta di diventare creator. Stesso endpoint del form registrazione, ma per utenti che non l'hanno selezionato all'iscrizione.
async function prSubmitCreatorRequest() {
  const btn = document.getElementById("upReqBtn");
  const tEl = document.getElementById("upReqTitle");
  const qEl = document.getElementById("upReqQual");
  const oEl = document.getElementById("upReqOrg");
  const title = ((tEl && tEl.value) || "").trim();
  const qual = ((qEl && qEl.value) || "").trim();
  const org = ((oEl && oEl.value) || "").trim();

  if (!title && !qual) {
    toast("Compila almeno titolo o qualifica", "err");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Invio...";
  }
  const r = await api("/api/user/me/request-creator", {
    method: "POST",
    body: { title: title, qualifica: qual, organization: org },
  });

  if (!r.ok) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Invia richiesta";
    }
    toast((r.data && r.data.error) || "Impossibile inviare la richiesta", "err");
    return;
  }

  PR.me.verified_request = true;
  toast("Richiesta inviata. L'admin la verifichera' a breve.", "ok");
  renderProfileForms();
}
window.prSubmitCreatorRequest = prSubmitCreatorRequest;

// Cambio password: valida i tre campi, chiama il backend.
async function prChangePassword() {
  const oldEl = document.getElementById("upPwdOld");
  const newEl = document.getElementById("upPwdNew");
  const conEl = document.getElementById("upPwdConf");
  if (!oldEl || !newEl || !conEl) return;

  const oldPwd = oldEl.value;
  const newPwd = newEl.value;
  const conPwd = conEl.value;

  if (!oldPwd || !newPwd || !conPwd) {
    toast("Compila tutti i campi", "err");
    return;
  }
  const pErr = prClientPasswordError(newPwd);
  if (pErr) {
    toast(pErr, "err");
    return;
  }
  if (newPwd !== conPwd) {
    toast("Le due nuove password non coincidono", "err");
    return;
  }
  if (newPwd === oldPwd) {
    toast("La nuova password deve essere diversa dall'attuale", "err");
    return;
  }

  const btn = document.getElementById("upPwdBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Salvataggio…";
  }
  const r = await api("/api/user/me/password", {
    method: "PUT",
    body: { old_password: oldPwd, new_password: newPwd },
  });
  if (btn) {
    btn.disabled = false;
    btn.textContent = "Cambia password";
  }

  if (!r.ok) {
    toast((r.data && r.data.error) || "Cambio password fallito", "err");
    return;
  }
  oldEl.value = "";
  newEl.value = "";
  conEl.value = "";
  toast(r.data.message || "Password aggiornata. Email di conferma in arrivo.", "ok");
}
window.prChangePassword = prChangePassword;

// Svuota i tre campi password.
function prResetPassword() {
  ["upPwdOld", "upPwdNew", "upPwdConf"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  prUpdatePwdStrength();
}
window.prResetPassword = prResetPassword;

// Regole password lato client (stesse del backend).
function prClientPasswordError(pwd) {
  pwd = String(pwd || "");
  if (pwd.length < 8) return "Min 8 caratteri";
  if (pwd.length > 72) return "Max 72 caratteri";
  if (!/[a-z]/.test(pwd)) return "Serve almeno una lettera minuscola";
  if (!/[A-Z]/.test(pwd)) return "Serve almeno una lettera maiuscola";
  if (!/[0-9]/.test(pwd)) return "Serve almeno una cifra";
  if (!/[^A-Za-z0-9]/.test(pwd)) return "Serve almeno un simbolo (es. !@#$%)";
  return null;
}

function prPasswordScore(pwd) {
  pwd = String(pwd || "");
  if (!pwd) return 0;
  let s = 0;
  if (pwd.length >= 8) s++;
  if (pwd.length >= 12) s++;
  let classes = 0;
  if (/[a-z]/.test(pwd)) classes++;
  if (/[A-Z]/.test(pwd)) classes++;
  if (/[0-9]/.test(pwd)) classes++;
  if (/[^A-Za-z0-9]/.test(pwd)) classes++;
  if (classes >= 3) s++;
  if (classes === 4 && pwd.length >= 10) s++;
  return Math.min(s, 4);
}

// Aggiorna barra colorata + testo hint sotto la nuova password.
function prUpdatePwdStrength() {
  const el = document.getElementById("upPwdNew");
  const bar = document.getElementById("upPwdMeterBar");
  const hint = document.getElementById("upPwdStrengthHint");
  if (!el || !bar || !hint) return;
  const pwd = el.value || "";
  const score = prPasswordScore(pwd);
  const labels = ["", "Debole", "Mediocre", "Buona", "Forte"];
  const colors = ["#3a3f3d", "#a02828", "#c98a2a", "#198754", "#0a6b3a"];
  const widthPct = [0, 25, 50, 75, 100];
  bar.style.width = widthPct[score] + "%";
  bar.style.background = colors[score];
  if (!pwd) {
    hint.textContent = "Min 8 caratteri, maiuscola, minuscola, cifra, simbolo.";
    hint.style.color = "";
    return;
  }
  const err = prClientPasswordError(pwd);
  if (err) {
    hint.textContent = err;
    hint.style.color = "#d6604a";
  } else {
    hint.textContent = "Robustezza: " + labels[score];
    hint.style.color = "#7ab98d";
  }
}
window.prUpdatePwdStrength = prUpdatePwdStrength;

// Toggle occhio per mostrare/nascondere la password.
function prTogglePw(inputId, btn) {
  const i = document.getElementById(inputId);
  if (!i) return;
  i.type = i.type === "password" ? "text" : "password";
  if (btn) btn.textContent = i.type === "text" ? "x" : "o";
}
window.prTogglePw = prTogglePw;

// Apri modale di conferma eliminazione account.
function prOpenDelete() {
  const bg = document.getElementById("upDeleteModal");
  if (!bg) return;
  bg.classList.add("open");
  const inp = document.getElementById("upDeleteConfirm");
  if (inp) {
    inp.value = "";
    setTimeout(() => inp.focus(), 30);
  }
  const btn = document.getElementById("upDeleteBtn");
  if (btn) btn.disabled = true;
  document.body.style.overflow = "hidden";
}
window.prOpenDelete = prOpenDelete;

function prCloseDelete() {
  const bg = document.getElementById("upDeleteModal");
  if (!bg) return;
  bg.classList.remove("open");
  document.body.style.overflow = "";
}
window.prCloseDelete = prCloseDelete;

// Abilito "Elimina" solo se l'utente scrive esattamente "elimina".
function prDeleteConfirmInput() {
  const inp = document.getElementById("upDeleteConfirm");
  const btn = document.getElementById("upDeleteBtn");
  if (!inp || !btn) return;
  btn.disabled = inp.value.trim().toLowerCase() !== "elimina";
}
window.prDeleteConfirmInput = prDeleteConfirmInput;

// Manda la DELETE al backend. Il backend fa il double-step con email: non elimina subito, manda un link di conferma.
async function prDoDelete() {
  const btn = document.getElementById("upDeleteBtn");
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  btn.textContent = "Eliminazione…";
  const r = await api("/api/user/me", { method: "DELETE" });
  if (!r.ok) {
    btn.disabled = false;
    btn.textContent = "Elimina";
    toast((r.data && r.data.error) || "Eliminazione fallita", "err");
    return;
  }
  // Pulisco token e mando alla home.
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  toast("Account eliminato.", "ok");
  setTimeout(() => {
    window.location.replace("index.html");
  }, 800);
}
window.prDoDelete = prDoDelete;


// Sezione social: card cliccabili "Seguiti" / "Iscritti" con contatori.
async function prRenderSocial() {
  const box = document.getElementById("upSocial");
  if (!box || !NM.user) return;
  const uname = NM.user.username;
  if (!uname) return;
  box.innerHTML =
    '<div class="up-social">' +
      '<button class="up-social-card" type="button" onclick="prOpenSocialModal(\'following\')">' +
        '<div class="up-social-num" id="upFollowingCount">-</div>' +
        '<div class="up-social-lbl">Seguiti</div>' +
      '</button>' +
      '<button class="up-social-card" type="button" onclick="prOpenSocialModal(\'followers\')">' +
        '<div class="up-social-num" id="upFollowersCount">-</div>' +
        '<div class="up-social-lbl">Iscritti</div>' +
      '</button>' +
    '</div>';
  try {
    const fg = await api("/api/user/creators/" + encodeURIComponent(uname) + "/following");
    if (fg.ok && fg.data) {
      const el = document.getElementById("upFollowingCount");
      const list = Array.isArray(fg.data.items) ? fg.data.items
                 : Array.isArray(fg.data) ? fg.data : [];
      if (el) el.textContent = String(list.length);
    }
    const fr = await api("/api/user/creators/" + encodeURIComponent(uname) + "/followers");
    if (fr.ok && fr.data) {
      const el = document.getElementById("upFollowersCount");
      const list = Array.isArray(fr.data.items) ? fr.data.items
                 : Array.isArray(fr.data) ? fr.data : [];
      if (el) el.textContent = String(list.length);
    }
  } catch (e) {
    console.warn("[profilo social]", e.message);
  }
}
window.prRenderSocial = prRenderSocial;

// Apre la modale con la lista completa dei seguiti o iscritti.
async function prOpenSocialModal(kind) {
  if (!NM.user) return;
  const uname = NM.user.username;
  const bg = document.getElementById("upSocialModal");
  const title = document.getElementById("upSocialTitle");
  const body = document.getElementById("upSocialBody");
  if (!bg || !body) return;
  if (title) title.textContent = kind === "followers" ? "Iscritti" : "Seguiti";
  body.innerHTML = '<div class="up-social-loading" style="padding:32px;text-align:center;color:var(--text-muted)">Caricamento</div>';
  bg.classList.add("open");
  document.body.style.overflow = "hidden";

  const endpoint = kind === "followers"
    ? "/api/user/creators/" + encodeURIComponent(uname) + "/followers"
    : "/api/user/creators/" + encodeURIComponent(uname) + "/following";
  const r = await api(endpoint);
  if (!r.ok) {
    body.innerHTML = '<div class="up-social-empty" style="padding:32px;text-align:center;color:var(--rose)">'
      + escapeHtml((r.data && r.data.error) || "Errore di caricamento") + '</div>';
    return;
  }
  const list = Array.isArray(r.data && r.data.items) ? r.data.items
             : Array.isArray(r.data) ? r.data : [];
  if (!list.length) {
    body.innerHTML = '<div class="up-social-empty" style="padding:32px;text-align:center;color:var(--text-muted)">Nessun '
      + (kind === "followers" ? "iscritto" : "canale seguito") + ' al momento.</div>';
    return;
  }
  body.innerHTML = list.map(function (u) {
    var initial = (u.username || "U").charAt(0).toUpperCase();
    var av = u.avatar_url
      ? '<img src="' + escapeHtml(u.avatar_url) + '" alt="" loading="lazy"/>'
      : initial;
    var tick = typeof verifiedTickHTML === "function"
      ? verifiedTickHTML(u.is_verified, u.verified_profile, "sm")
      : "";
    var safeName = String(u.username || "").replace(/'/g, "\\'");
    return '<div class="up-social-row" onclick="goCreatorPublic(\'' + safeName + '\')" role="link" tabindex="0" style="display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--border);cursor:pointer">'
      +   '<div class="up-social-avatar" style="width:40px;height:40px;border-radius:50%;background:var(--surface-2);display:flex;align-items:center;justify-content:center;font-weight:700;overflow:hidden;color:var(--text)">' + av + '</div>'
      +   '<div style="flex:1;min-width:0">'
      +     '<div style="font-weight:600;color:var(--text);display:flex;align-items:center;gap:6px">' + escapeHtml(u.username || "") + tick + '</div>'
      +   '</div>'
      + '</div>';
  }).join("");
}
window.prOpenSocialModal = prOpenSocialModal;

// Chiude la modale social. Se il click e' su un elemento interno, non chiude.
function prCloseSocialModal(e) {
  if (e && e.target && !e.target.classList.contains("vd-modal-bg")) return;
  var bg = document.getElementById("upSocialModal");
  if (!bg) return;
  bg.classList.remove("open");
  document.body.style.overflow = "";
}
window.prCloseSocialModal = prCloseSocialModal;


// Cambia tema (chiaro/scuro), salva in localStorage e ri-renderizza.
function prSetTheme(theme) {
  if (theme !== "light" && theme !== "dark") return;
  try { localStorage.setItem("nm_theme", theme); } catch (_) {}
  document.documentElement.setAttribute("data-theme", theme);
  if (typeof updateThemeIcon === "function") updateThemeIcon(theme);
  if (typeof renderProfileForms === "function") renderProfileForms();
  // Dopo il re-render devo riapplicare le traduzioni: i nuovi nodi
  // data-i18n appena creati non le hanno ancora.
  if (window.NMI18n && typeof window.NMI18n.apply === "function") {
    window.NMI18n.apply();
  }
  if (typeof toast === "function") toast(theme === "light" ? "Tema chiaro" : "Tema scuro");
}
window.prSetTheme = prSetTheme;

// Cambia lingua (IT/EN), salva in localStorage e ri-renderizza.
function prSetLang(lang) {
  if (lang !== "it" && lang !== "en") return;
  try { localStorage.setItem("nm_lang", lang); } catch (_) {}
  if (typeof renderProfileForms === "function") renderProfileForms();
  if (window.NMI18n && typeof window.NMI18n.apply === "function") {
    window.NMI18n.apply();
  }
  if (typeof toast === "function") toast(lang === "it" ? "Lingua impostata: Italiano" : "Language set to English");
}
window.prSetLang = prSetLang;

// Bootstrap: parte al load della pagina. Guardia sull'id="upForms" cosi' il file non fa nulla se caricato per sbaglio in un'altra pagina.
(function profiloBootstrap() {
  function boot() {
    if (!document.getElementById("upForms")) return;
    if (typeof NM !== "undefined" && NM.token) {
      if (typeof loadProfilePage === "function") {
        loadProfilePage().catch(function (e) {
          console.error("[profilo] loadProfilePage:", e && e.message);
          if (typeof renderProfileError === "function") {
            renderProfileError(e && e.message ? e.message : "Errore di caricamento");
          }
        });
      }
      if (typeof prRenderSocial === "function") {
        prRenderSocial().catch(function (e) {
          console.warn("[profilo] prRenderSocial:", e && e.message);
        });
      }
    } else if (typeof goLogin === "function") {
      goLogin();
    }
    // Se cambia la lingua da un altro punto, ri-renderizzo i form.
    document.addEventListener("nm:langchange", function () {
      if (typeof renderProfileForms === "function") renderProfileForms();
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();