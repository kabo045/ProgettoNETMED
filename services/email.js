
/*  
  invia email transazionali (conferma registrazione, recupero
  password, ecc.) con cascade di transport:
  1) SMTP via Nodemailer (se SMTP_HOST settato)
  2) Google Apps Script (se APPS_SCRIPT_EMAIL_URL settato)
  3) Console-log demo (fallback dev)
*/
const https = require("https");
const http = require("http");

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_EMAIL_URL || "";
const APPS_SCRIPT_SECRET = process.env.APPS_SCRIPT_EMAIL_SECRET || "";
const APP_BASE_URL = (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");

// OPTION SMPT (SIMPLE MAIL TRANSFER PROTOCOL)
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || (SMTP_USER ? `NETMED <${SMTP_USER}>` : "");
const SMTP_SECURE =
  String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || SMTP_PORT === 465;

let _smtpTransporter = null;
function getSmtpTransporter() {
  if (!SMTP_HOST) return null;
  if (_smtpTransporter) return _smtpTransporter;
  try {
    const nodemailer = require("nodemailer");
    _smtpTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
    console.log("[email] SMTP transport pronto:", SMTP_HOST + ":" + SMTP_PORT);
    return _smtpTransporter;
  } catch (e) {
    console.warn("[email] nodemailer non disponibile:", e.message);
    return null;
  }
}

function postJson(targetUrl, body) {
  return new Promise((resolve) => {
    try {
      const u = new URL(targetUrl);
      const lib = u.protocol === "http:" ? http : https;
      const data = JSON.stringify(body);
      const req = lib.request(
        {
          hostname: u.hostname,
          port: u.port || (u.protocol === "http:" ? 80 : 443),
          path: u.pathname + u.search,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(data),
          },
        },
        (res) => {
          let chunks = "";
          res.on("data", (c) => {
            chunks += c;
          });
          res.on("end", () => {
            let parsed;
            try {
              parsed = JSON.parse(chunks || "{}");
            } catch (_) {
              parsed = chunks;
            }
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 400,
              status: res.statusCode,
              data: parsed,
            });
          });
        }
      );
      req.on("error", (err) => resolve({ ok: false, error: err.message }));
      req.write(data);
      req.end();
    } catch (e) {
      resolve({ ok: false, error: e.message });
    }
  });
}

async function sendEmail({ to, subject, body, html }) {
  if (!to || !subject || (!body && !html)) {
    return { ok: false, error: "missing fields" };
  }

  // In test (NODE_ENV=test) non vado a inviare davvero: stub silenzioso.
  if (process.env.NODE_ENV === "test") {
    return { ok: true, transport: "test-stub", to, subject };
  }

  const transporter = getSmtpTransporter();
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: SMTP_FROM,
        to,
        subject,
        text: body,
        html: html || undefined,
      });
      console.log("[email] SMTP OK ->", to, "(id:", info.messageId, ")");
      return { ok: true, transport: "smtp", messageId: info.messageId };
    } catch (e) {
      console.warn("[email] SMTP fallito:", e.message, "- provo fallback");
    }
  }

  if (APPS_SCRIPT_URL) {
    const r = await postJson(APPS_SCRIPT_URL, {
      to,
      subject,
      body,
      html,
      secret: APPS_SCRIPT_SECRET,
    });
    if (r.ok) return Object.assign({ transport: "apps-script" }, r);
    console.warn("[email] Apps Script fallito a", to, "-", r.status || r.error);
  }

  console.warn("[email] nessun transport configurato - modalita' DEMO.");
  console.log("======================== EMAIL DEMO ========================");
  console.log("To:      " + to);
  console.log("Subject: " + subject);
  console.log("------------------------------------------------------------");
  console.log(body || "(solo HTML)");
  console.log("============================================================");
  return { ok: false, error: "not configured", demo: true };
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
// REGISTRAZIONE
function buildConfirmEmail(username, token) {
  const url = `${APP_BASE_URL}/conferma-email.html?token=${encodeURIComponent(token)}`;
  const subject = "NETMED - Conferma il tuo indirizzo email";
  const body = `Ciao ${username},

grazie per esserti registrato su NETMED.
Conferma il tuo indirizzo email cliccando il link qui sotto:

${url}

Il link scade fra 24 ore.

Se non hai richiesto la registrazione, ignora questa email.

- Il team NETMED`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0f172a;background:#f8fafc">
  <h1 style="font-size:22px;margin:0 0 14px;color:#0a6b3a">Conferma il tuo account</h1>
  <p style="line-height:1.6;font-size:15px">Ciao <strong>${escapeHtml(username)}</strong>,</p>
  <p style="line-height:1.6;font-size:15px">grazie per esserti registrato su NETMED. Per attivare il tuo account, conferma il tuo indirizzo email cliccando il pulsante qui sotto.</p>
  <p style="margin:24px 0"><a href="${url}" style="background:#008a3e;color:#fff;text-decoration:none;padding:12px 22px;border-radius:9px;font-weight:700;display:inline-block">Conferma email</a></p>
  <p style="line-height:1.6;font-size:13px;color:#64748b">Oppure copia questo link nel browser:<br><a href="${url}" style="color:#0a6b3a;word-break:break-all">${url}</a></p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:22px 0">
  <p style="font-size:12px;color:#94a3b8">NETMED - Piattaforma di video divulgativi medico-scientifici</p>
</div>`;
  return { subject, body, html };
}

async function sendConfirmationEmail(toEmail, username, token) {
  const { subject, body, html } = buildConfirmEmail(username, token);
  return sendEmail({ to: toEmail, subject, body, html });
}

// RECUPERO PSW
function buildPasswordResetEmail(username, token) {
  const url = `${APP_BASE_URL}/password-reset.html?token=${encodeURIComponent(token)}`;
  const subject = "NETMED - Recupero password";
  const body = `Ciao ${username},

abbiamo ricevuto una richiesta di reimpostazione password per il tuo
account NETMED. Imposta una nuova password cliccando il link qui sotto:

${url}

Il link scade fra 1 ora.

Se non hai richiesto il reset, ignora questa email.

- Il team NETMED`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0f172a;background:#f8fafc">
  <h1 style="font-size:22px;margin:0 0 14px;color:#0a6b3a">Reimposta la tua password</h1>
  <p style="line-height:1.6;font-size:15px">Ciao <strong>${escapeHtml(username)}</strong>,</p>
  <p style="line-height:1.6;font-size:15px">abbiamo ricevuto una richiesta di reimpostazione password. Clicca il pulsante qui sotto per impostarne una nuova.</p>
  <p style="margin:24px 0"><a href="${url}" style="background:#008a3e;color:#fff;text-decoration:none;padding:12px 22px;border-radius:9px;font-weight:700;display:inline-block">Reimposta password</a></p>
  <p style="line-height:1.6;font-size:13px;color:#64748b">Oppure copia questo link nel browser:<br><a href="${url}" style="color:#0a6b3a;word-break:break-all">${url}</a></p>
</div>`;
  return { subject, body, html };
}

async function sendPasswordResetEmail(toEmail, username, token) {
  const { subject, body, html } = buildPasswordResetEmail(username, token);
  return sendEmail({ to: toEmail, subject, body, html });
}

// NOTIFICA PSW CHANGE
function buildPasswordChangedEmail(username) {
  const subject = "NETMED - La tua password e' stata cambiata";
  const when = new Date().toLocaleString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const supportUrl = `${APP_BASE_URL}/password-reset-request.html`;
  const body = `Ciao ${username},

ti confermiamo che la password del tuo account NETMED e' stata cambiata ${when}.

Se sei stato tu, puoi ignorare questa email. Se NON sei stato tu, reimposta
subito la password e contatta l'assistenza.

Link: ${supportUrl}`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0f172a;background:#f8fafc">
  <h1 style="font-size:22px;margin:0 0 14px;color:#0a6b3a">Password aggiornata</h1>
  <p style="line-height:1.6;font-size:15px">Ciao <strong>${escapeHtml(username)}</strong>,</p>
  <p style="line-height:1.6;font-size:15px">ti confermiamo che la password del tuo account NETMED e' stata cambiata <strong>${escapeHtml(when)}</strong>.</p>
  <p style="margin:24px 0"><a href="${supportUrl}" style="background:#0a6940;color:#fff;text-decoration:none;padding:12px 22px;border-radius:9px;font-weight:700;display:inline-block">Reimposta password ora</a></p>
</div>`;
  return { subject, body, html };
}

async function sendPasswordChangedEmail(toEmail, username) {
  const { subject, body, html } = buildPasswordChangedEmail(username);
  return sendEmail({ to: toEmail, subject, body, html });
}

// CAMBIO EMAIL
function buildEmailChangeEmail(username, newEmail, token) {
  const url = `${APP_BASE_URL}/conferma-cambio-email.html?token=${encodeURIComponent(token)}`;
  const subject = "NETMED - Conferma il tuo nuovo indirizzo email";
  const body = `Ciao ${username},

abbiamo ricevuto la richiesta di aggiornare l'indirizzo email del tuo
account NETMED a: ${newEmail}.

Per confermare il cambio, clicca il link qui sotto:

${url}

Il link scade fra 1 ora.

Se non hai richiesto il cambio, ignora questa email.

- Il team NETMED`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0f172a;background:#f8fafc">
  <h1 style="font-size:22px;margin:0 0 14px;color:#0a6b3a">Conferma il nuovo indirizzo email</h1>
  <p style="line-height:1.6;font-size:15px">Ciao <strong>${escapeHtml(username)}</strong>,</p>
  <p style="line-height:1.6;font-size:15px">abbiamo ricevuto la richiesta di aggiornare l'indirizzo email del tuo account NETMED a <strong>${escapeHtml(newEmail)}</strong>.</p>
  <p style="margin:24px 0"><a href="${url}" style="background:#008a3e;color:#fff;text-decoration:none;padding:12px 22px;border-radius:9px;font-weight:700;display:inline-block">Conferma cambio email</a></p>
  <p style="line-height:1.6;font-size:13px;color:#64748b">Oppure copia questo link nel browser:<br><a href="${url}" style="color:#0a6b3a;word-break:break-all">${url}</a></p>
</div>`;
  return { subject, body, html };
}

async function sendEmailChangeVerifyEmail(toEmail, username, newEmail, token) {
  const { subject, body, html } = buildEmailChangeEmail(username, newEmail, token);
  return sendEmail({ to: toEmail, subject, body, html });
}

// CAMBIO EMAIL AVVENUTO 
function buildEmailChangedNoticeEmail(username, newEmail) {
  const subject = "NETMED - L'indirizzo email del tuo account e' stato cambiato";
  const when = new Date().toLocaleString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const supportUrl = `${APP_BASE_URL}/password-reset-request.html`;
  const body = `Ciao ${username},

ti informiamo che ${when} l'indirizzo email del tuo account NETMED e'
stato cambiato in: ${newEmail}.

Se sei stato tu, puoi ignorare questa email. Se NON sei stato tu,
reimposta subito la password e contatta l'assistenza.

Link reset: ${supportUrl}`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0f172a;background:#f8fafc">
  <h1 style="font-size:22px;margin:0 0 14px;color:#0a6b3a">Indirizzo email aggiornato</h1>
  <p style="line-height:1.6;font-size:15px">Ciao <strong>${escapeHtml(username)}</strong>,</p>
  <p style="line-height:1.6;font-size:15px">ti informiamo che <strong>${escapeHtml(when)}</strong> l'indirizzo email del tuo account NETMED e' stato cambiato in <strong>${escapeHtml(newEmail)}</strong>.</p>
  <p style="margin:24px 0"><a href="${supportUrl}" style="background:#0a6940;color:#fff;text-decoration:none;padding:12px 22px;border-radius:9px;font-weight:700;display:inline-block">Reimposta password ora</a></p>
</div>`;
  return { subject, body, html };
}

async function sendEmailChangedNoticeEmail(toEmail, username, newEmail) {
  const { subject, body, html } = buildEmailChangedNoticeEmail(username, newEmail);
  return sendEmail({ to: toEmail, subject, body, html });
}

// CONFERMA ELIMINAZIONE ACCOUNT
function buildAccountDeleteEmail(username, token) {
  const url = `${APP_BASE_URL}/conferma-eliminazione.html?token=${encodeURIComponent(token)}`;
  const subject = "NETMED - Conferma l'eliminazione del tuo account";
  const body = `Ciao ${username},

abbiamo ricevuto la richiesta di eliminare definitivamente il tuo
account NETMED. Tutti i tuoi dati - preferiti, commenti, cronologia,
iscrizioni - verranno rimossi e non potranno essere recuperati.

Per confermare l'eliminazione clicca il link qui sotto:

${url}

Il link scade fra 1 ora.

Se NON hai richiesto l'eliminazione, ignora questa email.

- Il team NETMED`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0f172a;background:#f8fafc">
  <h1 style="font-size:22px;margin:0 0 14px;color:#8a1f1f">Conferma l'eliminazione dell'account</h1>
  <p style="line-height:1.6;font-size:15px">Ciao <strong>${escapeHtml(username)}</strong>,</p>
  <p style="line-height:1.6;font-size:15px">abbiamo ricevuto la richiesta di eliminare definitivamente il tuo account NETMED. Tutti i tuoi dati verranno rimossi e non potranno essere recuperati.</p>
  <div style="background:#fff7f7;border:1px solid #f0c4c4;border-radius:10px;padding:14px 18px;margin:18px 0;color:#5b1a1a;font-size:14px;line-height:1.55">
    Operazione <strong>irreversibile</strong>. Se non sei sicuro, ignora questa email.
  </div>
  <p style="margin:24px 0"><a href="${url}" style="background:#a02828;color:#fff;text-decoration:none;padding:12px 22px;border-radius:9px;font-weight:700;display:inline-block">Conferma eliminazione</a></p>
  <p style="line-height:1.6;font-size:13px;color:#64748b">Oppure copia: <a href="${url}" style="color:#0a6b3a;word-break:break-all">${url}</a></p>
</div>`;
  return { subject, body, html };
}

async function sendAccountDeleteEmail(toEmail, username, token) {
  const { subject, body, html } = buildAccountDeleteEmail(username, token);
  return sendEmail({ to: toEmail, subject, body, html });
}

module.exports = {
  sendConfirmationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendEmailChangeVerifyEmail,
  sendEmailChangedNoticeEmail,
  sendAccountDeleteEmail,
};
