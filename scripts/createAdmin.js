// scripts/createAdmin.js
// Script standalone per creare (o resettare) l'utente admin.
// Usa: node scripts/createAdmin.js
//      node scripts/createAdmin.js --reset   (forza reset password)

const bcrypt = require("bcrypt");
const pool = require("../db/db");

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@netmed.com";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin123!";

const RESET = process.argv.includes("--reset");

function log(label, msg) {
  const pad = label.padEnd(12, " ");
  console.log(`[${pad}] ${msg}`);
}

async function main() {
  console.log("\n========== CREATE ADMIN ==========");
  log("CONFIG", `email=${ADMIN_EMAIL}  username=${ADMIN_USERNAME}  reset=${RESET}`);

  // 1) Test connessione DB
  try {
    const r = await pool.query("SELECT NOW() AS now");
    log("DB", `Connesso. Ora server: ${r.rows[0].now}`);
  } catch (e) {
    log("DB ERROR", `Impossibile connettersi: ${e.message}`);
    console.error("\nControlla i parametri in db/db.js (host, port, database, user, password).");
    console.error("Oppure assicurati che PostgreSQL sia in esecuzione.\n");
    process.exit(1);
  }

  // 2) Verifica che la tabella users esista
  try {
    await pool.query("SELECT 1 FROM users LIMIT 1");
    log("TABLE", "Tabella 'users' trovata");
  } catch (e) {
    log("TABLE ERR", "La tabella 'users' NON esiste!");
    console.error("\nEsegui prima: psql -U postgres -d netmed -f db/db.sql\n");
    await pool.end();
    process.exit(1);
  }

  // 3) Hash password
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  log("HASH", `Password hashata (len=${hash.length})`);

  // 4) Controlla se esiste già un utente con quell'email
  const existing = await pool.query(
    "SELECT id, username, email, role FROM users WHERE email = $1",
    [ADMIN_EMAIL]
  );

  if (existing.rows.length > 0) {
    const u = existing.rows[0];
    log("EXISTS", `Utente esistente id=${u.id} role=${u.role}`);

    if (!RESET) {
      log("SKIP", `L'admin esiste già. Usa --reset per forzare nuova password.`);
      log("INFO", `Credenziali attese: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
      await pool.end();
      return;
    }

    // Reset: aggiorna ruolo + password + username
    await pool.query(
      `UPDATE users
       SET username = $1, password_hash = $2, role = 'admin', updated_at = NOW()
       WHERE email = $3`,
      [ADMIN_USERNAME, hash, ADMIN_EMAIL]
    );
    log("RESET", `Utente aggiornato a ruolo=admin con nuova password`);
  } else {
    // 5) Inserisci nuovo admin
    const ins = await pool.query(
      `INSERT INTO users (email, username, password_hash, role)
       VALUES ($1, $2, $3, 'admin')
       RETURNING id, email, username, role`,
      [ADMIN_EMAIL, ADMIN_USERNAME, hash]
    );
    log("CREATED", `Admin creato: ${JSON.stringify(ins.rows[0])}`);
  }

  // 6) Verifica finale
  const check = await pool.query("SELECT id, email, username, role FROM users WHERE email = $1", [
    ADMIN_EMAIL,
  ]);
  log("VERIFY", JSON.stringify(check.rows[0]));

  console.log("\n========== FATTO ==========");
  console.log(`Login con:`);
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}\n`);

  await pool.end();
}

main().catch((e) => {
  console.error("\nERRORE FATALE:", e);
  pool.end().finally(() => process.exit(1));
});
