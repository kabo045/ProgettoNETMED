/*

 Configurazione centralizzata per JWT.
 - In produzione: JWT_SECRET DEVE essere presente e lunga >= 16 char.
   Se manca, il server esce con exit(1) invece di partire con un
   fallback prevedibile (evita di forgiare token in scenari reali).
 - In sviluppo/test: warning + fallback su una chiave nota. Zero
   attrito per chi clona il repo e vuole solo far girare il progetto.
 - JWT_EXPIRES_IN configurabile via env (default 24h).
*/

// Chiave di sviluppo. Usata SOLO se NODE_ENV != production e non e' stata settata JWT_SECRET nel .env. In produzione non entr  mai in gioco: il resolver blocca prima l'avvio.
const DEV_FALLBACK = "super_secret_key";

function resolveJwtSecret() {
  const env = (process.env.NODE_ENV || "development").toLowerCase();
  const secret = process.env.JWT_SECRET;

  // 16 caratteri minimi: chiavi troppo corte sono forzabili con dizionari. 
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
      // exit(1) 
      process.exit(1);
    }
    console.warn("[SECURITY] JWT_SECRET non impostato - uso fallback DI SVILUPPO.");
    console.warn("           NON usare questa configurazione in produzione.");
    return DEV_FALLBACK;
  }

  return secret;
}

const JWT_SECRET = resolveJwtSecret();

// Scadenza dei token firmati. 24h e' un temopo abbastanzalungo per non forzare il re-login