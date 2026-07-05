const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db/db"); // connessione DB PostgreSQL
const authenticateToken = require("../middleware/authMiddleware");
const crypto = require("crypto");
const { loginLimiter, registerLimiter, forgotLimiter } = require("../middleware/rateLimit");
const emailService = require("../services/email");
const { validatePassword } = require("../services/passwordPolicy");

const router = express.Router();

// JWT_SECRET + JWT_EXPIRES_IN risolti centralmente da config/security.js:
// in produzione muore se manca la chiave, in dev usa un fallback noto.
const { JWT_SECRET, JWT_EXPIRES_IN } = require("../config/security");

// Endpoint per la registrazione
router.post("/register", registerLimiter, async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const wantsCreator = !!(req.body && req.body.wants_creator);
    const cTitle = ((req.body && req.body.creator_title) || "").toString().trim().slice(0, 60);
    const cQualifica = ((req.body && req.body.creator_qualifica) || "")
      .toString()
      .trim()
      .slice(0, 120);
    const cOrg = ((req.body && req.body.creator_org) || "").toString().trim().slice(0, 160);

    if (!email || !username || !password) {
      return res.status(400).json({ error: "Campi mancanti" });
    }

    // Validazione formato email lato server (cintura + bretelle)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) {
      return res.status(400).json({ error: "Email non valida" });
    }
    // Username: solo lettere, numeri, underscore/punto, 3-30 char
    if (!/^[a-zA-Z0-9_.]{3,30}$/.test(username)) {
      return res.status(400).json({ error: "Username 3-30 caratteri, solo lettere/numeri/_/." });
    }
    // Password policy unica
    const pCheck = validatePassword(password);
    if (!pCheck.ok) return res.status(400).json({ error: pCheck.error });

    // check email
    const emailCheck = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: "Email già registrata" });
    }
    // check username
    const usernameCheck = await pool.query("SELECT id FROM users WHERE username = $1", [username]);
    if (usernameCheck.rows.length > 0) {
      return res.status(400).json({ error: "Username già registrato" });
    }
    // Hash password (bcrypt 10 round)
    const hash = await bcrypt.hash(password, 10);
    // Inserimento nel DB
    const insertResult = await pool.query(
      `INSERT INTO users (email, username, password_hash)
             VALUES ($1, $2, $3)
             RETURNING id, email, username`,
      [email, username, hash]
    );
    const newUserId = insertResult.rows[0].id;


    try {
      await pool.query(
        `INSERT INTO notifications (user_id, type, payload, link, created_at)
         VALUES ($1, 'welcome', $2::jsonb, $3, NOW())`,
        [
          newUserId,
          JSON.stringify({
            title: "Benvenuto su NETMED!",
            message: "Grazie per esserti iscritto. Esplora i video e iscriviti ai creator che ti interessano.",
            username: username,
          }),
          "home.html",
        ]
      );
    } catch (welcomeErr) {
      console.warn("[register] notifica benvenuto fallita:", welcomeErr.message);
    }

    let creatorRequested = false;
    if (wantsCreator) {
      try {
        const profile = {
          title: cTitle,
          qualifica: cQualifica,
          organization: cOrg,
          requested_at: new Date().toISOString(),
        };
        await pool.query(
          `UPDATE users
                        SET verified_request    = TRUE,
                            verified_request_at = NOW(),
                            verified_profile    = $1
                      WHERE id = $2`,
          [JSON.stringify(profile), newUserId]
        );
        creatorRequested = true;

        try {
          const admins = await pool.query("SELECT id FROM users WHERE role = 'admin'");
          const payload = JSON.stringify({
            requested_user_id: newUserId,
            requested_username: username,
            email: email,
            title: cTitle,
            qualifica: cQualifica,
            organization: cOrg,
          });
          for (const a of admins.rows) {
            await pool.query(
              `INSERT INTO notifications (user_id, type, payload, link, created_at)
                             VALUES ($1, 'creator_request', $2, $3, NOW())`,
              [a.id, payload, "admin_dashboard.html"]
            );
          }
        } catch (notifErr) {
          console.warn("[register] notifica admin fallita:", notifErr.message);
        }
      } catch (reqErr) {
        console.warn("[register] richiesta creator fallita (migration assente?):", reqErr.message);
      }
    }

    let emailSent = false;
    try {
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await pool.query(
        "INSERT INTO email_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
        [newUserId, token, expires]
      );
      const r = await emailService.sendConfirmationEmail(email, username, token);
      emailSent = !!(r && r.ok);
    } catch (mailErr) {
      console.warn("[register] email di conferma non inviata:", mailErr.message);
    }

    res.status(201).json({
      message: "Utente registrato con successo",
      user: insertResult.rows[0],
      creator_requested: creatorRequested,
      email_sent: emailSent,
    });
  } catch (err) {
    console.error("ERRORE DURANTE REGISTRAZIONE:", err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint per il login
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Campi mancanti" });
    }
    // cerco l'utente nel DB
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const GENERIC_ERR = "Email o password errata";
    if (result.rows.length === 0) {
      // dummy compare per non fare leak via timing
      await bcrypt.compare(password, "$2b$10$invalidhashinvalidhashinvalidhashinvalidhashinvalidh");
      return res.status(401).json({ error: GENERIC_ERR });
    }
    const user = result.rows[0];
    let valid = false;
    try {
      if (typeof user.password_hash === "string" && user.password_hash.length >= 20) {
        valid = await bcrypt.compare(password, user.password_hash);
      }
    } catch (bcryptErr) {
      console.error("[LOGIN] bcrypt error per user id=" + user.id + ":", bcryptErr.message);
      return res.status(401).json({ error: GENERIC_ERR });
    }
    if (!valid) {
      return res.status(401).json({ error: GENERIC_ERR });
    }
  
    if (user.role === "banned") {
      return res.status(403).json({
        error: "Questo account e' stato sospeso per violazione delle regole della community.",
      });
    }
  
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        is_verified: !!user.is_verified,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    res.json({
      message: "Login effettuato con successo",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar_url: user.avatar_url,
        is_verified: !!user.is_verified,
        verified_profile: user.verified_profile || null,
      },
    });
  } catch (err) {
    console.error("ERRORE LOGIN:", err);
    res.status(500).json({
      error: "Errore interno del server",
      detail: err && err.message,
      code: err && err.code,
    });
  }
});

router.post("/confirm-email", async (req, res) => {
  try {
    const token = ((req.body && req.body.token) || "").toString().trim();
    if (!token || token.length < 16) {
      return res.status(400).json({ error: "Token mancante o non valido" });
    }
    const t = await pool.query(
      "SELECT id, user_id, expires_at FROM email_tokens WHERE token = $1",
      [token]
    );
    if (!t.rows.length) {
      return res.status(400).json({ error: "Token non valido" });
    }
    const row = t.rows[0];
    if (new Date(row.expires_at) < new Date()) {
      // Pulizia: rimuovo i token scaduti
      await pool.query("DELETE FROM email_tokens WHERE id = $1", [row.id]);
      return res.status(400).json({ error: "Token scaduto, richiedi un nuovo invio" });
    }
    await pool.query("UPDATE users SET email_confirmed = TRUE WHERE id = $1", [row.user_id]);
    await pool.query("DELETE FROM email_tokens WHERE id = $1", [row.id]);
    res.json({ ok: true, message: "Email confermata" });
  } catch (err) {
    console.error("[confirm-email]", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.post("/resend-confirmation", async (req, res) => {
  try {
    const email = ((req.body && req.body.email) || "").toString().trim().toLowerCase();
    if (!email) return res.json({ ok: true });
    const u = await pool.query("SELECT id, username, email_confirmed FROM users WHERE email = $1", [
      email,
    ]);
    if (u.rows.length && !u.rows[0].email_confirmed) {
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await pool.query(
        "INSERT INTO email_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
        [u.rows[0].id, token, expires]
      );
      emailService
        .sendConfirmationEmail(u.rows[0].email || email, u.rows[0].username, token)
        .catch(() => {});
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[resend-confirmation]", err);
    res.json({ ok: true }); // privacy: non rivelo errori interni
  }
});

router.post("/forgot-password", forgotLimiter, async (req, res) => {
  try {
    const email = ((req.body && req.body.email) || "").toString().trim().toLowerCase();
    if (!email) return res.json({ ok: true });
    const u = await pool.query("SELECT id, username, email FROM users WHERE email = $1", [email]);
    if (u.rows.length) {
      const userRow = u.rows[0];
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h
      try {
        await pool.query(
          "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
          [userRow.id, token, expires]
        );
        emailService.sendPasswordResetEmail(userRow.email, userRow.username, token).catch(() => {});
      } catch (insErr) {
        console.warn("[forgot-password] insert/send fallito:", insErr.message);
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[forgot-password]", err);
    res.json({ ok: true }); // privacy: non rivelo errori interni
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const token = ((req.body && req.body.token) || "").toString().trim();
    const newPwd = ((req.body && req.body.new_password) || "").toString();
    if (!token || token.length < 16)
      return res.status(400).json({ error: "Token mancante o non valido" });
    const pCheck = validatePassword(newPwd);
    if (!pCheck.ok) return res.status(400).json({ error: pCheck.error });

    const t = await pool.query(
      "SELECT id, user_id, expires_at FROM password_reset_tokens WHERE token = $1",
      [token]
    );
    if (!t.rows.length) return res.status(400).json({ error: "Token non valido" });
    const row = t.rows[0];
    if (new Date(row.expires_at) < new Date()) {
      await pool.query("DELETE FROM password_reset_tokens WHERE id = $1", [row.id]);
      return res.status(400).json({ error: "Token scaduto: richiedi un nuovo link di reset" });
    }
    const newHash = await bcrypt.hash(newPwd, 10);
    await pool.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [
      newHash,
      row.user_id,
    ]);
    await pool.query("DELETE FROM password_reset_tokens WHERE id = $1", [row.id]);
    // Sicurezza: invalido eventuali altri token di reset attivi per lo stesso utente
    await pool.query("DELETE FROM password_reset_tokens WHERE user_id = $1", [row.user_id]);
    res.json({ ok: true, message: "Password aggiornata. Puoi accedere con la nuova password." });
  } catch (err) {
    console.error("[reset-password]", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/me", authenticateToken, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, username, email, role, avatar_url,
                    is_verified, verified_profile, verified_at
               FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Utente non trovato" });
    const u = r.rows[0];
    res.json({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      avatar_url: u.avatar_url,
      is_verified: !!u.is_verified,
      verified_profile: u.verified_profile || null,
      verified_at: u.verified_at || null,
    });
  } catch (err) {
    console.error("[me]", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

module.exports = router;
