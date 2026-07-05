/*
 logica della pagina di registrazione
 Flusso:
   1) Validazione client-side live.
      allineata alla policy server in services/passwordPolicy.js.
   2) Submit: POST /api/auth/register, gestione risposta OK/errore
      con mappatura del messaggio server sul campo giusto (email o
      username duplicati).
   3) Toast + messaggio inline per il feedback all'utente.
   4) Se ruolo = "creator" mostra i campi professionali (titolo,
      qualifica, organizzazione).
*/

const form = document.getElementById("registerForm");
const formMessage = document.getElementById("formMessage");
const submitBtn = document.getElementById("submitBtn");
const btnText = document.getElementById("btnText");

const username = document.getElementById("username");
const email = document.getElementById("email");
const password = document.getElementById("password");
const passwordConfirm = document.getElementById("passwordConfirm");

// Sistema toast 
// Notifiche pop-up in basso a destra.
function showToast(msg, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${type === "ok" ? "✓" : type === "err" ? "✕" : "ℹ"}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(120px)";
    setTimeout(() => toast.remove(), 300);
  }, 3800);
}

const toastStyle = document.createElement("style");
toastStyle.textContent = `
#toastContainer{position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:10px;pointer-events:none}
.toast{background:#fff;padding:14px 22px;border-radius:14px;font-size:14px;font-weight:500;box-shadow:0 12px 32px rgba(0,0,0,.15);display:flex;align-items:center;gap:10px;animation:slideIn .35s ease forwards;border-left:4px solid;pointer-events:auto;min-width:260px;transition:all .3s}
.toast-ok{border-color:#16a34a;color:#15803d}
.toast-err{border-color:#e11d48;color:#be123c}
.toast-info{border-color:#0d7a4d;color:#08562f}
.toast-icon{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;flex-shrink:0}
.toast-ok .toast-icon{background:#16a34a}
.toast-err .toast-icon{background:#e11d48}
.toast-info .toast-icon{background:#0d7a4d}
@keyframes slideIn{from{transform:translateX(120px);opacity:0}to{transform:translateX(0);opacity:1}}

/* Stati input con feedback visivo */
#registerForm input.valid{border-color:#16a34a!important;box-shadow:0 0 0 3px rgba(22,163,74,.1)!important}
#registerForm input.invalid{border-color:#e11d48!important;box-shadow:0 0 0 3px rgba(225,29,72,.1)!important}

/* Messaggio generale */
#formMessage{min-height:0;transition:all .3s;overflow:hidden}
#formMessage.show{min-height:auto;padding:12px 16px;border-radius:10px;margin-bottom:12px;font-size:13px;font-weight:500}
#formMessage.error{background:#fef2f2;color:#be123c;border:1px solid #fecdd3}
#formMessage.success{background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0}
#formMessage.info{background:#eafaf0;color:#08562f;border:1px solid #a7f3c8}

/* Loader bottone */
.btn-pill:disabled{opacity:.7;cursor:wait}
.btn-loading{display:inline-flex;align-items:center;gap:8px}
.btn-spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
`;
document.head.appendChild(toastStyle);

// Banner messaggio sopra il form 
// Diverso dal toast: rimane visibile finche' non viene azzerato. (check campi)
function setMessage(text, type = "info") {
  formMessage.className = `show ${type}`;
  formMessage.textContent = text;
}
function clearMessage() {
  formMessage.className = "";
  formMessage.textContent = "";
}

const validators = {
  username: (v) => {
    if (!v) return "Username richiesto";
    if (v.length < 3) return "Minimo 3 caratteri";
    if (v.length > 30) return "Massimo 30 caratteri";
    if (!/^[a-zA-Z0-9_.-]+$/.test(v)) return "Solo lettere, numeri, _ . -";
    return null;
  },
  email: (v) => {
    if (!v) return "Email richiesta";
    // Regex minimale: filtro veloce, l'email vera la valida il server.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Email non valida";
    return null;
  },
  password: (v) => {
    if (!v) return "Password richiesta";
    if (v.length < 6) return "Minimo 6 caratteri";
    return null;
  },
  passwordConfirm: (v) => {
    if (!v) return "Conferma la password";
    if (v !== password.value) return "Le password non coincidono";
    return null;
  },
};

// Applica la classe valid/invalid al campo in base al validatore.
function validateField(input, name) {
  const err = validators[name](input.value.trim());
  if (input.value.length === 0) {
    input.classList.remove("valid", "invalid");
    return true;
  }
  if (err) {
    input.classList.add("invalid");
    input.classList.remove("valid");
    return false;
  }
  input.classList.add("valid");
  input.classList.remove("invalid");
  return true;
}

// Live validation su ogni tasto
// Ad ogni input rivalido il campo e azzero il messaggio banner

username.addEventListener("input", () => {
  validateField(username, "username");
  clearMessage();
});
email.addEventListener("input", () => {
  validateField(email, "email");
  clearMessage();
});
password.addEventListener("input", () => {
  validateField(password, "password");
  // Se la conferma era gia' compilata, la ri-controllo:
  // magari ora coincide con la password appena corretta.
  if (passwordConfirm.value) validateField(passwordConfirm, "passwordConfirm");
  clearMessage();
});
passwordConfirm.addEventListener("input", () => {
  validateField(passwordConfirm, "passwordConfirm");
  clearMessage();
});

// Submit
// Rivalida TUTTI i campi, mostra errori aggregati, poi chiama il backend.
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage();

  // Rivalidazione finale: raccolgo tutti gli errori in una lista.
  const errors = [];
  const u  = validators.username(username.value.trim());
  const em = validators.email(email.value.trim());
  const p  = validators.password(password.value);
  const pc = validators.passwordConfirm(passwordConfirm.value);

  if (u)  { errors.push(`Username: ${u}`); username.classList.add("invalid"); }
  if (em) { errors.push(`Email: ${em}`);   email.classList.add("invalid"); }
  if (p)  { errors.push(`Password: ${p}`); password.classList.add("invalid"); }
  if (pc) { errors.push(pc);               passwordConfirm.classList.add("invalid"); }

  if (errors.length > 0) {
    setMessage("Controlla i campi evidenziati in rosso", "error");
    // Nel toast mostro solo il primo errore per non affollare.
    showToast(errors[0], "err");
    if (u) username.focus();
    else if (em) email.focus();
    else if (p) password.focus();
    else if (pc) passwordConfirm.focus();
    return;
  }

  // Passata la validazione locale: blocco il form,spinner,chiamata.
  submitBtn.disabled = true;
  btnText.innerHTML = `<span class="btn-loading"><span class="btn-spinner"></span>Registrazione in corso...</span>`;
  setMessage("Stiamo creando il tuo account...", "info");

  try {
    // Payload: campi base + eventuali dati creator (se il toggle e' su "creator"). Il backend usa wants_creator per alzare verified_request=true e salvare verified_profile.
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username.value.trim(),
        email: email.value.trim(),
        password: password.value,
        wants_creator: (function () {
          const r = document.querySelector('input[name="userRole"]:checked');
          return r && r.value === "creator";
        })(),
        creator_title:     (document.getElementById("creatorTitle")     || {}).value || "",
        creator_qualifica: (document.getElementById("creatorQualifica") || {}).value || "",
        creator_org:       (document.getElementById("creatorOrg")       || {}).value || "",
      }),
    });

    const data = await response.json();

    if (response.ok) {
      // Successo: mostro esito, blocco i campi (l'utente non deve toccarli mentre parte il redirect) e sposto su /login.
      const wasCreatorReq = !!(data && data.creator_requested);
      const okMsg = wasCreatorReq
        ? "Account creato. La tua richiesta come creator e' stata inviata agli admin: ti notificheremo quando sara' approvata."
        : "Account creato con successo!";
      setMessage("" + okMsg + " Reindirizzamento al login...", "success");
      showToast("Benvenuto su NETMED!", "ok");

      [username, email, password, passwordConfirm].forEach((i) => (i.disabled = true));
      btnText.textContent = "Registrato";
      setTimeout(() => {
        window.location.replace("login.html");
      }, 1800);
    } else {
 
      const errorMsg = data.error || "Errore durante la registrazione";
      setMessage(`✕ ${errorMsg}`, "error");
      showToast(errorMsg, "err");

      if (errorMsg.toLowerCase().includes("email")) {
        email.classList.add("invalid");
        email.focus();
      } else if (errorMsg.toLowerCase().includes("username")) {
        username.classList.add("invalid");
        username.focus();
      }

      // Riabilito il bottone: l'utente puo' correggere e riprovare.
      submitBtn.disabled = false;
      btnText.textContent = "Registrati";
    }
  } catch (err) {
    // Rete giu', server offline, CORS, ecc.
    console.error("Errore fetch:", err);
    setMessage("✕ Impossibile contattare il server. Riprova più tardi.", "error");
    showToast("Errore di connessione", "err");
    submitBtn.disabled = false;
    btnText.textContent = "Registrati";
  }
});

// Piccoli helper della UI 

// Toggle mostra/nascondi password. Il bottone alterna type=password(nascosto, mostra • come simbolo) a type=text (visibile, mostra x)
function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === "password") {
    input.type = "text";
    btn.textContent = "x";
  } else {
    input.type = "password";
    btn.textContent = "•";
  }
}

// Mostra/nasconde i campi professionali in base al toggle di ruolo.
function toggleCreatorFields() {
  const box = document.getElementById("creatorFields");
  if (!box) return;
  const sel = document.querySelector('input[name="userRole"]:checked');
  const isCreator = !!(sel && sel.value === "creator");
  if (isCreator) box.removeAttribute("hidden");
  else box.setAttribute("hidden", "");
  // Aggiorna lo stile visivo della card selezionata (data-selected)
  document.querySelectorAll(".reg-role-card").forEach((c) => {
    const r = c.querySelector('input[type="radio"]');
    c.classList.toggle("selected", !!(r && r.checked));
  });
}
document.addEventListener("DOMContentLoaded", toggleCreatorFields);

// Verifica in tempo reale quali requisiti la password soddisfa.
function regCheckPassword() {
  const pwd = (document.getElementById("password") || {}).value || "";
  const list = document.getElementById("regPwList");
  const bar = document.getElementById("regPwMeterBar");
  if (!list || !bar) return;

  const rules = {
    len: pwd.length >= 8,
    up: /[A-Z]/.test(pwd),
    low: /[a-z]/.test(pwd),
    num: /[0-9]/.test(pwd),
    sym: /[^A-Za-z0-9]/.test(pwd),
  };
  let passed = 0;
  list.querySelectorAll("li[data-rule]").forEach((li) => {
    const r = li.getAttribute("data-rule");
    const ok = !!rules[r];
    li.classList.toggle("ok", ok);
    if (ok) passed++;
  });
  const colors = ["#3a3f3d", "#a02828", "#c98a2a", "#c98a2a", "#198754", "#0a6b3a"];
  const widths = [0, 20, 40, 60, 80, 100];
  bar.style.width = widths[passed] + "%";
  bar.style.background = colors[passed];
  regCheckPasswordMatch();
}
window.regCheckPassword = regCheckPassword;

// Confronta password e conferma, mostra un piccolo badge con icona SVG verde/rosso sotto il campo conferma.
function regCheckPasswordMatch() {
  const pwd = (document.getElementById("password") || {}).value || "";
  const conf = (document.getElementById("passwordConfirm") || {}).value || "";
  const box = document.getElementById("regPwMatch");
  if (!box) return;
  if (!conf) {
    box.textContent = "";
    box.className = "reg-pw-match";
    return;
  }
  if (pwd === conf) {
    box.innerHTML =
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Le password coincidono';
    box.className = "reg-pw-match ok";
  } else {
    box.innerHTML =
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Le password non coincidono';
    box.className = "reg-pw-match err";
  }
}
window.regCheckPasswordMatch = regCheckPasswordMatch;