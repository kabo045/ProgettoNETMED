
const { Pool } = require("pg");

const useSSL = String(process.env.DB_SSL || "").toLowerCase() === "true";
const sslOpt = useSSL ? { ssl: { rejectUnauthorized: false } } : {};

const pool = new Pool(
  process.env.DATABASE_URL
    ? Object.assign({ connectionString: process.env.DATABASE_URL }, sslOpt)
    : Object.assign(
        {
          host: process.env.DB_HOST || "localhost",
          port: parseInt(process.env.DB_PORT || "5432", 10),
          database: process.env.DB_NAME || "netmed",
          user: process.env.DB_USER || "postgres",
          password: process.env.DB_PASSWORD || "postgres",
        },
        sslOpt
      )
);

function logOk() {
  console.log("[DB] connesso.");
}
function logErr(err) {
  console.error("[DB] errore connessione:", err.message);
}

pool.query("SELECT NOW()").then(logOk).catch(logErr);

module.exports = pool;
