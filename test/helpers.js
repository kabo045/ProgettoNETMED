// Utility condivise dalle suite mocha. Genera JWT direttamente senza
// passare da /login (cosi' i test non dipendono dal flusso di autenticazione)
// e fornisce un client `sql` per pulizia/preparazione del DB.
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_key";

// In compose la connessione verso "db:5432". In locale (host) usa localhost:5433 (port mappata dal compose).
const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.DB_USER || "postgres"}:${process.env.DB_PASSWORD || "postgres"}@${process.env.DB_HOST || "db"}:${process.env.DB_PORT || "5432"}/${process.env.DB_NAME || "netmed"}`;

/*Pool condiviso tra tutte le suite. non va chiuso nei singoli after()
di ciascuna suite: mocha --exit termina il processo al termine, e questo
chiude tutte le connessioni in modo pulito. Se chiamassimo pool.end()
nel primo after(), le suite successive crasherebbero al primo sql()
*/
const pool = new Pool({ connectionString });

async function sql(q, params = []) {
  const c = await pool.connect();
  try { return (await c.query(q, params)).rows; }
  finally { c.release(); }
}

/* Crea (o ricrea) un utente di test con hash bcrypt e JWT gia' firmato.
  Idempotente: se esiste gia' un utente con la stessa email o username viene cancellato prima. Ritorna {id, email, username, role, is_verified,token, password}*/
async function ensureUser({ email, username, password = "Password!123", role = "user", is_verified = false }) {
  // Cancello se esiste
  await sql(`DELETE FROM users WHERE email=$1 OR username=$2`, [email, username]).catch(() => {});
  const hash = await bcrypt.hash(password, 10);
  const rows = await sql(
    `INSERT INTO users (email, username, password_hash, role, is_verified, email_confirmed)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     RETURNING id, email, username, role, is_verified`,
    [email, username, hash, role, is_verified]
  );
  const u = rows[0];
  const token = jwt.sign(
    { id: u.id, email: u.email, username: u.username, role: u.role, is_verified: !!u.is_verified },
    JWT_SECRET,
    { expiresIn: "2h" }
  );
  return { ...u, token, password };
}

// Prende un category_id e un video_id REALI dal DB per i test che richiedono dati esistenti.
// Se il DB e' vuoto, i test relativi chiameranno this.skip() invece di fallire.
async function pickRealData() {
  const cats = await sql(`SELECT id, name FROM categories ORDER BY id LIMIT 1`).catch(() => []);
  const videos = await sql(
    `SELECT id, uploaded_by FROM videos WHERE is_private = FALSE AND is_flagged = FALSE ORDER BY id LIMIT 1`
  ).catch(() => []);
  return {
    categoryId: cats[0] ? cats[0].id : null,
    videoId: videos[0] ? videos[0].id : null,
  };
}

// Cancella un utente test. Grazie alle FK CASCADE dello schema, con una sola DELETE spariscono anche gli altri attributi.
async function deleteUser(userId) {
  if (!userId) return;
  await sql(`DELETE FROM users WHERE id=$1`, [userId]).catch(() => {});
}

// No-op: il pool e' condiviso e va chiuso UNA volta sola, alla fine del processo mocha (--exit lo fa automaticamente)
async function closePool() { /* no-op intenzionale */ }

module.exports = { pool, sql, ensureUser, pickRealData, deleteUser, closePool, JWT_SECRET };
