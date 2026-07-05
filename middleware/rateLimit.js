/*
 Rate limiter "sliding window" in-memory per Express.
 
 - Ogni IP ha una lista di timestamp; a ogni hit teniamo solo quelli
   dentro la finestra.

 - Ogni limiter (login/register/forgot) ha la SUA Map: le quote non
   si mescolano tra loro.
 - Con env RATE_LIMIT_OFF=1 o in NODE_ENV=test il middleware e'
   disabilitato: i test Supertest sparano tante richieste e non
   devono essere bloccati.
 - Limite: in-memory non scala orizzontalmente. Con piu' istanze Node
   ogni processo ha il suo contatore. In produzione: sostituire con
   Redis.
*/

const OFF = process.env.RATE_LIMIT_OFF === "1" || process.env.NODE_ENV === "test";

function createRateLimiter({ windowMs, max, label }) {
  if (OFF) return (req, res, next) => next();
  const hits = new Map();
  return function rateLimiter(req, res, next) {
    const ip = (req.ip || (req.connection && req.connection.remoteAddress) || "unknown").toString();
    const now = Date.now();
    const list = (hits.get(ip) || []).filter((t) => now - t < windowMs);

    if (list.length >= max) {
      const retryAfter = Math.ceil((windowMs - (now - list[0])) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        error:
          "Troppi tentativi (" +
          label +
          "). Riprova tra " +
          Math.ceil(retryAfter / 60) +
          " minuti.",
      });
    }
    list.push(now);
    hits.set(ip, list);

    // pulizia quando la mappa crsce, itero e rimuovo gli ip con i timestamp scaduti.
    if (hits.size > 5000 && Math.random() < 0.01) {
      for (const [k, v] of hits) {
        const fresh = v.filter((t) => now - t < windowMs);
        if (fresh.length === 0) hits.delete(k);
        else hits.set(k, fresh);
      }
    }
    next();
  };
}

// Configurazioni: 8 login ogni 15 min per IP, 5 register/h, 5 forgot/h. per evitare attacchi brute-force da un malintenzionato che usa singolo ip
const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 8, label: "login" });
const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  label: "registrazione",
});
const forgotLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  label: "recupero password",
});

module.exports = {
  createRateLimiter,
  loginLimiter,
  registerLimiter,
  forgotLimiter,
};
