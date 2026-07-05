/*
 Flusso:
   1) Validazione live: email col regex minimale, password col
      check "hai digitato almeno 6 caratteri".
   2) Submit: POST /api/auth/login. Su ok salva token+user in localStorage e reindirizza.
   3) Su errore: messaggio generico per 401 (anti-enumeration).
*/

const loginForm = document.getElementById("loginForm");
const submitBtn = document.getElementById("submitBtn");
const btnText = document.getElementById("btnText");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

let formMessage = document.getElementById("formMessage");
if (!formMessage) {
  formMessage = document.createElement("div");
  formMessage.id = "formMessage";
  loginForm.prepend(formMessage);
}

// CSS del toast, degli input valid/invalid.
const style = document.createElement("style");
style.textContent = `
#toastContainer{position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:10px;pointer-events:none}
.toast{background:#fff;padding:14px 22px;border-radius:14px;font-size:14px;font-weight:500;box-shadow:0 12px 32px rgba(0,0,0,.15);display:flex;align-items:center;gap:10px;animation:slideIn .35s ease forwards;border-left:4px solid;pointer-events:auto;min-width:260px;transition:all .3s}
.toast-ok{border-color:#16a34a;color:#15803d}
.toast-err{border-color:#e11d48;color:#be123c}
.toast-info{border-color:#0d7a4d;color:#08562f}
.toast-icon{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;flex-shrink:0;font-size:14px}
.toast-ok .toast-icon{background:#16a34a}
.toast-err .toast-icon{background:#e11d48}
.toast-info .toast-icon{background:#0d7a4d}
@keyframes slideIn{from{transform:translateX(120px);opacity:0}to{transform:translateX(0);opacity:1}}

#loginForm input.valid{border-color:#16a34a!important;box-shadow:0 0 0 3px rgba(22,163,74,.1)!important}
#loginForm input.invalid{border-color:#e11d48!important;box-shadow:0 0 0 3px rgba(225,29,72,.1)!important}

#formMessage{min-height:0;transition:all .3s;overflow:hidden}
#formMessage.show{padding:12px 16px;border-radius:10px;margin-bottom:12px;font-size:13px;font-weight:500;text-align:left}
#formMessage.error{background:#fef2f2;color:#be123c;border:1px solid #fecdd3}
#formMessage.success{background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0}
#formMessage.info{background:#eafaf0;color:#08562f;border:1px solid #a7f3c8}

.btn-pill:disabled{opacity:.7;cursor:wait}
.btn-loading{display:inline-flex;align-items:center;gap:8px}
.btn-spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
`;
document.head.appendChild(style);

//  Toast + banner messaggio
function showToast(msg, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
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

function setMessage(text, type = "info") {
  formMessage.className = `show ${type}`;
  formMessage.textContent = text;
}
function clearMessage() {
  formMessage.className = "";
  formMessage.textContent = "";
}

//  Messaggi contestuali dal query string 
// Se l'utente arriva qui perche' il suo account e' stato sospeso o perche' la sessione e' scaduta.
if (/[?&]suspended=1/.test(location.search)) {
  setMessage("Il tuo account e' stato sospeso. Per informazioni contatta l'assistenza.", "error");
}
if (/[?&]expired=1/.test(location.search)) {
  setMessage("La sessione e' scaduta. Effettua di nuovo l'accesso.", "info");
}

// ---------- Live validation ----------
// Email: regex minimale, l'email vera la valida il server al login implicitamente: se non trova la riga, dice "email o pwd errata").

emailInput.addEventListener("input", () => {
  clearMessage();
  const v = emailInput.value.trim();
  if (!v) {
    emailInput.classList.remove("valid", "invalid");
    return;
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    emailInput.classList.add("valid");
    emailInput.classList.remove("invalid");
  } else {
    emailInput.classList.add("invalid");
    emailInput.classList.remove("valid");
  }
});

passwordInput.addEventListener("input", () => {
  clearMessage();
  const v = passwordInput.value;
  if (!v) {
    passwordInput.classList.remove("valid", "invalid");
    return;
  }
  if (v.length >= 6) {
    passwordInput.classList.add("valid");
    passwordInput.classList.remove("invalid");
  } else {
    passwordInput.classList.add("invalid");
    passwordInput.classList.remove("valid");
  }
});

// Submit
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    setMessage("Compila tutti i campi", "error");
    if (!email) {
      emailInput.classList.add("invalid");
      emailInput.focus();
    } else if (!password) {
      passwordInput.classList.add("invalid");
      passwordInput.focus();
    }
    showToast("Email e password sono obbligatori", "err");
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setMessage("Email non valida", "error");
    emailInput.classList.add("invalid");
    emailInput.focus();
    showToast("Formato email non valido", "err");
    return;
  }

  submitBtn.disabled = true;
  btnText.innerHTML = `<span class="btn-loading"><span class="btn-spinner"></span>Accesso in corso...</span>`;
  setMessage("Verifico le credenziali...", "info");

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      // Salvo il JWT e il profilo user in localStorage: il restoDel sito li rilegge da qui per costruire le chiamate autenticate (core.js -> api()).
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      const nome = data.user.username || "utente";
      setMessage(`Bentornato ${nome}!`, "success");
      showToast(`Benvenuto ${nome}!`, "ok");
      btnText.textContent = "Accesso effettuato";

      // Blocco i campi per evitare che l'utente digiti mentre parte il redirect.
      [emailInput, passwordInput].forEach((i) => (i.disabled = true));

      setTimeout(() => {
        /* 1) Deep-link: se la pagina di login e' stata aperta con
            ?next=<url> (es. l'utente ha cliccato una card del
            catalogo pre-login), atterriamo li' dopo l'accesso.
            Whitelist: accetto solo path relativi che finiscono
            in .html, mai URL assoluti verso altri host (mitiga
           open-redirect).*/
        try {
          const params = new URLSearchParams(location.search);
          const next = params.get("next");
          if (next) {
            const safe = /^[a-z0-9_\-./?=&%]+\.html(\?.*)?$/i.test(next);
            if (safe) {
              window.location.replace(next);
              return;
            }
          }
        } catch (_) {}

        /* 2) Fallback: redirect di default in base al ruolo.
            admin      -> dashboard admin
            verified   -> pannello creator
            user base  -> home */
        if (data.user.role === "admin") {
          window.location.replace("admin_dashboard.html");
        } else if (data.user.is_verified) {
          window.location.replace("creator.html");
        } else {
          window.location.replace("home.html");
        }
      }, 1200);
    } else {
      /* Difesa anti-enumeration: per credenziali errate (401) uso
       sempre lo stesso messaggio, senza rivelare se e'
       sbagliata l'email o la password. Solo per errori diversi
       (429 rate limit, 500 server, 400 campi) */
      const GENERIC = "Email o password errata";
      let errorMsg;
      if (response.status === 401) {
        errorMsg = GENERIC;
      } else if (response.status === 429) {
        errorMsg = data.error || "Troppi tentativi, riprova più tardi";
      } else {
        errorMsg = data.error || GENERIC;
      }
      setMessage(`✕ ${errorMsg}`, "error");
      showToast(errorMsg, "err");
      emailInput.classList.add("invalid");
      passwordInput.classList.add("invalid");

      submitBtn.disabled = false;
      btnText.textContent = "Accedi";
      passwordInput.focus();
      passwordInput.select();
    }
  } catch (err) {
    // Rete giu', server offline, CORS, ecc.
    console.error("Errore fetch:", err);
    setMessage("Impossibile contattare il server. Riprova piu' tardi.", "error");
    showToast("Errore di connessione", "err");
    submitBtn.disabled = false;
    btnText.textContent = "Accedi";
  }
});

// Toggle mostra/nascondi password
function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === "password") {
    input.type = "text";
    btn.textContent = "o";
  } else {
    input.type = "password";
    btn.textContent = String.fromCharCode(0x1f441); // occhio 👁
  }
}
window.togglePw = togglePw;