/*
 Setup completo del database NETMED su un Postgres locale.
 Esegue:
   1) Crea il database (se non esiste)
   2) Esegue db/db.sql (schema completo)
   3) Esegue tutte le migrazioni in db/migrations/

  Uso:
  node scripts/init-db.js

 Variabili d'ambiente lette:
   DB_HOST     (default: localhost)
   DB_PORT     (default: 5432)
   DB_USER     (default: postgres)
   DB_PASSWORD (default: postgres)
   DB_NAME     (default: netmed)
*/
require("dotenv").config();
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const cfg = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "netmed",
};

// Se DB_HOST e' "db" (docker hostname) ma stiamo girando in locale, rimpiazzo con localhost: lo script init-db si lancia tipicamente PRIMA del docker-compose, quindi locale.
if (cfg.host === "db") {
  console.log("[init-db] DB_HOST='db' rilevato → uso 'localhost' per init locale");
  cfg.host = "localhost";
}

async function main() {
  // Fase 1: connessione al server postgres (DB di default 'postgres')
  console.log(`[init-db] Connessione a ${cfg.host}:${cfg.port} come ${cfg.user}...`);
  const root = new Client({ ...cfg, database: "postgres" });
  await root.connect();
  console.log("[init-db] OK.");

  const dbExists = await root.query("SELECT 1 FROM pg_database WHERE datname = $1", [cfg.database]);

  if (dbExists.rows.length === 0) {
    console.log(`[init-db] DB '${cfg.database}' non esiste. Creo...`);
    await root.query(`CREATE DATABASE "${cfg.database}"`);
    console.log("[init-db] DB creato.");
  } else {
    console.log(`[init-db] DB '${cfg.database}' gia' esistente.`);
  }
  await root.end();

  // Fase 2: applico lo schema
  const db = new Client(cfg);
  await db.connect();

  const schemaPath = path.join(__dirname, "..", "db", "db.sql");
  if (!fs.existsSync(schemaPath)) {
    console.error("[init-db] db/db.sql non trovato!");
    process.exit(1);
  }
  const schema = fs.readFileSync(schemaPath, "utf8");
  console.log("[init-db] Applico schema (db/db.sql)...");
  try {
    await db.query(schema);
    console.log("[init-db] Schema applicato.");
  } catch (e) {
    // Se le tabelle esistono gia' (DROP fallito o gia' creato in passato),
    // lo schema fallira'. Non blocco: prosegui con le migrazioni.
    console.warn("[init-db] Schema warning:", e.message);
  }

  // Fase 3: migrazioni
  const migDir = path.join(__dirname, "..", "db", "migrations");
  if (fs.existsSync(migDir)) {
    const files = fs
      .readdirSync(migDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const f of files) {
      const sql = fs.readFileSync(path.join(migDir, f), "utf8").trim();
      if (!sql || sql.toLowerCase().replace(/--.*$/gm, "").trim() === "select 1;") continue;
      try {
        await db.query(sql);
        console.log(`[init-db] migrazione applicata: ${f}`);
      } catch (e) {
        console.warn(`[init-db] migrazione fallita: ${f} — ${e.message}`);
      }
    }
  }

  await db.end();
  console.log("");
  console.log("[init-db] FATTO! Ora puoi avviare con: node server.js");
}

main().catch((e) => {
  console.error("[init-db] errore fatale:", e.message);
  process.exit(1);
});
