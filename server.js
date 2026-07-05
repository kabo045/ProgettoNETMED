/* Bootstrap dell'applicazione Express.
   1) Monta i middleware (CORS, JSON ecc...)
   2) Aggancia i 4 router: /api/auth, /api/admin, /api/user, /api/creator.
   3) All'avvio applica le migrazioni SQL da db/migrations/
      e crea l'admin di default se non esiste.
   4) In NODE_ENV=test NON apre la porta: e' supertest a chiamare direttamente l'oggetto `app`.
*/     

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");
const pool = require("./db/db");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/adminRoutes");
const userRoutes = require("./routes/userRoutes");
const creatorRoutes = require("./routes/creatorRoutes");

const app = express();

// trust first proxy per ottenere l'IP reale del client.
app.set("trust proxy", 1);

app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Servi i file statici dalla cartella public.

app.use(
  express.static("public", {
    setHeaders: (res, filePath) => {
      if (/\.(js|css|html)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }
    },
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/user", userRoutes);
app.use("/api/creator", creatorRoutes);

//  URL non riconosciuto, restituiamo la pagina 404 invece dell'errore generico di Express.
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Endpoint non trovato" });
  }
  res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

// Se una migrazione è vuota o contiene solo "SELECT 1;" (placeholder per "no-op") non la eseguo. Cosi' posso lasciare file segnaposto in db/migrations/ senza sporcare la console.

function isNoopSql(sql) {
  const stripped = String(sql || "")
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return stripped === "" || stripped === "select 1;" || stripped === "select 1";
}

async function runMigrations() {
  const migDir = path.join(__dirname, "db", "migrations");

  let files;
  try {
    files = fs
      .readdirSync(migDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
  } catch (_) {
    return;
  } // cartella assente: silenzioso

  if (files.length === 0) return;

  // DB inizializzato?????(tabella users esiste)
  try {
    await pool.query("SELECT 1 FROM users LIMIT 1");
  } catch (_) {
    console.warn("[DB] Tabella 'users' non trovata. Esegui prima db/db.sql.");
    return;
  }

  let applied = 0,
    failed = 0;
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migDir, file), "utf8");
    if (isNoopSql(sql)) continue;
    try {
      await pool.query(sql);
      applied++;
      console.log(`[DB] migrazione applicata: ${file}`);
    } catch (e) {
      failed++;
      console.error(`[DB] migrazione fallita: ${file} — ${e.message}`);
    }
  }
  if (applied || failed) {
    console.log(`[DB] migrazioni: ${applied} applicate, ${failed} fallite.`);
  }
}

async function seedAdmin() {
  // Credenziali di default: creano l'admin al primo avvio se non esiste.
  const EMAIL = "admin@netmed.com";
  const USERNAME = "admin";
  const PASSWORD = "Admin123!";

  try {
    try {
      await pool.query("SELECT 1 FROM users LIMIT 1");
    } catch (tableErr) {
      console.error(
        "[ADMIN] Tabella 'users' non trovata. Esegui db/db.sql prima di avviare il server."
      );
      return;
    }

    const check = await pool.query("SELECT id, role FROM users WHERE email = $1", [EMAIL]);

    if (check.rows.length > 0) {
      const row = check.rows[0];
      if (row.role !== "admin") {
        await pool.query("UPDATE users SET role='admin', updated_at=NOW() WHERE id=$1", [row.id]);
        console.log(`[ADMIN] Utente id=${row.id} promosso a admin.`);
      }
      // Caso comune: admin gia' presente. No log per non sporcare la console.
      return;
    }

    const hash = await bcrypt.hash(PASSWORD, 10);

    const ins = await pool.query(
      `INSERT INTO users(email, username, password_hash, role, email_confirmed)
       VALUES($1, $2, $3, 'admin', TRUE)
       RETURNING id, email, username, role`,
      [EMAIL, USERNAME, hash]
    );
    console.log("");
    console.log("[ADMIN] Admin creato.");
    console.log("  Email:    " + EMAIL);
    console.log("  Password: " + PASSWORD);
    console.log("  Resetta con: node scripts/createAdmin.js --reset");
    console.log("");
  } catch (e) {
    console.error("[ADMIN] Errore seed:", e.message);
  }
}

const PORT = process.env.PORT || 3000;

// In test (NODE_ENV=test) NON apriamo la porta: supertest userà direttamente l'oggetto `app`. Anche runMigrations/seedAdmin vengono saltati: il harness di test prepara il DB a parte.
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, async () => {
    console.log(`NETMED server ascolto su :${PORT}`);
    try { await runMigrations(); } catch (e) { console.error("[migrations]", e.message); }
    try { await seedAdmin(); } catch (e) { console.error("[seedAdmin]", e.message); }
    console.log("Pronto.");
  });
}

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason && reason.message ? reason.message : reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err && err.message ? err.message : err);
  if ((process.env.NODE_ENV || "").toLowerCase() === "production") process.exit(1);
});

module.exports = app;
