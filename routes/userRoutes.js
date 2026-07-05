const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const pool = require("../db/db");
const authenticateToken = require("../middleware/authMiddleware");
const emailService = require("../services/email");

let webpush = null;
try {
  webpush = require("web-push");
  const VP = process.env.VAPID_PUBLIC_KEY, VR = process.env.VAPID_PRIVATE_KEY;
  if (VP && VR) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@netmed.local", VP, VR);
} catch (_) { webpush = null; }

const router = express.Router();

function optionalAuth(req, res, next) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/);
  if (!m) return next();
  try {
    const jwt = require("jsonwebtoken");
    const security = require("../config/security");
    req.user = jwt.verify(m[1], security.JWT_SECRET);
  } catch (_) {}
  next();
}

const PUB_W = "v.is_private = FALSE AND v.is_flagged = FALSE";

async function ensureFollowsTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS nm_user_follows (
    follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id), CHECK (follower_id <> following_id));
    CREATE INDEX IF NOT EXISTS idx_fol_fol ON nm_user_follows(following_id);`);
}
async function ensureWatchTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS nm_watch_progress (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    seconds INTEGER NOT NULL DEFAULT 0, duration INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, video_id));`);
}
async function ensurePushTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS nm_push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW());`);
}
async function ensureDelTokens() {
  await pool.query(`CREATE TABLE IF NOT EXISTS account_delete_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(80) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);
}


// ============== HOME / CATEGORIES / TAGS ==============
router.get("/home", optionalAuth, async (req, res) => {
  try {
    const cats = await pool.query("SELECT id, name FROM categories ORDER BY name");
    const rows = [];
    for (const c of cats.rows) {
      const r = await pool.query(
        `SELECT v.id, v.youtube_id, v.title, v.thumbnail_url, v.created_at,
                c.id AS category_id, c.name AS category_name,
                u.username AS uploaded_by_username, u.is_verified AS uploaded_by_verified,
                (SELECT COUNT(*) FROM views WHERE video_id = v.id)::int AS views_count
           FROM videos v
           LEFT JOIN categories c ON c.id = v.category_id
           LEFT JOIN users u ON u.id = v.uploaded_by
          WHERE v.category_id = $1 AND ${PUB_W}
          ORDER BY v.created_at DESC LIMIT 12`, [c.id]);
      if (r.rows.length) rows.push({ category: c, videos: r.rows });
    }
    res.json({ rows });
  } catch (e) { res.status(500).json({ error: e.message, rows: [] }); }
});

router.get("/categories", async (_req, res) => {
  try {
    const r = await pool.query(
      `SELECT c.id, c.name,
              (SELECT COUNT(*) FROM videos v WHERE v.category_id = c.id AND ${PUB_W})::int AS video_count
         FROM categories c ORDER BY c.name`);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/categories/:id/videos", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "ID non valido" });
    const r = await pool.query(
      `SELECT v.id, v.youtube_id, v.title, v.thumbnail_url, v.created_at,
              c.name AS category_name, u.username AS uploaded_by_username, u.is_verified AS uploaded_by_verified,
              (SELECT COUNT(*) FROM views WHERE video_id = v.id)::int AS views_count
         FROM videos v LEFT JOIN categories c ON c.id = v.category_id
         LEFT JOIN users u ON u.id = v.uploaded_by
        WHERE v.category_id = $1 AND ${PUB_W}
        ORDER BY v.created_at DESC LIMIT 100`, [id]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/tags", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const r = await pool.query(
      `SELECT t.id, t.name,
              (SELECT COUNT(*) FROM video_tags vt JOIN videos v ON v.id = vt.video_id
                WHERE vt.tag_id = t.id AND ${PUB_W})::int AS video_count
         FROM tags t ORDER BY t.name LIMIT $1`, [limit]);
    res.json({ tags: r.rows });
  } catch (e) { res.status(500).json({ error: e.message, tags: [] }); }
});



// ============== SEARCH / EXPLORE ==============
router.get("/search", async (req, res) => {
  try {
    const q = (req.query.q || "").trim().slice(0, 100);
    const tag = (req.query.tag || "").trim().slice(0, 50);
    const cat = parseInt(req.query.cat, 10);
    const rawSort = (req.query.sort || "").trim().toLowerCase();
    const sort = ["views","useful","recent"].includes(rawSort) ? rawSort : "";
    let where = `WHERE ${PUB_W}`;
    const params = []; let i = 1;
    if (q) { where += ` AND (v.title ILIKE $${i} OR v.description ILIKE $${i})`; params.push("%"+q+"%"); i++; }
    if (Number.isFinite(cat) && cat > 0) { where += ` AND v.category_id = $${i}`; params.push(cat); i++; }
    if (tag) { where += ` AND EXISTS (SELECT 1 FROM video_tags vt JOIN tags t ON t.id=vt.tag_id WHERE vt.video_id=v.id AND t.name=$${i})`; params.push(tag); i++; }
    let orderBy = "v.created_at DESC";
    if (sort === "views") orderBy = "(SELECT COUNT(*) FROM views WHERE video_id=v.id) DESC, v.created_at DESC";
    if (sort === "useful") orderBy = "(SELECT COUNT(*) FROM likes WHERE video_id=v.id AND vote=1) DESC, v.created_at DESC";
    const videos = await pool.query(
      `SELECT v.id, v.youtube_id, v.title, v.thumbnail_url, v.created_at,
              c.name AS category_name, u.username AS uploaded_by_username, u.is_verified AS uploaded_by_verified,
              (SELECT COUNT(*) FROM views WHERE video_id=v.id)::int AS views_count,
              (SELECT COUNT(*) FROM likes WHERE video_id=v.id AND vote=1)::int AS useful_count
         FROM videos v LEFT JOIN categories c ON c.id=v.category_id
         LEFT JOIN users u ON u.id=v.uploaded_by
        ${where} ORDER BY ${orderBy} LIMIT 48`, params);
    let categories = [], tags = [];
    if (q) {
      const c = await pool.query("SELECT id, name FROM categories WHERE name ILIKE $1 ORDER BY name LIMIT 8", ["%"+q+"%"]);
      categories = c.rows;
      const t = await pool.query("SELECT id, name FROM tags WHERE name ILIKE $1 ORDER BY name LIMIT 8", ["%"+q+"%"]);
      tags = t.rows;
    }
    res.json({ videos: videos.rows, categories, tags });
  } catch (e) { res.status(500).json({ error: e.message, videos: [], categories: [], tags: [] }); }
});

router.get("/explore", async (req, res) => {
  try {
    const rawSort = (req.query.sort || "recent").trim().toLowerCase();
    const sort = ["views","useful","recent"].includes(rawSort) ? rawSort : "recent";
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 48, 1), 100);
    let orderBy = "v.created_at DESC";
    if (sort === "views") orderBy = "(SELECT COUNT(*) FROM views WHERE video_id=v.id) DESC, v.created_at DESC";
    if (sort === "useful") orderBy = "(SELECT COUNT(*) FROM likes WHERE video_id=v.id AND vote=1) DESC, v.created_at DESC";
    const r = await pool.query(
      `SELECT v.id, v.youtube_id, v.title, v.thumbnail_url, v.created_at,
              c.name AS category_name, c.id AS category_id,
              u.username AS uploaded_by_username, u.is_verified AS uploaded_by_verified,
              (SELECT COUNT(*) FROM views WHERE video_id=v.id)::int AS views_count,
              (SELECT COUNT(*) FROM likes WHERE video_id=v.id AND vote=1)::int AS useful_count
         FROM videos v LEFT JOIN categories c ON c.id=v.category_id
         LEFT JOIN users u ON u.id=v.uploaded_by
        WHERE ${PUB_W} ORDER BY ${orderBy} LIMIT $1`, [limit]);
    res.json({ sort, videos: r.rows });
  } catch (e) { res.status(500).json({ error: e.message, videos: [] }); }
});


// ============== VIDEO singolo + interazioni ==============
router.get("/videos/:id", optionalAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "ID non valido" });
    const r = await pool.query(
      `SELECT v.*, c.name AS category_name,
              u.id AS uploaded_by, u.username AS uploaded_by_username,
              u.is_verified AS uploaded_by_verified, u.avatar_url AS uploaded_by_avatar,
              u.verified_profile AS uploaded_by_profile
         FROM videos v LEFT JOIN categories c ON c.id=v.category_id
         LEFT JOIN users u ON u.id=v.uploaded_by
        WHERE v.id=$1`, [id]);
    if (!r.rows.length) return res.status(404).json({ error: "Video non trovato" });
    const v = r.rows[0];
    if ((v.is_private || v.is_flagged) && (!req.user || (req.user.id !== v.uploaded_by && req.user.role !== "admin"))) {
      return res.status(404).json({ error: "Video non disponibile" });
    }
    const cnt = await pool.query(
      `SELECT (SELECT COUNT(*) FROM views WHERE video_id=$1)::int AS views,
              (SELECT COUNT(*) FROM likes WHERE video_id=$1 AND vote=1)::int AS likes,
              (SELECT COUNT(*) FROM likes WHERE video_id=$1 AND vote=-1)::int AS dislikes`, [id]);
    v.counts = cnt.rows[0];
    if (req.user) {
      const my = await pool.query("SELECT vote FROM likes WHERE user_id=$1 AND video_id=$2", [req.user.id, id]);
      v.my_vote = my.rows.length ? my.rows[0].vote : 0;
      const fav = await pool.query("SELECT 1 FROM video_favorites WHERE user_id=$1 AND video_id=$2", [req.user.id, id]);
      v.is_favorite = fav.rows.length > 0;
      if (v.uploaded_by) {
        await ensureFollowsTable();
        const f = await pool.query("SELECT 1 FROM nm_user_follows WHERE follower_id=$1 AND following_id=$2", [req.user.id, v.uploaded_by]);
        v.uploaded_by_is_following = f.rows.length > 0;
      }
    }
    // tag
    const tg = await pool.query(
      `SELECT t.id, t.name FROM tags t JOIN video_tags vt ON vt.tag_id=t.id WHERE vt.video_id=$1 ORDER BY t.name`, [id]);
    v.tags = tg.rows;
    // followers count
    if (v.uploaded_by) {
      await ensureFollowsTable();
      const fc = await pool.query("SELECT COUNT(*)::int AS n FROM nm_user_follows WHERE following_id=$1", [v.uploaded_by]);
      v.uploaded_by_followers = fc.rows[0].n;
    }
    res.json(v);
  } catch (e) { console.error("[/videos/:id]", e.message); res.status(500).json({ error: e.message }); }
});

router.get("/videos/:id/related", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const v = await pool.query("SELECT category_id FROM videos WHERE id=$1", [id]);
    if (!v.rows.length) return res.json([]);
    const r = await pool.query(
      `SELECT v.id, v.youtube_id, v.title, v.thumbnail_url, v.created_at,
              c.name AS category_name, u.username AS uploaded_by_username,
              (SELECT COUNT(*) FROM views WHERE video_id=v.id)::int AS views_count
         FROM videos v LEFT JOIN categories c ON c.id=v.category_id
         LEFT JOIN users u ON u.id=v.uploaded_by
        WHERE v.id<>$1 AND ${PUB_W} AND (v.category_id=$2 OR $2 IS NULL)
        ORDER BY v.created_at DESC LIMIT 12`, [id, v.rows[0].category_id]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/videos/:id/view", optionalAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const uid = req.user ? req.user.id : null;
    const r = await pool.query("INSERT INTO views (user_id, video_id) VALUES ($1, $2) RETURNING id", [uid, id]);
    const cnt = await pool.query("SELECT COUNT(*)::int AS n FROM views WHERE video_id=$1", [id]);
    res.json({ ok: true, id: r.rows[0].id, views_count: cnt.rows[0].n });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/videos/:id/vote", authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const vote = parseInt(req.body && req.body.vote, 10);
    if (![1,-1,0].includes(vote)) return res.status(400).json({ error: "Voto non valido" });
    if (vote === 0) await pool.query("DELETE FROM likes WHERE user_id=$1 AND video_id=$2", [req.user.id, id]);
    else await pool.query(
      `INSERT INTO likes (user_id, video_id, vote) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, video_id) DO UPDATE SET vote=EXCLUDED.vote`, [req.user.id, id, vote]);
    const cnt = await pool.query(
      `SELECT (SELECT COUNT(*) FROM likes WHERE video_id=$1 AND vote=1)::int AS likes,
              (SELECT COUNT(*) FROM likes WHERE video_id=$1 AND vote=-1)::int AS dislikes`, [id]);
    res.json({ ok: true, my_vote: vote, counts: cnt.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// alias /like
router.post("/videos/:id/like", authenticateToken, async (req, res) => {
  req.url = req.url.replace("/like","/vote");
  router.handle(req, res, () => {});
});

router.post("/videos/:id/favorite", authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const ex = await pool.query("SELECT 1 FROM video_favorites WHERE user_id=$1 AND video_id=$2", [req.user.id, id]);
    let is_favorite;
    if (ex.rows.length) {
      await pool.query("DELETE FROM video_favorites WHERE user_id=$1 AND video_id=$2", [req.user.id, id]);
      is_favorite = false;
    } else {
      await pool.query("INSERT INTO video_favorites (user_id, video_id) VALUES ($1, $2)", [req.user.id, id]);
      is_favorite = true;
    }
    res.json({ ok: true, is_favorite });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/videos/:id/report", authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const reason = ((req.body && req.body.reason) || "").toString().slice(0,50) || "altro";
    const comment = ((req.body && req.body.comment) || "").toString().slice(0,500);
    await pool.query(
      `INSERT INTO reports (video_id, user_id, reason, comment) VALUES ($1,$2,$3,$4)
       ON CONFLICT (video_id, user_id) DO NOTHING`, [id, req.user.id, reason, comment]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ============== COMMENTS ==============
router.get("/videos/:id/comments", optionalAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const r = await pool.query(
      `SELECT c.id, c.content, c.created_at, c.parent_id, c.deleted_at,
              u.username AS user_username, u.avatar_url AS user_avatar,
              u.is_verified AS user_verified, u.id AS user_id
         FROM comments c JOIN users u ON u.id=c.user_id
        WHERE c.video_id=$1 AND c.deleted_at IS NULL
        ORDER BY c.created_at DESC LIMIT 200`, [id]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/videos/:id/comments", authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const content = ((req.body && req.body.content) || "").toString().trim();
    if (!content) return res.status(400).json({ error: "Contenuto obbligatorio" });
    if (content.length > 2000) return res.status(400).json({ error: "Massimo 2000 caratteri" });
    const parent_id = parseInt(req.body && req.body.parent_id, 10) || null;
    const ins = await pool.query(
      `INSERT INTO comments (user_id, video_id, parent_id, content)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [req.user.id, id, parent_id, content]);
    // Rileggo joinando users per restituire lo stesso shape del GET (renderCommentItem lato client lo richiede)
    const r = await pool.query(
      `SELECT c.id, c.content, c.created_at, c.parent_id, c.deleted_at,
              u.username AS user_username, u.avatar_url AS user_avatar,
              u.is_verified AS user_verified, u.id AS user_id
         FROM comments c JOIN users u ON u.id=c.user_id
        WHERE c.id=$1`, [ins.rows[0].id]);
    const comment = r.rows[0];

    // Notifica il creator del video del nuovo commento (se non e' lui stesso a commentare).
    try {
      const owner = await pool.query(
        "SELECT v.uploaded_by, v.title, u.username AS author_username FROM videos v, users u WHERE v.id=$1 AND u.id=$2",
        [id, req.user.id]
      );
      if (owner.rows.length) {
        const ownerId = owner.rows[0].uploaded_by;
        const videoTitle = owner.rows[0].title;
        const authorName = owner.rows[0].author_username;
        if (ownerId && ownerId !== req.user.id) {
          await pool.query(
            `INSERT INTO notifications (user_id, type, payload, link, created_at)
             VALUES ($1, 'new_comment', $2::jsonb, $3, NOW())`,
            [
              ownerId,
              JSON.stringify({
                video_id: id,
                video_title: videoTitle,
                comment_id: comment.id,
                author_id: req.user.id,
                author_username: authorName,
                preview: content.slice(0, 120),
              }),
              "video.html?id=" + id,
            ]
          );
        }
      }
    } catch (notifErr) {
      console.warn("[POST comment] notifica creator fallita:", notifErr.message);
    }

    // Notifica all'autore del commento padre quando qualcuno gli risponde
    // (e' la notifica piu' importante per l'utente normale).
    if (parent_id) {
      try {
        const parentRow = await pool.query(
          "SELECT user_id FROM comments WHERE id=$1 AND deleted_at IS NULL",
          [parent_id]
        );
        const parentAuthorId = parentRow.rows.length ? parentRow.rows[0].user_id : null;
        if (parentAuthorId && parentAuthorId !== req.user.id) {
          await pool.query(
            `INSERT INTO notifications (user_id, type, payload, link, created_at)
             VALUES ($1, 'reply_to_comment', $2::jsonb, $3, NOW())`,
            [
              parentAuthorId,
              JSON.stringify({
                video_id: id,
                comment_id: comment.id,
                parent_comment_id: parent_id,
                actor_id: req.user.id,
                actor_username: comment.user_username,
                snippet: content.slice(0, 140),
              }),
              "video.html?id=" + id,
            ]
          );
        }
      } catch (notifErr) {
        console.warn("[POST comment] notifica reply fallita:", notifErr.message);
      }
    }

    // Compat: alcuni vecchi client leggono res.data direttamente, altri res.data.comment.
    // Manteniamo entrambi gli shape per non rompere nulla.
    res.json(Object.assign({ ok: true, comment }, comment));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put("/comments/:id", authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const content = ((req.body && req.body.content) || "").toString().trim();
    if (!content) return res.status(400).json({ error: "Contenuto obbligatorio" });
    if (content.length > 2000) return res.status(400).json({ error: "Max 2000 char" });
    const cur = await pool.query("SELECT user_id FROM comments WHERE id=$1 AND deleted_at IS NULL", [id]);
    if (!cur.rows.length) return res.status(404).json({ error: "Commento non trovato" });
    if (cur.rows[0].user_id !== req.user.id) return res.status(403).json({ error: "Non puoi modificare un commento altrui" });
    const r = await pool.query(
      "UPDATE comments SET content=$1, updated_at=NOW() WHERE id=$2 RETURNING id, content, updated_at", [content, id]);
    res.json({ ok: true, comment: r.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/comments/:id", authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const cur = await pool.query("SELECT user_id FROM comments WHERE id=$1 AND deleted_at IS NULL", [id]);
    if (!cur.rows.length) return res.status(404).json({ error: "Commento non trovato" });
    if (cur.rows[0].user_id !== req.user.id && req.user.role !== "admin")
      return res.status(403).json({ error: "Non puoi eliminare un commento altrui" });
    await pool.query("UPDATE comments SET deleted_at=NOW(), updated_at=NOW() WHERE id=$1", [id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
//  POST /api/user/comments/:id/report
//  Un utente segnala un commento come inappropriato.
//  - Non elimina nulla: il commento resta visibile.
//  - Registra la segnalazione in comment_reports (UNIQUE per
//    coppia (comment_id, reporter) => niente doppioni).
//  - Alla soglia (3 segnalazioni open) notifica il creator del
//    video, cosi' vede l'alert e puo' moderare dal pannello.
//  - Lo strike sull'autore parte SOLO quando il creator/admin
//    conferma il commento come problematico (vedi
//    DELETE /creator/videos/:id/comments/:cid).
// ============================================================
router.post("/comments/:id/report", authenticateToken, async (req, res) => {
  try {
    const cid = parseInt(req.params.id, 10);
    if (!cid) return res.status(400).json({ error: "ID commento non valido" });

    // Auto-create tabella se assente (compat con DB piu' vecchi)
    try {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS comment_reports (
          id SERIAL PRIMARY KEY,
          comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
          reporter_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          reason VARCHAR(40) NOT NULL DEFAULT 'altro',
          note VARCHAR(500),
          status VARCHAR(20) NOT NULL DEFAULT 'open',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          resolved_at TIMESTAMPTZ,
          UNIQUE (comment_id, reporter_user_id)
        );`
      );
    } catch (_) { /* best effort */ }

    // Verifica esistenza del commento (e recupera video_id + autore)
    const cRow = await pool.query(
      `SELECT c.id, c.user_id, c.video_id, v.uploaded_by, v.title
         FROM comments c JOIN videos v ON v.id = c.video_id
        WHERE c.id = $1 AND c.deleted_at IS NULL`,
      [cid]
    );
    if (!cRow.rows.length) {
      return res.status(404).json({ error: "Commento non trovato" });
    }
    const commentAuthorId = cRow.rows[0].user_id;
    const videoId         = cRow.rows[0].video_id;
    const creatorId       = cRow.rows[0].uploaded_by;
    const videoTitle      = cRow.rows[0].title;

    // Non ha senso segnalare i propri commenti
    if (commentAuthorId === req.user.id) {
      return res.status(400).json({ error: "Non puoi segnalare un tuo commento" });
    }

    // Sanitize input
    const reasonRaw = String((req.body && req.body.reason) || "altro").toLowerCase();
    const allowed = ["spam", "abuso", "offensivo", "medico_errato", "altro"];
    const reason = allowed.indexOf(reasonRaw) >= 0 ? reasonRaw : "altro";
    const note = String((req.body && req.body.note) || "").slice(0, 500);

    // Insert con ON CONFLICT: se ho gia' segnalato, non duplico ma non fallisco
    const ins = await pool.query(
      `INSERT INTO comment_reports (comment_id, reporter_user_id, reason, note)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (comment_id, reporter_user_id) DO NOTHING
       RETURNING id`,
      [cid, req.user.id, reason, note || null]
    );
    const isNew = ins.rows.length > 0;

    // Conta le segnalazioni aperte per questo commento
    const cnt = await pool.query(
      "SELECT COUNT(*)::int AS n FROM comment_reports WHERE comment_id = $1 AND status = 'open'",
      [cid]
    );
    const openCount = cnt.rows[0].n;

    // Alla soglia (>=3), notifico il creator una sola volta
    let creatorNotified = false;
    const THRESHOLD = 3;
    if (isNew && openCount >= THRESHOLD && creatorId && creatorId !== req.user.id) {
      try {
        // Evito doppioni: cerco una notifica gia' emessa per questo commento
        const dup = await pool.query(
          `SELECT 1 FROM notifications
             WHERE user_id = $1
               AND type = 'comment_reported'
               AND payload->>'comment_id' = $2
             LIMIT 1`,
          [creatorId, String(cid)]
        );
        if (!dup.rows.length) {
          await pool.query(
            `INSERT INTO notifications (user_id, type, payload, link, created_at)
             VALUES ($1, 'comment_reported', $2::jsonb, $3, NOW())`,
            [
              creatorId,
              JSON.stringify({
                comment_id: cid,
                video_id: videoId,
                video_title: videoTitle,
                open_reports: openCount,
                message: "Un commento sul tuo video ha raggiunto la soglia di segnalazioni.",
              }),
              "video.html?id=" + videoId,
            ]
          );
          creatorNotified = true;
        }
      } catch (notifErr) {
        console.warn("[report-comment notify]", notifErr.message);
      }
    }

    const message = isNew
      ? (creatorNotified
          ? "Segnalazione inviata. Il creator del video e' stato avvisato."
          : "Segnalazione inviata. Verra' rivista da un moderatore.")
      : "Hai gia' segnalato questo commento.";

    res.json({
      ok: true,
      message,
      already_reported: !isNew,
      open_reports: openCount,
      threshold: THRESHOLD,
      creator_notified: creatorNotified,
    });
  } catch (e) {
    console.error("[POST /comments/:id/report]", e);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.delete("/comments/:id/purge", authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const cur = await pool.query("SELECT user_id, deleted_at FROM comments WHERE id=$1", [id]);
    if (!cur.rows.length) return res.status(404).json({ error: "Commento non trovato" });
    if (cur.rows[0].user_id !== req.user.id) return res.status(403).json({ error: "Non puoi" });
    if (!cur.rows[0].deleted_at) return res.status(400).json({ error: "Non ancora eliminato" });
    await pool.query("DELETE FROM comments WHERE id=$1", [id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============== FAVORITES + COLLECTIONS ==============
router.get("/favorites", authenticateToken, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT v.id, v.youtube_id, v.title, v.thumbnail_url, v.created_at,
              c.name AS category_name, u.username AS uploaded_by_username,
              vf.created_at AS favorited_at
         FROM video_favorites vf
         JOIN videos v ON v.id=vf.video_id
         LEFT JOIN categories c ON c.id=v.category_id
         LEFT JOIN users u ON u.id=v.uploaded_by
        WHERE vf.user_id=$1 ORDER BY vf.created_at DESC`, [req.user.id]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/collections", authenticateToken, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT c.id, c.name, c.created_at,
              (SELECT COUNT(*) FROM collection_videos cv WHERE cv.collection_id=c.id)::int AS video_count
         FROM collections c WHERE c.user_id=$1 ORDER BY c.created_at DESC`, [req.user.id]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/collections", authenticateToken, async (req, res) => {
  try {
    const name = ((req.body && req.body.name) || "").toString().trim().slice(0,80);
    if (!name) return res.status(400).json({ error: "Nome obbligatorio" });
    const r = await pool.query(
      `INSERT INTO collections (user_id, name) VALUES ($1,$2)
       ON CONFLICT (user_id, name) DO NOTHING RETURNING id, name, created_at`, [req.user.id, name]);
    if (!r.rows.length) return res.status(409).json({ error: "Cartella già esistente" });
    res.json({ ...r.rows[0], video_count: 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/collections/:id", authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const r = await pool.query("DELETE FROM collections WHERE id=$1 AND user_id=$2 RETURNING id", [id, req.user.id]);
    if (!r.rows.length) return res.status(404).json({ error: "Cartella non trovata" });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/collections/:id/videos", authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const own = await pool.query("SELECT 1 FROM collections WHERE id=$1 AND user_id=$2", [id, req.user.id]);
    if (!own.rows.length) return res.status(404).json({ error: "Cartella non trovata" });
    const r = await pool.query(
      `SELECT v.id, v.youtube_id, v.title, v.thumbnail_url, v.created_at,
              c.name AS category_name, u.username AS uploaded_by_username,
              cv.added_at AS favorited_at
         FROM collection_videos cv
         JOIN videos v ON v.id=cv.video_id
         LEFT JOIN categories c ON c.id=v.category_id
         LEFT JOIN users u ON u.id=v.uploaded_by
        WHERE cv.collection_id=$1 ORDER BY cv.added_at DESC`, [id]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/collections/:id/videos", authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const vid = parseInt(req.body && req.body.video_id, 10);
    if (!vid) return res.status(400).json({ error: "video_id mancante" });
    const own = await pool.query("SELECT 1 FROM collections WHERE id=$1 AND user_id=$2", [id, req.user.id]);
    if (!own.rows.length) return res.status(404).json({ error: "Cartella non trovata" });
    await pool.query(
      "INSERT INTO collection_videos (collection_id, video_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [id, vid]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/collections/:id/videos/:vid", authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const vid = parseInt(req.params.vid, 10);
    const own = await pool.query("SELECT 1 FROM collections WHERE id=$1 AND user_id=$2", [id, req.user.id]);
    if (!own.rows.length) return res.status(404).json({ error: "Cartella non trovata" });
    await pool.query("DELETE FROM collection_videos WHERE collection_id=$1 AND video_id=$2", [id, vid]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ============== ME — profilo, history, comments, notifications ==============
router.get("/me/comments", authenticateToken, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page,10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit,10) || 20, 50);
    const offset = (page-1)*limit;
    const filter = (req.query.filter || "all").trim().toLowerCase();
    const q = (req.query.q || "").trim();
    const vidParam = parseInt(req.query.video_id, 10);
    const sort = (req.query.sort || "recent").trim().toLowerCase();
    let where = "WHERE c.user_id=$1 AND v.id IS NOT NULL";
    const params = [req.user.id]; let i = 2;
    if (filter === "active") where += " AND c.deleted_at IS NULL";
    if (filter === "deleted") where += " AND c.deleted_at IS NOT NULL";
    if (q) { where += ` AND c.content ILIKE $${i}`; params.push("%"+q+"%"); i++; }
    if (Number.isFinite(vidParam) && vidParam > 0) { where += ` AND c.video_id = $${i}`; params.push(vidParam); i++; }
    const orderBy = sort === "old" ? "c.created_at ASC" : "c.created_at DESC";
    const r = await pool.query(
      `SELECT c.id, c.content, c.created_at, c.deleted_at, c.parent_id, c.video_id,
              v.title AS video_title, v.youtube_id AS video_youtube_id,
              p.content AS parent_content, pu.username AS parent_username
         FROM comments c
         LEFT JOIN videos v ON v.id=c.video_id
         LEFT JOIN comments p ON p.id=c.parent_id
         LEFT JOIN users pu ON pu.id=p.user_id
         ${where} ORDER BY ${orderBy} LIMIT $${i} OFFSET $${i+1}`,
      [...params, limit, offset]);
    const videosR = await pool.query(
      `SELECT DISTINCT v.id, v.title FROM comments c
         LEFT JOIN videos v ON v.id=c.video_id
        WHERE c.user_id=$1 AND v.id IS NOT NULL ORDER BY v.title LIMIT 100`, [req.user.id]);
    res.json({ items: r.rows, videos: videosR.rows });
  } catch (e) { res.status(500).json({ error: e.message, items: [] }); }
});

router.get("/me/history", authenticateToken, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page,10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit,10) || 24, 100);
    const offset = (page-1)*limit;
    const cat = parseInt(req.query.cat, 10);
    // Filtro categoria opzionale + pagination con total per "Mostra altri"
    let where = "WHERE vw.user_id=$1";
    const params = [req.user.id];
    if (Number.isFinite(cat) && cat > 0) {
      where += ` AND v.category_id = $${params.length + 1}`;
      params.push(cat);
    }
    const totalQ = await pool.query(
      `SELECT COUNT(DISTINCT v.id)::int AS n
         FROM views vw JOIN videos v ON v.id=vw.video_id ${where}`, params);
    const total = totalQ.rows[0].n || 0;
    params.push(limit, offset);
    const r = await pool.query(
      `SELECT v.id, v.youtube_id, v.title, v.thumbnail_url, v.created_at,
              v.category_id, c.name AS category_name, u.username AS uploaded_by_username,
              MAX(vw.viewed_at) AS last_viewed, COUNT(vw.id)::int AS view_count
         FROM views vw JOIN videos v ON v.id=vw.video_id
         LEFT JOIN categories c ON c.id=v.category_id
         LEFT JOIN users u ON u.id=v.uploaded_by
        ${where}
        GROUP BY v.id, c.name, u.username
        ORDER BY last_viewed DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    res.json({ items: r.rows, pagination: { page, limit, total } });
  } catch (e) { res.status(500).json({ error: e.message, items: [] }); }
});

// DELETE /me/history/:videoId - rimuove dalla cronologia un singolo video
// (cancella tutte le righe in views per quel video, solo per l'utente loggato).
router.delete("/me/history/:videoId", authenticateToken, async (req, res) => {
  try {
    const vid = parseInt(req.params.videoId, 10);
    if (!vid) return res.status(400).json({ error: "ID video non valido" });
    await pool.query("DELETE FROM views WHERE user_id=$1 AND video_id=$2", [req.user.id, vid]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /me/history - svuota tutta la cronologia dell'utente loggato.
router.delete("/me/history", authenticateToken, async (req, res) => {
  try {
    await pool.query("DELETE FROM views WHERE user_id=$1", [req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


router.get("/me/notifications", authenticateToken, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, type, payload, link, read_at, created_at
         FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`, [req.user.id]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/me/notifications/unread-count", authenticateToken, async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT COUNT(*)::int AS n FROM notifications WHERE user_id=$1 AND read_at IS NULL", [req.user.id]);
    res.json({ count: r.rows[0].n });
  } catch (e) { res.status(500).json({ error: e.message, count: 0 }); }
});

router.put("/me/notifications/:id/read", authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await pool.query("UPDATE notifications SET read_at=NOW() WHERE id=$1 AND user_id=$2", [id, req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put("/me/notifications/read-all", authenticateToken, async (req, res) => {
  try {
    await pool.query("UPDATE notifications SET read_at=NOW() WHERE user_id=$1 AND read_at IS NULL", [req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/me/notifications", authenticateToken, async (req, res) => {
  try {
    await pool.query("DELETE FROM notifications WHERE user_id=$1", [req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/me/notifications/:id", authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await pool.query("DELETE FROM notifications WHERE id=$1 AND user_id=$2", [id, req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put("/me/profile", authenticateToken, async (req, res) => {
  try {
    const username = ((req.body && req.body.username) || "").toString().trim().slice(0,100);
    const avatar_url = req.body && req.body.avatar_url ? req.body.avatar_url.toString() : null;
    const fields = []; const params = []; let i = 1;
    if (username) { fields.push(`username=$${i}`); params.push(username); i++; }
    if (avatar_url !== null) { fields.push(`avatar_url=$${i}`); params.push(avatar_url); i++; }
    if (!fields.length) return res.json({ ok: true });
    params.push(req.user.id);
    await pool.query(`UPDATE users SET ${fields.join(",")}, updated_at=NOW() WHERE id=$${i}`, params);
    res.json({ ok: true });
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "Username già in uso" });
    res.status(500).json({ error: e.message });
  }
});

router.put("/me/password", authenticateToken, async (req, res) => {
  try {
    const oldP = ((req.body && req.body.old_password) || "").toString();
    const newP = ((req.body && req.body.new_password) || "").toString();
    if (!oldP || newP.length < 8) return res.status(400).json({ error: "Password troppo corta (min 8 char)" });
    const u = await pool.query("SELECT password_hash FROM users WHERE id=$1", [req.user.id]);
    if (!u.rows.length) return res.status(404).json({ error: "Utente non trovato" });
    const ok = await bcrypt.compare(oldP, u.rows[0].password_hash);
    if (!ok) return res.status(403).json({ error: "Password attuale errata" });
    const hash = await bcrypt.hash(newP, 10);
    await pool.query("UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2", [hash, req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put("/me/verified-profile", authenticateToken, async (req, res) => {
  try {
    const me = await pool.query("SELECT is_verified, role FROM users WHERE id=$1", [req.user.id]);
    if (!me.rows.length) return res.status(404).json({ error: "Utente non trovato" });
    if (!me.rows[0].is_verified && me.rows[0].role !== "admin")
      return res.status(403).json({ error: "Solo utenti verificati" });
    const profile = req.body && req.body.profile ? req.body.profile : {};
    await pool.query("UPDATE users SET verified_profile=$1::jsonb, updated_at=NOW() WHERE id=$2",
      [JSON.stringify(profile), req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/me/verified-request", authenticateToken, async (req, res) => {
  try {
    await pool.query(
      `UPDATE users SET verified_request=TRUE, verified_request_at=NOW(), updated_at=NOW()
       WHERE id=$1 AND is_verified=FALSE`, [req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /me/request-creator
// Endpoint usato dal form profilo "Diventa creator". Riceve title, qualifica,
// organization, li salva in verified_profile (JSONB) e marca la richiesta
// come pending. L'admin la trovera' in admin_richieste.html.
router.post("/me/request-creator", authenticateToken, async (req, res) => {
  try {
    const title = ((req.body && req.body.title) || "").toString().trim().slice(0, 60);
    const qualifica = ((req.body && req.body.qualifica) || "").toString().trim().slice(0, 120);
    const organization = ((req.body && req.body.organization) || "").toString().trim().slice(0, 160);
    if (!title && !qualifica) {
      return res.status(400).json({ error: "Compila almeno titolo o qualifica" });
    }
    const profile = {
      title: title,
      qualifica: qualifica,
      organization: organization,
      requested_at: new Date().toISOString(),
    };
    await pool.query(
      `UPDATE users
          SET verified_request = TRUE,
              verified_request_at = NOW(),
              verified_profile = $1::jsonb,
              updated_at = NOW()
        WHERE id = $2 AND is_verified = FALSE`,
      [JSON.stringify(profile), req.user.id]
    );
    // Notifica gli admin (best effort, non blocca la richiesta)
    try {
      const admins = await pool.query("SELECT id FROM users WHERE role = 'admin'");
      const payload = JSON.stringify({
        requested_user_id: req.user.id,
        requested_username: req.user.username,
        email: req.user.email,
        title: title,
        qualifica: qualifica,
        organization: organization,
      });
      for (const a of admins.rows) {
        await pool.query(
          `INSERT INTO notifications (user_id, type, payload, link, created_at)
           VALUES ($1, 'creator_request', $2, $3, NOW())`,
          [a.id, payload, "admin_richieste.html"]
        );
      }
    } catch (notifErr) {
      console.warn("[/me/request-creator] notifica admin fallita:", notifErr.message);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("[/me/request-creator]", e);
    res.status(500).json({ error: e.message });
  }
});


// ============== FOLLOW / CREATORS / FEED ==============
router.post("/creators/:username/follow", authenticateToken, async (req, res) => {
  try {
    await ensureFollowsTable();
    const u = await pool.query("SELECT id FROM users WHERE username=$1", [req.params.username]);
    if (!u.rows.length) return res.status(404).json({ error: "Creator non trovato" });
    const cid = u.rows[0].id;
    if (cid === req.user.id) return res.status(400).json({ error: "Non puoi seguirti" });
    const insertRes = await pool.query(
      `INSERT INTO nm_user_follows (follower_id, following_id) VALUES ($1,$2)
       ON CONFLICT DO NOTHING RETURNING follower_id`, [req.user.id, cid]);
    const c = await pool.query("SELECT COUNT(*)::int AS n FROM nm_user_follows WHERE following_id=$1", [cid]);

    // Se l'INSERT ha effettivamente aggiunto una riga (cioe' non era gia' seguito),
    // creo una notifica per il creator. ON CONFLICT DO NOTHING ritorna 0 righe se duplicato.
    if (insertRes.rows.length > 0) {
      try {
        await pool.query(
          `INSERT INTO notifications (user_id, type, payload, link, created_at)
           VALUES ($1, 'new_follower', $2::jsonb, $3, NOW())`,
          [
            cid,
            JSON.stringify({
              follower_id: req.user.id,
              follower_username: req.user.username,
            }),
            "creator-public.html?u=" + encodeURIComponent(req.user.username),
          ]
        );
      } catch (notifErr) {
        console.warn("[POST follow] notifica creator fallita:", notifErr.message);
      }
    }

    res.json({ ok: true, is_following: true, followers: c.rows[0].n });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/creators/:username/follow", authenticateToken, async (req, res) => {
  try {
    await ensureFollowsTable();
    const u = await pool.query("SELECT id FROM users WHERE username=$1", [req.params.username]);
    if (!u.rows.length) return res.status(404).json({ error: "Creator non trovato" });
    const cid = u.rows[0].id;
    await pool.query("DELETE FROM nm_user_follows WHERE follower_id=$1 AND following_id=$2", [req.user.id, cid]);
    const c = await pool.query("SELECT COUNT(*)::int AS n FROM nm_user_follows WHERE following_id=$1", [cid]);
    res.json({ ok: true, is_following: false, followers: c.rows[0].n });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/creators/:username", optionalAuth, async (req, res) => {
  try {
    await ensureFollowsTable();
    const u = await pool.query(
      `SELECT id, username, avatar_url, is_verified, verified_profile, created_at
         FROM users WHERE username=$1`, [req.params.username]);
    if (!u.rows.length) return res.status(404).json({ error: "Creator non trovato" });
    const c = u.rows[0];
    const fc = await pool.query("SELECT COUNT(*)::int AS n FROM nm_user_follows WHERE following_id=$1", [c.id]);
    c.followers = fc.rows[0].n;
    if (req.user) {
      const f = await pool.query("SELECT 1 FROM nm_user_follows WHERE follower_id=$1 AND following_id=$2", [req.user.id, c.id]);
      c.is_following = f.rows.length > 0;
    }
    const vids = await pool.query(
      `SELECT v.id, v.youtube_id, v.title, v.thumbnail_url, v.created_at,
              cat.name AS category_name,
              (SELECT COUNT(*) FROM views WHERE video_id=v.id)::int AS views_count
         FROM videos v LEFT JOIN categories cat ON cat.id=v.category_id
        WHERE v.uploaded_by=$1 AND ${PUB_W}
        ORDER BY v.created_at DESC LIMIT 60`, [c.id]);
    c.videos = vids.rows;
    res.json(c);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/creators/:username/followers", async (req, res) => {
  try {
    await ensureFollowsTable();
    const u = await pool.query("SELECT id FROM users WHERE username=$1", [req.params.username]);
    if (!u.rows.length) return res.json([]);
    const r = await pool.query(
      `SELECT u.id, u.username, u.avatar_url, u.is_verified, f.created_at
         FROM nm_user_follows f JOIN users u ON u.id=f.follower_id
        WHERE f.following_id=$1 ORDER BY f.created_at DESC LIMIT 200`, [u.rows[0].id]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message, followers: [] }); }
});

router.get("/me/feed/grouped", authenticateToken, async (req, res) => {
  try {
    await ensureFollowsTable();
    const perCreator = Math.min(Math.max(parseInt(req.query.per_creator, 10) || 12, 1), 30);
    const fol = await pool.query(
      `SELECT u.id, u.username, u.avatar_url, u.is_verified, u.verified_profile
         FROM nm_user_follows f JOIN users u ON u.id=f.following_id
        WHERE f.follower_id=$1 ORDER BY f.created_at DESC LIMIT 50`, [req.user.id]);
    const groups = [];
    for (const c of fol.rows) {
      const v = await pool.query(
        `SELECT v.id, v.youtube_id, v.title, v.thumbnail_url, v.created_at,
                cat.name AS category_name,
                (SELECT COUNT(*) FROM views WHERE video_id=v.id)::int AS views_count
           FROM videos v LEFT JOIN categories cat ON cat.id=v.category_id
          WHERE v.uploaded_by=$1 AND ${PUB_W}
          ORDER BY v.created_at DESC LIMIT $2`, [c.id, perCreator]);
      if (v.rows.length) groups.push({ creator: c, videos: v.rows });
    }
    res.json({ groups });
  } catch (e) { res.status(500).json({ error: e.message, groups: [] }); }
});

router.get("/creators/:username/following", async (req, res) => {
  try {
    await ensureFollowsTable();
    const u = await pool.query("SELECT id FROM users WHERE username=$1", [req.params.username]);
    if (!u.rows.length) return res.json([]);
    const r = await pool.query(
      `SELECT u.id, u.username, u.avatar_url, u.is_verified, f.created_at
         FROM nm_user_follows f JOIN users u ON u.id=f.following_id
        WHERE f.follower_id=$1 ORDER BY f.created_at DESC LIMIT 200`, [u.rows[0].id]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message, following: [] }); }
});

// GET /me - dati dell'utente loggato (usato dalla pagina profilo).
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, email, username, avatar_url, role, is_verified, verified_profile,
              email_confirmed, verified_request, verified_request_at, created_at
         FROM users WHERE id=$1`, [req.user.id]);
    if (!r.rows.length) return res.status(404).json({ error: "Utente non trovato" });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /me - aggiorna username/email dell'utente loggato.
router.put("/me", authenticateToken, async (req, res) => {
  try {
    const username = ((req.body && req.body.username) || "").toString().trim();
    const email = ((req.body && req.body.email) || "").toString().trim();
    if (!username && !email) return res.status(400).json({ error: "Nessun campo da aggiornare" });
    if (username && !/^[a-zA-Z0-9_.]{3,30}$/.test(username))
      return res.status(400).json({ error: "Username 3-30 caratteri (lettere/numeri/_/.)" });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: "Email non valida" });
    // Verifica unicita'

    if (username) {
      const dup = await pool.query("SELECT id FROM users WHERE username=$1 AND id<>$2", [username, req.user.id]);
      if (dup.rows.length) return res.status(409).json({ error: "Username gia' in uso" });
    }
    if (email) {
      const dup = await pool.query("SELECT id FROM users WHERE email=$1 AND id<>$2", [email, req.user.id]);
      if (dup.rows.length) return res.status(409).json({ error: "Email gia' in uso" });
    }
    const fields = [], vals = [];
    if (username) { fields.push("username=$" + (vals.length+1)); vals.push(username); }
    if (email)    { fields.push("email=$" + (vals.length+1));    vals.push(email); }
    vals.push(req.user.id);
    await pool.query("UPDATE users SET " + fields.join(", ") + ", updated_at=NOW() WHERE id=$" + vals.length, vals);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/me", authenticateToken, async (req, res) => {
  try {
    await pool.query("DELETE FROM users WHERE id=$1", [req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ============================================================
//  GET /watch-progress  → lista degli ultimi video "in corso"
//  POST /watch-progress → UPSERT dei secondi visti
//  La tabella e' auto-creata da ensureWatchTable() (sopra).
// ============================================================
router.get("/watch-progress", authenticateToken, async (req, res) => {
  try {
    await ensureWatchTable();
    const r = await pool.query(
      `SELECT v.id, v.youtube_id, v.title, v.thumbnail_url,
              c.name AS category_name,
              wp.seconds, wp.duration, wp.updated_at AS watched_at
         FROM nm_watch_progress wp
         JOIN videos v ON v.id = wp.video_id
         LEFT JOIN categories c ON c.id = v.category_id
        WHERE wp.user_id = $1
          AND v.is_private = FALSE
          AND (wp.duration = 0 OR wp.seconds < wp.duration - 30)
        ORDER BY wp.updated_at DESC
        LIMIT 12`,
      [req.user.id]
    );
    res.json({ items: r.rows });
  } catch (e) {
    console.error("[GET /watch-progress]", e.message);
    // Best effort: la riga "Continua a guardare" non deve rompere la home.
    res.json({ items: [] });
  }
});

router.post("/watch-progress", authenticateToken, async (req, res) => {
  try {
    await ensureWatchTable();
    const video_id = parseInt(req.body && req.body.video_id, 10);
    const seconds  = Math.max(0, parseInt(req.body && req.body.seconds, 10)  || 0);
    const duration = Math.max(0, parseInt(req.body && req.body.duration, 10) || 0);
    if (!video_id) return res.status(400).json({ error: "video_id mancante" });
    await pool.query(
      `INSERT INTO nm_watch_progress (user_id, video_id, seconds, duration, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, video_id) DO UPDATE
          SET seconds    = GREATEST(nm_watch_progress.seconds,  EXCLUDED.seconds),
              duration   = GREATEST(nm_watch_progress.duration, EXCLUDED.duration),
              updated_at = NOW()`,
      [req.user.id, video_id, seconds, duration]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("[POST /watch-progress]", e.message);
    res.status(500).json({ error: "Errore interno" });
  }
});

module.exports = router;
