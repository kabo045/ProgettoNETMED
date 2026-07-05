/* Middleware per le rotte "creator

   1) requireVerified passa se l'utente è verified OPPURE admin.
      Resta utile per endpoint "lettura privilegiata" dove l'admin
      ha senso (es. anteprime, report). Non ci fidiamo del token
      JWT: rileggiamo i flag dal DB ad ogni richiesta per supportare
      la revoca istantaneaa.
   2) requireCreator versione STRETTA: passa solo per utenti
      verified che NON sono admin. Da usare per upload/edit/delete
      di video. politica: l'admin modera, non crea contenuti propri.
      Questo rende impossibile  all'admin caricare video.
   3) requireVideoOwner verifica che il video :id (param) sia
      stato caricato dall'utente loggato. Da usare dopo requireCreator.
      Qui sta il cuore del modello "scope ai propri contenuti":
      senza questo middleware un utente verified potrebbe modificare i
      video di un altro utente verified, rompendo l'intero meccanismo.
*/
const pool = require("../db/db");

async function requireVerified(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: "Autenticazione richiesta" });
  }

  try {
    const r = await pool.query("SELECT is_verified, role FROM users WHERE id = $1", [req.user.id]);
    if (!r.rows.length) {
      return res.status(401).json({ error: "Utente non trovato" });
    }

    const { is_verified, role } = r.rows[0];

    // Gli admin hanno sempre l'accesso. Gli utenti bannati no, anche se erano verified prima del ban.
    if (role === "banned") {
      return res.status(403).json({ error: "Account sospeso" });
    }
    if (role !== "admin" && !is_verified) {
      return res.status(403).json({
        error: "Solo gli account verificati possono accedere a questa risorsa",
      });
    }

    req.user.is_verified = !!is_verified;
    req.user.role = role;
    next();
  } catch (e) {
    console.error("[requireVerified] DB error:", e);
    res.status(500).json({ error: "Errore interno" });
  }
}

// requireCreator variante simil di requireVerified. Passa solo se l'utente è verified e non è admin.l'admin modera ma non crea contenuti. Per le moderazioni "d'autorità" usa gli endpoint /api/admin/*.
async function requireCreator(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: "Autenticazione richiesta" });
  }


  try {
    const r = await pool.query("SELECT is_verified, role FROM users WHERE id = $1", [req.user.id]);
    if (!r.rows.length) {
      return res.status(401).json({ error: "Utente non trovato" });
    }

    const { is_verified, role } = r.rows[0];

    if (role === "banned") {
      return res.status(403).json({ error: "Account sospeso" });
    }
    if (role === "admin") {
      return res.status(403).json({
        error:
          "Gli amministratori non possono caricare o modificare video. Usa il pannello di amministrazione per moderare.",
      });
    }
    if (!is_verified) {
      return res.status(403).json({
        error: "Solo gli account verificati possono caricare o modificare video",
      });
    }

    req.user.is_verified = !!is_verified;
    req.user.role = role;
    next();
  } catch (e) {
    console.error("[requireCreator] DB error:", e);
    res.status(500).json({ error: "Errore interno" });
  }
}

// Factory che restituisce un middleware: il param può chiamarsi "id", "videoId", "vid" — di default :id (la maggior parte delle rotte creator usa /videos/:id).
function requireVideoOwner(paramName = "id") {
  return async function (req, res, next) {
    const videoId = parseInt(req.params[paramName], 10);
    if (!videoId) return res.status(400).json({ error: "ID video non valido" });

    try {
      const r = await pool.query("SELECT id, uploaded_by FROM videos WHERE id = $1", [videoId]);
      if (!r.rows.length) {
        return res.status(404).json({ error: "Video non trovato" });
      }

      const v = r.rows[0];

      // Sotto requireCreator l'admin è già stato bloccato, quindi qui è sufficiente lo scope-check sull'autore.
      if (v.uploaded_by !== req.user.id) {
        return res.status(403).json({
          error: "Non sei l'autore di questo video",
        });
      }

      // Inoltro il record per evitare una seconda query nell'handler.
      req.video = v;
      next();
    } catch (e) {
      console.error("[requireVideoOwner] DB error:", e);
      res.status(500).json({ error: "Errore interno" });
    }
  };
}

module.exports = { requireVerified, requireCreator, requireVideoOwner };
