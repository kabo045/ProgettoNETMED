

const express = require("express");
const pool = require("../db/db");
const authenticateToken = require("../middleware/authMiddleware");
const { requireCreator, requireVideoOwner } = require("../middleware/creatorMiddleware");

const router = express.Router();
router.use(authenticateToken);
router.use(requireCreator);

// Helper: ricava la URL della thumbnail YouTube dal video_id
const ytThumb = (yid) => `https://img.youtube.com/vi/${yid}/mqdefault.jpg`;

// Helper: validazione minima dei tag_ids (deve essere array di interi)
function safeTagIds(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((n) => parseInt(n, 10))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, 20);
}

function safeTagNames(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const x of raw) {
    const s = String(x || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    if (s.length >= 2 && s.length <= 40 && !out.includes(s)) out.push(s);
    if (out.length >= 20) break;
  }
  return out;
}

async function resolveOrCreateTagIds(names) {
  const ids = [];
  for (const name of names) {
    try {
      const ins = await pool.query(
        "INSERT INTO tags(name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id",
        [name]
      );
      if (ins.rows.length) ids.push(ins.rows[0].id);
      else {
        const s = await pool.query("SELECT id FROM tags WHERE name = $1", [name]);
        if (s.rows.length) ids.push(s.rows[0].id);
      }
    } catch (e) {
      /* tag malformato: salta */
    }
  }
  return ids;
}

async function resolveOrCreateCategoryId(rawName) {
  const name = String(rawName || "")
    .trim()
    .slice(0, 80);
  if (name.length < 2) return null;
  try {
    const ins = await pool.query(
      "INSERT INTO categories(name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id",
      [name]
    );
    if (ins.rows.length) return ins.rows[0].id;
    const s = await pool.query("SELECT id FROM categories WHERE LOWER(name) = LOWER($1)", [name]);
    return s.rows.length ? s.rows[0].id : null;
  } catch (e) {
    return null;
  }
}

// ============================================================
// GET /api/creator/my/videos
// Lista paginata dei propri video, con conteggi di base
// (views/likes/commenti) per ogni record.
// ============================================================
router.get("/my/videos", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = (page - 1) * limit;
    const search = (req.query.search || "").trim().slice(0, 100);

    let where = "WHERE v.uploaded_by = $1";
    const params = [req.user.id];
    let pi = 2;
    if (search) {
      where += ` AND (v.title ILIKE $${pi} OR v.description ILIKE $${pi})`;
      params.push("%" + search + "%");
      pi++;
    }

    const totalR = await pool.query(`SELECT COUNT(*)::int AS n FROM videos v ${where}`, params);
    const total = totalR.rows[0].n;

    const r = await pool.query(
      `SELECT v.id, v.youtube_id, v.title, v.description, v.thumbnail_url,
                    v.is_private, v.is_flagged, v.created_at,
                    c.id AS category_id, c.name AS category_name,
                    (SELECT COUNT(*)::int FROM views    WHERE video_id = v.id)            AS view_count,
                    (SELECT COUNT(*)::int FROM likes    WHERE video_id = v.id AND vote =  1) AS like_count,
                    (SELECT COUNT(*)::int FROM likes    WHERE video_id = v.id AND vote = -1) AS dislike_count,
                    (SELECT COUNT(*)::int FROM comments WHERE video_id = v.id AND deleted_at IS NULL) AS comment_count,
                    (SELECT COUNT(*)::int FROM reports  WHERE video_id = v.id AND status = 'pending') AS pending_reports
               FROM videos v
               LEFT JOIN categories c ON c.id = v.category_id
              ${where}
              ORDER BY v.created_at DESC
              LIMIT $${pi} OFFSET $${pi + 1}`,
      [...params, limit, offset]
    );

    res.json({
      videos: r.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ============================================================
// GET /api/creator/my/stats
// Riepilogo aggregato per la dashboard del creator.
// ============================================================
router.get("/my/stats", async (req, res) => {
  try {
    const uid = req.user.id;
    const [vids, views, likes, comm, weekViews] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS n FROM videos WHERE uploaded_by=$1", [uid]),
      pool.query(
        "SELECT COUNT(*)::int AS n FROM views v JOIN videos vi ON vi.id=v.video_id WHERE vi.uploaded_by=$1",
        [uid]
      ),
      pool.query(
        "SELECT COUNT(*)::int AS n FROM likes l JOIN videos vi ON vi.id=l.video_id WHERE vi.uploaded_by=$1 AND l.vote=1",
        [uid]
      ),
      pool.query(
        "SELECT COUNT(*)::int AS n FROM comments c JOIN videos vi ON vi.id=c.video_id WHERE vi.uploaded_by=$1 AND c.deleted_at IS NULL",
        [uid]
      ),
      pool.query(
        `SELECT DATE(viewed_at) AS day, COUNT(*)::int AS views
                   FROM views v JOIN videos vi ON vi.id=v.video_id
                  WHERE vi.uploaded_by=$1 AND v.viewed_at > NOW() - INTERVAL '7 days'
                  GROUP BY DATE(viewed_at) ORDER BY day`,
        [uid]
      ),
    ]);
    res.json({
      videos: vids.rows[0].n,
      views: views.rows[0].n,
      likes: likes.rows[0].n,
      comments: comm.rows[0].n,
      week_views: weekViews.rows,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ============================================================
// GET /api/creator/videos/:id
// Restituisce un singolo video di proprietà del creator, con la
// lista dei tag_ids associati. Usato dalla pagina creator-upload
// in modalità modifica per popolare il form.
// ============================================================
router.get("/videos/:id", requireVideoOwner(), async (req, res) => {
  try {
    const videoId = parseInt(req.params.id, 10);

    const v = await pool.query(
      `SELECT id, youtube_id, title, description, thumbnail_url,
                    category_id, is_private, is_flagged, created_at
               FROM videos WHERE id = $1`,
      [videoId]
    );
    if (!v.rows.length) {
      return res.status(404).json({ error: "Video non trovato" });
    }

    const t = await pool.query("SELECT tag_id FROM video_tags WHERE video_id = $1", [videoId]);

    res.json({
      ...v.rows[0],
      tag_ids: t.rows.map((r) => r.tag_id),
    });
  } catch (e) {
    console.error("[GET /creator/videos/:id]", e);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ============================================================
// POST /api/creator/videos
// Carica un nuovo video. Identico al POST admin/videos ma con
// uploaded_by = req.user.id (forzato, non leggibile dal body).
// ============================================================
router.post("/videos", async (req, res) => {
  try {
    const youtube_id = (req.body.youtube_id || "").trim().slice(0, 20);
    const title = (req.body.title || "").trim().slice(0, 255);
    const description = (req.body.description || "").trim().slice(0, 4000);
    let category_id = parseInt(req.body.category_id, 10) || null;
    const is_private = !!req.body.is_private;
    const tag_ids = safeTagIds(req.body.tag_ids);
    const new_tags = safeTagNames(req.body.new_tag_names);
    const new_cat = (req.body.new_category_name || "").toString().trim().slice(0, 80);

    if (!youtube_id || !title) {
      return res.status(400).json({ error: "youtube_id e title obbligatori" });
    }
    // Validazione veloce dell'ID YouTube (alfanumerico + _ + -, 11 char tipico)
    if (!/^[\w-]{6,20}$/.test(youtube_id)) {
      return res.status(400).json({ error: "youtube_id non valido" });
    }

    // Se l'utente ha digitato una nuova categoria, la creo (o riuso).
    if (!category_id && new_cat) {
      category_id = await resolveOrCreateCategoryId(new_cat);
    }

    // Se l'utente ha digitato nuovi nomi tag, li trasformo in id e li
    // unisco a quelli scelti dal dropdown (dedup).
    let allTagIds = tag_ids.slice();
    if (new_tags.length) {
      const created = await resolveOrCreateTagIds(new_tags);
      for (const id of created) if (!allTagIds.includes(id)) allTagIds.push(id);
    }

    const r = await pool.query(
      `INSERT INTO videos
               (youtube_id, title, description, thumbnail_url, uploaded_by, category_id, is_private)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
      [
        youtube_id,
        title,
        description || null,
        ytThumb(youtube_id),
        req.user.id,
        category_id,
        is_private,
      ]
    );

    if (allTagIds.length) {
      const vals = allTagIds.map((_, i) => `($1,$${i + 2})`).join(",");
      await pool.query(
        `INSERT INTO video_tags(video_id, tag_id) VALUES ${vals} ON CONFLICT DO NOTHING`,
        [r.rows[0].id, ...allTagIds]
      );
    }

    // Notifica all'admin: utile per moderazione di secondo livello.
    try {
      await pool.query(
        "INSERT INTO admin_notifications(type,title,message,related_id) VALUES($1,$2,$3,$4)",
        [
          "new_video",
          "Video da utente verificato",
          `${req.user.username} ha pubblicato "${title}"`,
          r.rows[0].id,
        ]
      );
    } catch {}

    // Push agli iscritti del creator (best effort, non blocca la response).
    if (!is_private) {
      try {
        const userRoutes = require("./userRoutes");
        if (typeof userRoutes.notifyFollowersNewVideo === "function") {
          userRoutes.notifyFollowersNewVideo(req.user.id, r.rows[0]).catch(() => {});
        }
      } catch (_) {}
    }

    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === "23505") {
      return res.status(409).json({ error: "Questo video YouTube è già in piattaforma" });
    }
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ============================================================
// PUT /api/creator/videos/:id
// Modifica un video proprio. Lo scope è verificato dal middleware.
// ============================================================
router.put("/videos/:id", requireVideoOwner(), async (req, res) => {
  try {
    const youtube_id = (req.body.youtube_id || "").trim().slice(0, 20);
    const title = (req.body.title || "").trim().slice(0, 255);
    const description = (req.body.description || "").trim().slice(0, 4000);
    let category_id = parseInt(req.body.category_id, 10) || null;
    const is_private = !!req.body.is_private;
    const tag_ids = safeTagIds(req.body.tag_ids);
    const new_tags = safeTagNames(req.body.new_tag_names);
    const new_cat = (req.body.new_category_name || "").toString().trim().slice(0, 80);

    if (!youtube_id || !title) {
      return res.status(400).json({ error: "youtube_id e title obbligatori" });
    }
    if (!/^[\w-]{6,20}$/.test(youtube_id)) {
      return res.status(400).json({ error: "youtube_id non valido" });
    }

    if (!category_id && new_cat) {
      category_id = await resolveOrCreateCategoryId(new_cat);
    }
    let allTagIds = tag_ids.slice();
    if (new_tags.length) {
      const created = await resolveOrCreateTagIds(new_tags);
      for (const id of created) if (!allTagIds.includes(id)) allTagIds.push(id);
    }

    const r = await pool.query(
      `UPDATE videos
                SET youtube_id    = $1,
                    title         = $2,
                    description   = $3,
                    thumbnail_url = $4,
                    category_id   = $5,
                    is_private    = $6
              WHERE id = $7
              RETURNING *`,
      [
        youtube_id,
        title,
        description || null,
        ytThumb(youtube_id),
        category_id,
        is_private,
        req.params.id,
      ]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Non trovato" });

    await pool.query("DELETE FROM video_tags WHERE video_id=$1", [req.params.id]);
    if (allTagIds.length) {
      const vals = allTagIds.map((_, i) => `($1,$${i + 2})`).join(",");
      await pool.query(
        `INSERT INTO video_tags(video_id, tag_id) VALUES ${vals} ON CONFLICT DO NOTHING`,
        [req.params.id, ...allTagIds]
      );
    }

    res.json(r.rows[0]);
  } catch (e) {
    if (e.code === "23505") {
      return res.status(409).json({ error: "Questo video YouTube è già in piattaforma" });
    }
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ============================================================
// DELETE /api/creator/videos/:id
// Cancella un proprio video. Cascade su comments/likes/views.
// ============================================================
router.delete("/videos/:id", requireVideoOwner(), async (req, res) => {
  try {
    const r = await pool.query("DELETE FROM videos WHERE id=$1 RETURNING id, title", [
      req.params.id,
    ]);
    if (!r.rows.length) return res.status(404).json({ error: "Non trovato" });
    res.json({ ok: true, id: r.rows[0].id, title: r.rows[0].title });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ============================================================
// GET /api/creator/videos/:id/comments
// Tutti i commenti (anche soft-deleted) sotto un proprio video,
// per la moderazione.
// ============================================================
router.get("/videos/:id/comments", requireVideoOwner(), async (req, res) => {
  try {
    // Con LEFT JOIN su comment_reports per contare le segnalazioni
    // aperte e raccogliere i motivi (per moderazione informata).
    const r = await pool.query(
      `SELECT c.id, c.content, c.created_at, c.deleted_at, c.parent_id,
                    u.id AS user_id, u.username, u.avatar_url, u.is_verified,
                    COALESCE(u.strike_count, 0) AS user_strike_count,
                    u.role AS user_role,
                    COALESCE((
                      SELECT COUNT(*)::int
                        FROM comment_reports cr
                       WHERE cr.comment_id = c.id AND cr.status = 'open'
                    ), 0) AS reports_count,
                    (
                      SELECT array_agg(DISTINCT cr.reason)
                        FROM comment_reports cr
                       WHERE cr.comment_id = c.id AND cr.status = 'open'
                    ) AS reports_reasons
               FROM comments c
               JOIN users u ON u.id = c.user_id
              WHERE c.video_id = $1
              ORDER BY
                CASE WHEN c.deleted_at IS NULL THEN 0 ELSE 1 END,
                COALESCE((
                  SELECT COUNT(*)::int
                    FROM comment_reports cr
                   WHERE cr.comment_id = c.id AND cr.status = 'open'
                ), 0) DESC,
                c.created_at DESC
              LIMIT 200`,
      [req.params.id]
    );
    res.json({ comments: r.rows });
  } catch (e) {
    // Se la tabella comment_reports non esiste ancora (migration non eseguita),
    // fallback sulla query originale senza counting dei report.
    if (e.code === "42P01") {
      try {
        const r2 = await pool.query(
          `SELECT c.id, c.content, c.created_at, c.deleted_at, c.parent_id,
                            u.id AS user_id, u.username, u.avatar_url, u.is_verified,
                            COALESCE(u.strike_count, 0) AS user_strike_count,
                            u.role AS user_role,
                            0 AS reports_count,
                            NULL AS reports_reasons
                       FROM comments c
                       JOIN users u ON u.id = c.user_id
                      WHERE c.video_id = $1
                      ORDER BY
                        CASE WHEN c.deleted_at IS NULL THEN 0 ELSE 1 END,
                        c.created_at DESC
                      LIMIT 200`,
          [req.params.id]
        );
        return res.json({ comments: r2.rows });
      } catch (e2) {
        console.error(e2);
        return res.status(500).json({ error: "Errore interno" });
      }
    }
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ============================================================
// DELETE /api/creator/videos/:id/comments/reported
// "Svuota coda di moderazione": soft-delete in blocco di TUTTI i
// commenti del proprio video che hanno almeno una segnalazione
// aperta. Marca le relative segnalazioni come risolte. È una
// operazione di pulizia: NON applica strike in blocco (gli strike
// restano legati alla moderazione puntuale del singolo commento).
// NB: questa rotta DEVE precedere quella con :cid altrimenti
// "reported" verrebbe interpretato come id commento.
// ============================================================
router.delete("/videos/:id/comments/reported", requireVideoOwner(), async (req, res) => {
  try {
    const vid = parseInt(req.params.id, 10);
    if (!vid) return res.status(400).json({ error: "ID video non valido" });

    // Raccolgo gli id dei commenti non ancora rimossi con report aperti
    let ids = [];
    try {
      const q = await pool.query(
        `SELECT DISTINCT c.id
                   FROM comments c
                   JOIN comment_reports cr ON cr.comment_id = c.id
                  WHERE c.video_id = $1
                    AND c.deleted_at IS NULL
                    AND cr.status = 'open'`,
        [vid]
      );
      ids = q.rows.map((r) => r.id);
    } catch (e) {
      // Tabella comment_reports assente (migration non eseguita)
      if (e.code === "42P01") return res.json({ ok: true, deleted: 0 });
      throw e;
    }

    if (!ids.length) return res.json({ ok: true, deleted: 0 });

    const del = await pool.query(
      `UPDATE comments
                SET deleted_at = NOW()
              WHERE id = ANY($1::int[]) AND video_id = $2 AND deleted_at IS NULL
              RETURNING id`,
      [ids, vid]
    );

    // Chiudo le segnalazioni collegate
    try {
      await pool.query(
        `UPDATE comment_reports
                    SET status = 'resolved', resolved_at = NOW()
                  WHERE comment_id = ANY($1::int[]) AND status = 'open'`,
        [ids]
      );
    } catch (_) {
      /* best effort */
    }

    res.json({ ok: true, deleted: del.rows.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ============================================================
// DELETE /api/creator/videos/:id/comments/:cid
// Soft-delete di un commento sotto il PROPRIO video. Imposta
// deleted_at = NOW(); il record resta per audit.
// ============================================================
router.delete("/videos/:id/comments/:cid", requireVideoOwner(), async (req, res) => {
  try {
    const cid = parseInt(req.params.cid, 10);
    if (!cid) return res.status(400).json({ error: "ID commento non valido" });

    // Soft-delete + autore del commento (per gestire lo strike)
    const r = await pool.query(
      `UPDATE comments
                SET deleted_at = NOW()
              WHERE id = $1 AND video_id = $2 AND deleted_at IS NULL
              RETURNING id, user_id`,
      [cid, req.params.id]
    );
    if (!r.rows.length) {
      return res.status(404).json({ error: "Commento non trovato o gia' rimosso" });
    }
    const authorId = r.rows[0].user_id;

    let banned = false;
    let strikeCount = 0;
    let wasReported = false;
    try {
      const rep = await pool.query(
        "SELECT COUNT(*)::int AS n FROM comment_reports WHERE comment_id = $1",
        [cid]
      );
      wasReported = rep.rows[0].n > 0;

      if (wasReported) {
        await pool.query(
          "UPDATE comment_reports SET status='resolved', resolved_at=NOW() WHERE comment_id=$1 AND status='open'",
          [cid]
        );

        // Strike all'autore del commento. Soglia: 3 -> auto-ban.
        if (authorId && authorId !== req.user.id) {
          const upd = await pool.query(
            `UPDATE users
                            SET strike_count = COALESCE(strike_count, 0) + 1
                          WHERE id = $1
                            AND role <> 'admin'
                          RETURNING strike_count, role`,
            [authorId]
          );
          if (upd.rows.length > 0) {
            strikeCount = upd.rows[0].strike_count;
            if (strikeCount >= 3 && upd.rows[0].role !== "banned") {
              await pool.query("UPDATE users SET role='banned' WHERE id=$1", [authorId]);
              banned = true;
              try {
                await pool.query(
                  `INSERT INTO notifications (user_id, type, payload, created_at)
                                     VALUES ($1, 'account_banned', $2, NOW())`,
                  [authorId, JSON.stringify({ reason: "comment_strikes", strikes: strikeCount })]
                );
              } catch (_) {
                /* silent */
              }
            }
          }
        }
      }
    } catch (strikeErr) {
      console.warn("[strike-system] non disponibile:", strikeErr.message);
    }

    res.json({ ok: true, id: cid, was_reported: wasReported, strike_count: strikeCount, banned });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ============================================================
// PUT /api/creator/videos/:id/comments/:cid/restore
// Annulla il soft-delete: utile se l'autore si e' pentito.
// ============================================================
router.put("/videos/:id/comments/:cid/restore", requireVideoOwner(), async (req, res) => {
  try {
    const cid = parseInt(req.params.cid, 10);
    const r = await pool.query(
      `UPDATE comments SET deleted_at = NULL
              WHERE id=$1 AND video_id=$2
              RETURNING id`,
      [cid, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Commento non trovato" });
    res.json({ ok: true, id: cid });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ============================================================
// DELETE /api/creator/videos/:id/comments/:cid/hard
// Eliminazione DEFINITIVA di un commento (e delle sue risposte
// dirette) sotto un proprio video. Non e' reversibile: la riga
// viene rimossa dal database, insieme alle sue segnalazioni.
// ============================================================
router.delete("/videos/:id/comments/:cid/hard", requireVideoOwner(), async (req, res) => {
  try {
    const cid = parseInt(req.params.cid, 10);
    const vid = parseInt(req.params.id, 10);
    if (!cid || !vid) return res.status(400).json({ error: "ID non valido" });

    // Rimuovo prima le segnalazioni collegate (commento + risposte)
    try {
      await pool.query(
        `DELETE FROM comment_reports
                  WHERE comment_id IN (
                    SELECT id FROM comments WHERE id = $1 OR parent_id = $1
                  )`,
        [cid]
      );
    } catch (_) {
      /* tabella assente: ignoro */
    }

    const del = await pool.query(
      "DELETE FROM comments WHERE (id = $1 OR parent_id = $1) AND video_id = $2 RETURNING id",
      [cid, vid]
    );
    if (!del.rows.length) {
      return res.status(404).json({ error: "Commento non trovato" });
    }
    res.json({ ok: true, deleted: del.rows.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ============================================================
// POST /api/creator/videos/:id/comments/:cid/escalate
// Il creator segnala all'amministrazione l'autore di un commento
// scorretto. Invia una notifica a tutti gli admin con commento,
// snippet, storico strike dell'utente ed eventuale nota.
// ============================================================
router.post("/videos/:id/comments/:cid/escalate", requireVideoOwner(), async (req, res) => {
  try {
    const cid = parseInt(req.params.cid, 10);
    if (!cid) return res.status(400).json({ error: "ID non valido" });
    const note = ((req.body && req.body.note) || "").toString().trim().slice(0, 500) || null;

    const c = await pool.query(
      `SELECT c.id, c.content, c.user_id, c.video_id,
                    u.username, u.role AS user_role,
                    COALESCE(u.strike_count, 0) AS strike_count,
                    v.title AS video_title
               FROM comments c
               JOIN users u ON u.id = c.user_id
               JOIN videos v ON v.id = c.video_id
              WHERE c.id = $1`,
      [cid]
    );
    if (!c.rows.length) return res.status(404).json({ error: "Commento non trovato" });
    const row = c.rows[0];
    if (row.user_role === "admin") {
      return res.status(400).json({ error: "Non puoi segnalare un amministratore" });
    }

    const admins = await pool.query("SELECT id FROM users WHERE role = 'admin'");
    const payload = JSON.stringify({
      reported_user_id: row.user_id,
      reported_username: row.username,
      comment_id: row.id,
      comment_snippet: (row.content || "").slice(0, 180),
      video_id: row.video_id,
      video_title: row.video_title,
      strike_count: row.strike_count,
      by_creator: req.user.username || "utente #" + req.user.id,
      note: note,
    });
    for (const a of admins.rows) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, payload, link, created_at)
                 VALUES ($1, 'user_escalated', $2, $3, NOW())`,
        [a.id, payload, "video.html?id=" + row.video_id]
      );
    }
    res.json({ ok: true, notified: admins.rows.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ============================================================
// POST /api/creator/tags
// Crea (o riusa) un tag dal nome. Normalizza a minuscolo + spazi
// singoli e de-duplica in modo case-insensitive: cosi' i creator
// possono aggiungere tag nuovi dal form di upload senza passare
// dall'admin, ma senza generare doppioni.
// ============================================================
router.post("/tags", async (req, res) => {
  try {
    const raw = ((req.body && req.body.name) || "").toString().trim().toLowerCase();
    const name = raw.replace(/\s+/g, " ").slice(0, 40);
    if (name.length < 2) {
      return res.status(400).json({ error: "Il tag deve avere almeno 2 caratteri" });
    }
    // Riuso se gia' presente (confronto case-insensitive)
    const found = await pool.query("SELECT id, name FROM tags WHERE LOWER(name) = $1 LIMIT 1", [
      name,
    ]);
    if (found.rows.length) {
      return res.json({ id: found.rows[0].id, name: found.rows[0].name, created: false });
    }
    try {
      const ins = await pool.query("INSERT INTO tags (name) VALUES ($1) RETURNING id, name", [
        name,
      ]);
      return res.status(201).json({ id: ins.rows[0].id, name: ins.rows[0].name, created: true });
    } catch (e) {
      // Race: creato in parallelo -> rileggo e riuso
      if (e.code === "23505") {
        const r2 = await pool.query("SELECT id, name FROM tags WHERE LOWER(name) = $1 LIMIT 1", [
          name,
        ]);
        if (r2.rows.length) {
          return res.json({ id: r2.rows[0].id, name: r2.rows[0].name, created: false });
        }
      }
      throw e;
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ============================================================
// POST /api/creator/categories
// Crea (o riusa) una categoria dal nome. Permette al creator di
// estendere il catalogo direttamente dal form di upload senza dover
// passare dall'admin. Le categorie sono UNIQUE: il riuso e' garantito.
// ============================================================
router.post("/categories", async (req, res) => {
  try {
    const name = ((req.body && req.body.name) || "").toString().trim().slice(0, 80);
    if (name.length < 2) {
      return res.status(400).json({ error: "La categoria deve avere almeno 2 caratteri" });
    }
    const id = await resolveOrCreateCategoryId(name);
    if (!id) return res.status(500).json({ error: "Impossibile creare la categoria" });
    res.status(201).json({ id, name });
  } catch (e) {
    console.error("[POST /categories]", e.code || "", e.message);
    res.status(500).json({ error: e.message || "Errore interno" });
  }
});


module.exports = router;
