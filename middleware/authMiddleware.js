/*
 Middleware che protegge le rotte che richiedono un utente autenticato.
 - Legge l'header "Authorization: Bearer <jwt>"
 - Verifica firma e scadenza con JWT_SECRET
 - Proietta il payload decodificato in req.user
 Uso: router.get("/private", authenticateToken, handler)
*/

const jwt = require("jsonwebtoken");

// JWT_SECRET risolto centralmente da config/security.js:
// in produzione muore se non e' settato, in dev usa un fallback noto.
const { JWT_SECRET } = require("../config/security");

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // "Bearer <token>"

  // 401 = non ti sei presentato (manca del tutto il token).
  if (!token) return res.status(401).json({ error: "Token mancante" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    // 403 = ti sei presentato ma il token e' invalido o scaduto.
    if (err) return res.status(403).json({ error: "Token non valido" });
    req.user = user; // { id, email, username }
    next();
  });
}

module.exports = authenticateToken;
