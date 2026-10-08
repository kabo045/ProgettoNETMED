

const DEV_FALLBACK = "super_secret_key";

function resolveJwtSecret() {
  const env = (process.env.NODE_ENV || "development").toLowerCase();
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 16) {
    if (env === "production") {
      console.error("");
      console.error("======================================================");
      console.error("  ERRORE DI SICUREZZA: JWT_SECRET non configurato");
      console.error("======================================================");
      console.error("  In produzione DEVI impostare la variabile d'ambiente");
      console.error("  JWT_SECRET con un valore casuale lungo (>= 32 byte).");
      console.error("");
      console.error("  Genera un secret con:");
      console.error("    node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"");
      console.error("");
      console.error("  Poi impostalo nel tuo provider (Render, Railway,");
      console.error("  Heroku, ecc.) come variabile JWT_SECRET.");
      console.error("======================================================");
      process.exit(1);
    }
    console.warn("[SECURITY] JWT_SECRET non impostato - uso fallback DI SVILUPPO.");
    console.warn("           NON usare questa configurazione in produzione.");
    return DEV_FALLBACK;
  }

  return secret;
}

const JWT_SECRET = resolveJwtSecret();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";

module.exports = {
  JWT_SECRET,
  JWT_EXPIRES_IN,
};
