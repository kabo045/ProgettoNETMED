 const express = require("express");
const bcrypt = require("bcrypt");
const pool = require("../db/db");
const authenticateToken = require("../middleware/authMiddleware");
const { createNotificationIfDifferent } = require("../db/notifications");
const router = express.Router();


router.get("/__version", (req, res) => {
  res.json({ ok: true, app: "netmed", api: "admin", version: "1.0.0" });
});

router.use(authenticateToken);
function isAdmin(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Solo admin" });
  next();
}
router.use(isAdmin);

// Registra un'azione admin nell'audit log. Non fa throw: se fallisce (tabella mancante)
// logga a console e continua, per non bloccare l'operazione principale.
async function logAudit(adminId, action, targetType, targetId, details) {
  try {
    await pool.query(
      "INSERT INTO admin_audit(admin_id, action, target_type, target_id, details) VALUES($1,$2,$3,$4,$5)",
      [adminId, action, targetType || null, targetId || null, details || null]
    );
  } catch (e) {
    console.error("Audit log error:", e.message);
  }
}

router.get("/stats", async (req, res) => {
  try {
    const [v, u, w, c] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS n FROM videos"),
      pool.query("SELECT COUNT(*)::int AS n FROM users"),
      pool.query("SELECT COUNT(*)::int AS n FROM views"),
      pool.query("SELECT COUNT(*)::int AS n FROM comments WHERE deleted_at IS NULL"),
    ]);
    const recent = await pool.query(
      `SELECT (SELECT COUNT(*)::int FROM videos WHERE created_at > NOW()-INTERVAL '7 days') AS new_videos,
              (SELECT COUNT(*)::int FROM users WHERE created_at > NOW()-INTERVAL '7 days') AS new_users,
              (SELECT COUNT(*)::int FROM views WHERE viewed_at > NOW()-INTERVAL '7 days') AS new_views,
              (SELECT COUNT(*)::int FROM comments WHERE created_at > NOW()-INTERVAL '7 days' AND deleted_at IS NULL) AS new_comments`
    );
    // Top videos by views this week
    const topVideos = await pool.query(
      `SELECT v.id, v.title, v.youtube_id, c.name AS category, COUNT(w.id)::int AS week_views
       FROM videos v LEFT JOIN categories c ON c.id=v.category_id
       LEFT JOIN views w ON w.video_id=v.id AND w.viewed_at > NOW()-INTERVAL '7 days'
       GROUP BY v.id, c.name ORDER BY week_views DESC LIMIT 5`
    );
    res.json({
      videoTotali: v.rows[0].n,
      utentiRegistrati: u.rows[0].n,
      visualizzazioni: w.rows[0].n,
      commenti: c.rows[0].n,
      recent: recent.rows[0],
      topVideos: topVideos.rows,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/analytics", async (req, res) => {
  try {
    const viewsDaily = await pool.query(
      `SELECT DATE(viewed_at) AS day, COUNT(*)::int AS views FROM views
       WHERE viewed_at > NOW()-INTERVAL '30 days' GROUP BY DATE(viewed_at) ORDER BY day`
    );
    const usersDaily = await pool.query(
      `SELECT DATE(created_at) AS day, COUNT(*)::int AS users FROM users
       WHERE created_at > NOW()-INTERVAL '30 days' GROUP BY DATE(created_at) ORDER BY day`
    );
    const catStats = await pool.query(
      `SELECT c.name, COUNT(v.id)::int AS videos, COALESCE(SUM(sub.vc),0)::int AS views
       FROM categories c LEFT JOIN videos v ON v.category_id=c.id
       LEFT JOIN (SELECT video_id, COUNT(*)::int AS vc FROM views GROUP BY video_id) sub ON sub.video_id=v.id
       GROUP BY c.name ORDER BY views DESC`
    );
    const tagStats = await pool.query(
      `SELECT t.name, COUNT(DISTINCT vt.video_id)::int AS videos
       FROM tags t LEFT JOIN video_tags vt ON vt.tag_id=t.id GROUP BY t.name ORDER BY videos DESC LIMIT 10`
    );
    res.json({
      viewsDaily: viewsDaily.rows,
      usersDaily: usersDaily.rows,
      catStats: catStats.rows,
      tagStats: tagStats.rows,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/search", async (req, res) => {
  try {
    const q = req.query.q || "";
    if (!q.trim()) return res.json({ videos: [], users: [], comments: [] });
    const s = `%${q}%`;
    const [videos, users, comments] = await Promise.all([
      pool.query(
        `SELECT v.id, v.title, v.youtube_id, v.thumbnail_url, c.name AS category
                  FROM videos v LEFT JOIN categories c ON c.id=v.category_id
                  WHERE v.title ILIKE $1 OR v.description ILIKE $1 OR v.youtube_id ILIKE $1 LIMIT 5`,
        [s]
      ),
      pool.query(
        `SELECT id, username, email, role FROM users WHERE username ILIKE $1 OR email ILIKE $1 LIMIT 5`,
        [s]
      ),
      pool.query(
        `SELECT c.id, c.content, u.username, v.title AS video_title
                  FROM comments c LEFT JOIN users u ON u.id=c.user_id LEFT JOIN videos v ON v.id=c.video_id
                  WHERE c.content ILIKE $1 AND c.deleted_at IS NULL LIMIT 5`,
        [s]
      ),
    ]);
    res.json({ videos: videos.rows, users: users.rows, comments: comments.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/notifications", async (req, res) => {
  try {
    // Check if table exists, if not return empty
    try {
      await pool.query("SELECT 1 FROM admin_notifications LIMIT 1");
    } catch {
      return res.json([]);
    }
    const r = await pool.query(
      "SELECT * FROM admin_notifications ORDER BY created_at DESC LIMIT 20"
    );
    res.json(r.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.put("/notifications/read-all", async (req, res) => {
  try {
    try {
      await pool.query("UPDATE admin_notifications SET is_read=TRUE WHERE is_read=FALSE");
    } catch {}
    res.json({ message: "ok" });
  } catch (e) {
    res.status(500).json({ error: "Errore interno" });
  }
});

router.delete("/notifications/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM admin_notifications WHERE id=$1", [req.params.id]);
    res.json({ message: "Eliminata" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.delete("/notifications", async (req, res) => {
  try {
    await pool.query("DELETE FROM admin_notifications");
    res.json({ message: "Tutte eliminate" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/me", async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT id, username, email, role, avatar_url, created_at FROM users WHERE id=$1",
      [req.user.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Non trovato" });
    res.json(r.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.put("/me", async (req, res) => {
  try {
    const { username, email, old_password, new_password, avatar_url } = req.body;
    if (!username || !email) return res.status(400).json({ error: "Username e email obbligatori" });
    if (new_password) {
      if (!old_password) return res.status(400).json({ error: "Inserisci la password attuale" });
      const user = await pool.query("SELECT password_hash FROM users WHERE id=$1", [req.user.id]);
      if (!(await bcrypt.compare(old_password, user.rows[0].password_hash)))
        return res.status(400).json({ error: "Password attuale errata" });
      await pool.query(
        "UPDATE users SET username=$1,email=$2,password_hash=$3,avatar_url=$4,updated_at=NOW() WHERE id=$5",
        [username, email, await bcrypt.hash(new_password, 10), avatar_url || null, req.user.id]
      );
    } else {
      await pool.query(
        "UPDATE users SET username=$1,email=$2,avatar_url=$3,updated_at=NOW() WHERE id=$4",
        [username, email, avatar_url || null, req.user.id]
      );
    }
    res.json({ message: "Profilo aggiornato", username, email, avatar_url });
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "Username o email già in uso" });
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/categories", async (req, res) => {
  try {
    res.json(
      (
        await pool.query(
          "SELECT c.id,c.name,c.created_at,COUNT(v.id)::int AS video_count FROM categories c LEFT JOIN videos v ON v.category_id=c.id GROUP BY c.id ORDER BY c.name"
        )
      ).rows
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});
router.post("/categories", async (req, res) => {
  try {
    const name = ((req.body && req.body.name) || "").trim();
    if (!name) return res.status(400).json({ error: "Nome obbligatorio" });
    if (name.length < 2)
      return res.status(400).json({ error: "Nome troppo corto (min 2 caratteri)" });
    if (name.length > 60)
      return res.status(400).json({ error: "Nome troppo lungo (max 60 caratteri)" });
    // duplicato case-insensitive
    const dup = await pool.query(
      "SELECT id, name FROM categories WHERE LOWER(name) = LOWER($1) LIMIT 1",
      [name]
    );
    if (dup.rows.length)
      return res.status(409).json({ error: `Categoria "${dup.rows[0].name}" gia' esistente` });
    const r = await pool.query("INSERT INTO categories(name) VALUES($1) RETURNING *", [name]);
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "Categoria gia' esistente" });
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});
router.put("/categories/:id", async (req, res) => {
  try {
    const name = ((req.body && req.body.name) || "").trim();
    if (!name) return res.status(400).json({ error: "Nome obbligatorio" });
    if (name.length < 2)
      return res.status(400).json({ error: "Nome troppo corto (min 2 caratteri)" });
    if (name.length > 60)
      return res.status(400).json({ error: "Nome troppo lungo (max 60 caratteri)" });
    const dup = await pool.query(
      "SELECT id, name FROM categories WHERE LOWER(name) = LOWER($1) AND id <> $2 LIMIT 1",
      [name, req.params.id]
    );
    if (dup.rows.length)
      return res.status(409).json({ error: `Categoria "${dup.rows[0].name}" gia' esistente` });
    const r = await pool.query("UPDATE categories SET name=$1 WHERE id=$2 RETURNING *", [
      name,
      req.params.id,
    ]);
    if (!r.rows.length) return res.status(404).json({ error: "Categoria non trovata" });
    res.json(r.rows[0]);
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "Categoria gia' esistente" });
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});
router.delete("/categories/:id", async (req, res) => {
  try {
    const r = await pool.query("DELETE FROM categories WHERE id=$1 RETURNING id", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: "Non trovata" });
    res.json({ message: "Eliminata" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/tags", async (req, res) => {
  try {
    res.json(
      (
        await pool.query(
          "SELECT t.id,t.name,t.created_at,COUNT(vt.video_id)::int AS video_count FROM tags t LEFT JOIN video_tags vt ON vt.tag_id=t.id GROUP BY t.id ORDER BY t.name"
        )
      ).rows
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});
router.post("/tags", async (req, res) => {
  try {
    const name = ((req.body && req.body.name) || "").trim().toLowerCase();
    if (!name) return res.status(400).json({ error: "Nome obbligatorio" });
    if (name.length < 2)
      return res.status(400).json({ error: "Tag troppo corto (min 2 caratteri)" });
    if (name.length > 40)
      return res.status(400).json({ error: "Tag troppo lungo (max 40 caratteri)" });
    if (!/^[a-z0-9 _\-]+$/.test(name)) {
      return res.status(400).json({ error: "Tag: solo lettere/numeri/spazio/_/-" });
    }
    const dup = await pool.query("SELECT id, name FROM tags WHERE name = $1 LIMIT 1", [name]);
    if (dup.rows.length)
      return res.status(409).json({ error: `Tag "${dup.rows[0].name}" gia' esistente` });
    const r = await pool.query("INSERT INTO tags(name) VALUES($1) RETURNING *", [name]);
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "Tag gia' esistente" });
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});
router.put("/tags/:id", async (req, res) => {
  try {
    const name = ((req.body && req.body.name) || "").trim().toLowerCase();
    if (!name) return res.status(400).json({ error: "Nome obbligatorio" });
    if (name.length < 2)
      return res.status(400).json({ error: "Tag troppo corto (min 2 caratteri)" });
    if (name.length > 40)
      return res.status(400).json({ error: "Tag troppo lungo (max 40 caratteri)" });
    if (!/^[a-z0-9 _\-]+$/.test(name)) {
      return res.status(400).json({ error: "Tag: solo lettere/numeri/spazio/_/-" });
    }
    const dup = await pool.query("SELECT id, name FROM tags WHERE name = $1 AND id <> $2 LIMIT 1", [
      name,
      req.params.id,
    ]);
    if (dup.rows.length)
      return res.status(409).json({ error: `Tag "${dup.rows[0].name}" gia' esistente` });
    const r = await pool.query("UPDATE tags SET name=$1 WHERE id=$2 RETURNING *", [
      name,
      req.params.id,
    ]);
    if (!r.rows.length) return res.status(404).json({ error: "Tag non trovato" });
    res.json(r.rows[0]);
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "Tag gia' esistente" });
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});
router.delete("/tags/:id", async (req, res) => {
  try {
    const r = await pool.query("DELETE FROM tags WHERE id=$1 RETURNING id", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: "Non trovato" });
    res.json({ message: "Eliminato" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/videos/tags/all", async (req, res) => {
  try {
    res.json((await pool.query("SELECT id,name FROM tags ORDER BY name")).rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});
router.get("/videos/recent", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 5, 20);
    res.json(
      (
        await pool.query(
          `SELECT v.id,v.youtube_id,v.title,v.thumbnail_url,v.created_at,c.name AS category,(SELECT COUNT(*)::int FROM views WHERE video_id=v.id) AS view_count FROM videos v LEFT JOIN categories c ON c.id=v.category_id ORDER BY v.created_at DESC LIMIT $1`,
          [limit]
        )
      ).rows
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/videos", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1),
      limit = Math.min(parseInt(req.query.limit) || 10, 50),
      offset = (page - 1) * limit;
    const search = req.query.search || "",
      catId = req.query.category || null,
      tag = req.query.tag || null;
    let where = "WHERE 1=1",
      params = [],
      pi = 1;
    if (search) {
      where += ` AND (v.title ILIKE $${pi} OR v.description ILIKE $${pi} OR v.youtube_id ILIKE $${pi})`;
      params.push(`%${search}%`);
      pi++;
    }
    if (catId) {
      where += ` AND v.category_id=$${pi}`;
      params.push(parseInt(catId));
      pi++;
    }
    if (tag) {
      where += ` AND EXISTS (SELECT 1 FROM video_tags vt JOIN tags t ON t.id=vt.tag_id WHERE vt.video_id=v.id AND t.name ILIKE $${pi})`;
      params.push(`%${tag}%`);
      pi++;
    }
    const total = (await pool.query(`SELECT COUNT(*)::int AS n FROM videos v ${where}`, params))
      .rows[0].n;
    const r = await pool.query(
      `SELECT v.id,v.youtube_id,v.title,v.description,v.thumbnail_url,v.is_private,v.created_at,
              c.id AS category_id,c.name AS category_name,
              (SELECT COUNT(*)::int FROM views WHERE video_id=v.id) AS view_count,
              (SELECT COUNT(*)::int FROM likes WHERE video_id=v.id) AS like_count,
              (SELECT COUNT(*)::int FROM comments WHERE video_id=v.id AND deleted_at IS NULL) AS comment_count,
              COALESCE((SELECT json_agg(json_build_object('id',t.id,'name',t.name)) FROM video_tags vt JOIN tags t ON t.id=vt.tag_id WHERE vt.video_id=v.id),'[]') AS tags
       FROM videos v LEFT JOIN categories c ON c.id=v.category_id ${where} ORDER BY v.created_at DESC LIMIT $${pi} OFFSET $${pi + 1}`,
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

router.get("/videos/:id", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT v.*, c.name AS category_name,
              (SELECT COUNT(*)::int FROM views WHERE video_id=v.id) AS view_count,
              (SELECT COUNT(*)::int FROM likes WHERE video_id=v.id) AS like_count,
              (SELECT COUNT(*)::int FROM comments WHERE video_id=v.id AND deleted_at IS NULL) AS comment_count,
              COALESCE((SELECT json_agg(json_build_object('id',t.id,'name',t.name)) FROM video_tags vt JOIN tags t ON t.id=vt.tag_id WHERE vt.video_id=v.id),'[]') AS tags
       FROM videos v LEFT JOIN categories c ON c.id=v.category_id WHERE v.id=$1`,
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Non trovato" });
    const viewsDaily = await pool.query(
      `SELECT DATE(viewed_at) AS day, COUNT(*)::int AS views FROM views WHERE video_id=$1 AND viewed_at > NOW()-INTERVAL '30 days' GROUP BY DATE(viewed_at) ORDER BY day`,
      [req.params.id]
    );
    const comments = await pool.query(
      `SELECT c.id,c.content,c.created_at,c.deleted_at,u.id AS user_id,u.username FROM comments c LEFT JOIN users u ON u.id=c.user_id WHERE c.video_id=$1 ORDER BY c.created_at DESC LIMIT 20`,
      [req.params.id]
    );
    const viewers = await pool.query(
      `SELECT DISTINCT ON (u.id) u.id,u.username,w.viewed_at FROM views w JOIN users u ON u.id=w.user_id WHERE w.video_id=$1 AND w.user_id IS NOT NULL ORDER BY u.id,w.viewed_at DESC LIMIT 10`,
      [req.params.id]
    );
    res.json({
      ...r.rows[0],
      views_daily: viewsDaily.rows,
      recent_comments: comments.rows,
      recent_viewers: viewers.rows,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.post("/videos", async (req, res) => {
  try {
    const { youtube_id, title, description, category_id, is_private, tag_ids } = req.body;
    if (!youtube_id || !title)
      return res.status(400).json({ error: "youtube_id e title obbligatori" });
    const thumb = `https://img.youtube.com/vi/${youtube_id}/mqdefault.jpg`;
    const r = await pool.query(
      "INSERT INTO videos(youtube_id,title,description,thumbnail_url,uploaded_by,category_id,is_private) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
      [
        youtube_id,
        title,
        description || null,
        thumb,
        req.user.id,
        category_id || null,
        is_private || false,
      ]
    );
    if (tag_ids?.length) {
      const vals = tag_ids.map((_, i) => `($1,$${i + 2})`).join(",");
      await pool.query(
        `INSERT INTO video_tags(video_id,tag_id) VALUES ${vals} ON CONFLICT DO NOTHING`,
        [r.rows[0].id, ...tag_ids]
      );
    }
    // Crea notifica
    try {
      await pool.query(
        "INSERT INTO admin_notifications(type,title,message,related_id) VALUES($1,$2,$3,$4)",
        [
          "new_video",
          "Nuovo video aggiunto",
          `"${title}" è stato aggiunto alla piattaforma`,
          r.rows[0].id,
        ]
      );
    } catch {}
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "YouTube ID già esistente" });
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.put("/videos/:id", async (req, res) => {
  try {
    const { youtube_id, title, description, category_id, is_private, tag_ids } = req.body;
    if (!youtube_id || !title)
      return res.status(400).json({ error: "youtube_id e title obbligatori" });
    const thumb = `https://img.youtube.com/vi/${youtube_id}/mqdefault.jpg`;
    const r = await pool.query(
      "UPDATE videos SET youtube_id=$1,title=$2,description=$3,thumbnail_url=$4,category_id=$5,is_private=$6 WHERE id=$7 RETURNING *",
      [
        youtube_id,
        title,
        description || null,
        thumb,
        category_id || null,
        is_private || false,
        req.params.id,
      ]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Non trovato" });
    await pool.query("DELETE FROM video_tags WHERE video_id=$1", [req.params.id]);
    if (tag_ids?.length) {
      const vals = tag_ids.map((_, i) => `($1,$${i + 2})`).join(",");
      await pool.query(
        `INSERT INTO video_tags(video_id,tag_id) VALUES ${vals} ON CONFLICT DO NOTHING`,
        [req.params.id, ...tag_ids]
      );
    }
    res.json(r.rows[0]);
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "YouTube ID già esistente" });
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.delete("/videos/:id", async (req, res) => {
  try {
    const videoId = parseInt(req.params.id, 10);
    if (!videoId) return res.status(400).json({ error: "ID non valido" });

    // PRE-fetch dei reporter PRIMA del DELETE: la cascade FK
    // (reports.video_id ON DELETE CASCADE) cancella i record subito,
    // quindi se non li leggiamo ora li perdiamo per sempre.
    const reportersR = await pool.query(
      `SELECT DISTINCT user_id
         FROM reports
        WHERE video_id = $1 AND user_id IS NOT NULL`,
      [videoId]
    );
    const reporterIds = reportersR.rows.map((r) => r.user_id);

    // Cascade FK rimuove: views, video_tags, favorites, likes,
    // comments, reports. I notifications restano (storico).
    const r = await pool.query("DELETE FROM videos WHERE id=$1 RETURNING id, title, uploaded_by", [
      videoId,
    ]);
    if (!r.rows.length) return res.status(404).json({ error: "Non trovato" });
    const v = r.rows[0];

    // Notifica creator: il suo video è stato eliminato d'autorità.
    // Niente link al video (non esiste più): rimando a 'I miei video'.
    try {
      await createNotificationIfDifferent(
        req.user.id,
        v.uploaded_by,
        "video_deleted_admin",
        {
          actor_id: req.user.id,
          actor_name: req.user.username,
          video_id: v.id,
          video_title: v.title,
        },
        "creator.html"
      );
    } catch (_) {
      /* best effort */
    }

    // Notifica ai reporter: la loro segnalazione ha portato alla
    // rimozione del video. Skip self (improbabile ma possibile).
    for (const rid of reporterIds) {
      try {
        await createNotificationIfDifferent(
          req.user.id,
          rid,
          "report_resolved",
          {
            action: "deleted",
            video_id: v.id,
            video_title: v.title,
          },
          null // niente link: il video non esiste più
        );
      } catch (_) {
        /* best effort */
      }
    }

    await logAudit(req.user.id, "video_delete", "video", v.id, v.title);
    res.json({ message: "Eliminato", notified_reporters: reporterIds.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/users/recent", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 4, 20);
    res.json(
      (
        await pool.query(
          "SELECT id,username,email,role,avatar_url,created_at FROM users ORDER BY created_at DESC LIMIT $1",
          [limit]
        )
      ).rows
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/users", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1),
      limit = Math.min(parseInt(req.query.limit) || 10, 50),
      offset = (page - 1) * limit;
    const search = req.query.search || "",
      role = req.query.role || "";
    let where = "WHERE 1=1",
      params = [],
      pi = 1;
    if (search) {
      where += ` AND (u.username ILIKE $${pi} OR u.email ILIKE $${pi})`;
      params.push(`%${search}%`);
      pi++;
    }
    if (role) {
      where += ` AND u.role=$${pi}`;
      params.push(role);
      pi++;
    }
    const total = (await pool.query(`SELECT COUNT(*)::int AS n FROM users u ${where}`, params))
      .rows[0].n;
    const r = await pool.query(
      `SELECT u.id,u.username,u.email,u.role,u.avatar_url,u.created_at,
              u.is_verified, u.verified_profile, u.verified_at,
              (SELECT COUNT(*)::int FROM comments WHERE user_id=u.id AND deleted_at IS NULL) AS comment_count,
              (SELECT COUNT(*)::int FROM likes WHERE user_id=u.id) AS like_count,
              (SELECT COUNT(*)::int FROM views WHERE user_id=u.id) AS view_count,
              (SELECT COUNT(*)::int FROM videos WHERE uploaded_by=u.id) AS upload_count
       FROM users u ${where} ORDER BY u.created_at DESC LIMIT $${pi} OFFSET $${pi + 1}`,
      [...params, limit, offset]
    );
    res.json({
      users: r.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/users/:id", async (req, res) => {
  try {
    const u = await pool.query(
      `SELECT u.id,u.username,u.email,u.role,u.avatar_url,u.created_at,
      u.is_verified, u.verified_profile, u.verified_at, u.verified_by,
      (SELECT username FROM users WHERE id = u.verified_by) AS verified_by_username,
      (SELECT COUNT(*)::int FROM comments WHERE user_id=u.id AND deleted_at IS NULL) AS comment_count,
      (SELECT COUNT(*)::int FROM likes WHERE user_id=u.id) AS like_count,
      (SELECT COUNT(*)::int FROM views WHERE user_id=u.id) AS view_count,
      (SELECT COUNT(*)::int FROM videos WHERE uploaded_by=u.id) AS upload_count
      FROM users u WHERE u.id=$1`,
      [req.params.id]
    );
    if (!u.rows.length) return res.status(404).json({ error: "Non trovato" });
    const comments = await pool.query(
      `SELECT c.id,c.content,c.created_at,c.deleted_at,v.title AS video_title FROM comments c LEFT JOIN videos v ON v.id=c.video_id WHERE c.user_id=$1 ORDER BY c.created_at DESC LIMIT 20`,
      [req.params.id]
    );
    const liked = await pool.query(
      `SELECT v.id,v.title,l.created_at FROM likes l JOIN videos v ON v.id=l.video_id WHERE l.user_id=$1 ORDER BY l.created_at DESC LIMIT 10`,
      [req.params.id]
    );
    res.json({ ...u.rows[0], recent_comments: comments.rows, liked_videos: liked.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

// GET /api/admin/users/:id/history
// Cronologia visualizzazioni di un utente.
// Restituisce l'elenco dei video visti con thumbnail, categoria
// e timestamp dell'ultima visualizzazione (paginato).
router.get("/users/:id/history", async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!userId) return res.status(400).json({ error: "ID non valido" });
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 25, 100);
    const offset = (page - 1) * limit;

    // Conto totale di video distinti visti dall'utente
    const totalR = await pool.query(
      `SELECT COUNT(DISTINCT video_id)::int AS n FROM views WHERE user_id=$1`,
      [userId]
    );
    const total = totalR.rows[0].n;

    // Per ogni video visto: thumbnail, categoria, ultima vista, conteggio
    const r = await pool.query(
      `SELECT v.id, v.youtube_id, v.title, v.thumbnail_url,
              c.id AS category_id, c.name AS category_name,
              MAX(w.viewed_at) AS last_viewed_at,
              COUNT(*)::int AS view_times
         FROM views w
         JOIN videos v ON v.id = w.video_id
         LEFT JOIN categories c ON c.id = v.category_id
        WHERE w.user_id = $1
        GROUP BY v.id, c.id, c.name
        ORDER BY MAX(w.viewed_at) DESC
        LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json({
      history: r.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

// DELETE /api/admin/users/:id/history
// Pulisce la cronologia di visualizzazione di un singolo utente.
// Utile per richieste GDPR o pulizie di test.
router.delete("/users/:id/history", async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!userId) return res.status(400).json({ error: "ID non valido" });
    const r = await pool.query("DELETE FROM views WHERE user_id=$1 RETURNING video_id", [userId]);
    await logAudit(
      req.user.id,
      "user_history_clear",
      "user",
      userId,
      `${r.rowCount} viste eliminate`
    );
    res.json({ ok: true, deleted: r.rowCount });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

// PUT /api/admin/users/:id/verify
// Promuove un utente a "verificato". Non richiede dati professionali:
// l'utente li compilerà autonomamente dalla propria pagina profilo
// tramite PUT /api/user/me/verified-profile. L'admin si limita ad
// abilitare il flag (e a revocarlo se necessario).
router.put("/users/:id/verify", async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!userId) return res.status(400).json({ error: "ID non valido" });
    if (userId === req.user.id) {
      return res.status(400).json({ error: "Non puoi verificare te stesso" });
    }

    const r = await pool.query(
      `UPDATE users
          SET is_verified         = TRUE,
              verified_request    = FALSE,
              verified_by         = $1,
              verified_at         = NOW(),
              updated_at          = NOW()
        WHERE id = $2 AND role <> 'banned' AND is_verified = FALSE
        RETURNING id, username, email, role, is_verified, verified_profile, verified_at`,
      [req.user.id, userId]
    );
    if (!r.rows.length) {
      // Distinguiamo i casi tramite SELECT (utile in audit / messaggio)
      const chk = await pool.query(`SELECT id, role, is_verified FROM users WHERE id = $1`, [
        userId,
      ]);
      if (!chk.rows.length) return res.status(404).json({ error: "Utente non trovato" });
      if (chk.rows[0].role === "banned") return res.status(400).json({ error: "Utente bannato" });
      if (chk.rows[0].is_verified) return res.status(400).json({ error: "Utente già verificato" });
      return res.status(400).json({ error: "Verifica non applicabile" });
    }

    // Se in passato l'utente era stato revocato, i suoi video erano
    // stati resi privati (vedi DELETE /users/:id/verify piu' sotto).
    // Ora che riottiene la verifica, li rendiamo di nuovo pubblici in
    // automatico: era proprio questo il senso del "sblocco" — evitare
    // che l'admin debba ricordarsi di riabilitarli uno per uno.
    await pool.query(
      "UPDATE videos SET is_private = FALSE WHERE uploaded_by = $1 AND is_private = TRUE",
      [userId]
    );

    await logAudit(req.user.id, "user_verify", "user", userId, r.rows[0].username);

    // Notifica all'utente verificato (best effort)
    createNotificationIfDifferent(
      req.user.id,
      userId,
      "verified_granted",
      {
        actor_id: req.user.id,
        actor_name: req.user.username,
      },
      "profilo.html"
    );

    res.json(r.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

// DELETE /api/admin/users/:id/verify
// Revoca la verifica. NON cancella i video già caricati dall'utente
// (mantenuti per accountability), solo il flag is_verified e i
// metadati del profilo.
router.delete("/users/:id/verify", async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!userId) return res.status(400).json({ error: "ID non valido" });

    const r = await pool.query(
      `UPDATE users
          SET is_verified = FALSE,
              verified_profile = NULL,
              verified_by = NULL,
              verified_at = NULL,
              updated_at = NOW()
        WHERE id = $1 AND is_verified = TRUE
        RETURNING id, username`,
      [userId]
    );
    if (!r.rows.length) {
      return res.status(404).json({ error: "Utente non verificato o inesistente" });
    }

    // I video caricati dall'utente non vengono cancellati (perderemmo
    // commenti, view, like) ma vengono resi PRIVATI: spariscono dalle
    // liste pubbliche e dalla home. Se l'admin riapprova in futuro,
    // bastera' rimettere is_private=false dalla gestione video.
    const vidUpd = await pool.query(
      "UPDATE videos SET is_private = TRUE WHERE uploaded_by = $1 AND is_private = FALSE",
      [userId]
    );

    await logAudit(req.user.id, "user_unverify", "user", userId, r.rows[0].username);

    // Notifica all'utente revocato
    createNotificationIfDifferent(
      req.user.id,
      userId,
      "verified_revoked",
      {
        actor_id: req.user.id,
        actor_name: req.user.username,
        videos_hidden: vidUpd.rowCount,
      },
      "profilo.html"
    );

    res.json({
      ok: true,
      id: userId,
      username: r.rows[0].username,
      videos_hidden: vidUpd.rowCount,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.put("/users/:id/role", async (req, res) => {
  try {
    const { role } = req.body;
    if (!["user", "admin", "banned"].includes(role))
      return res.status(400).json({ error: "Ruolo non valido" });
    if (parseInt(req.params.id) === req.user.id)
      return res.status(400).json({ error: "Non puoi modificare il tuo ruolo" });
    const r = await pool.query(
      "UPDATE users SET role=$1,updated_at=NOW() WHERE id=$2 RETURNING id,username,email,role",
      [role, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Non trovato" });
    if (role === "banned") {
      try {
        await pool.query(
          "INSERT INTO admin_notifications(type,title,message,related_id) VALUES($1,$2,$3,$4)",
          ["ban", "Utente bannato", `${r.rows[0].username} è stato bannato`, r.rows[0].id]
        );
      } catch {}
    }
    await logAudit(
      req.user.id,
      role === "banned" ? "user_ban" : "user_role_change",
      "user",
      r.rows[0].id,
      `${r.rows[0].username} → ${role}`
    );
    res.json(r.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id)
      return res.status(400).json({ error: "Non puoi eliminare te stesso" });
    const r = await pool.query("DELETE FROM users WHERE id=$1 RETURNING id, username", [
      req.params.id,
    ]);
    if (!r.rows.length) return res.status(404).json({ error: "Non trovato" });
    await logAudit(req.user.id, "user_delete", "user", r.rows[0].id, r.rows[0].username);
    res.json({ message: "Eliminato" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/comments", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1),
      limit = Math.min(parseInt(req.query.limit) || 15, 50),
      offset = (page - 1) * limit;
    const search = req.query.search || "",
      showDel = req.query.show_deleted === "true",
      videoId = req.query.video_id || null;
    // type: "" (tutti) | "parent" (solo top-level) | "reply" (solo risposte)
    const ctype = req.query.type === "parent" || req.query.type === "reply" ? req.query.type : "";
    let where = showDel ? "WHERE 1=1" : "WHERE c.deleted_at IS NULL",
      params = [],
      pi = 1;
    if (search) {
      where += ` AND (c.content ILIKE $${pi} OR u.username ILIKE $${pi})`;
      params.push(`%${search}%`);
      pi++;
    }
    if (videoId) {
      where += ` AND c.video_id=$${pi}`;
      params.push(parseInt(videoId));
      pi++;
    }
    if (ctype === "parent") {
      where += " AND c.parent_id IS NULL";
    } else if (ctype === "reply") {
      where += " AND c.parent_id IS NOT NULL";
    }
    const total = (
      await pool.query(
        `SELECT COUNT(*)::int AS n FROM comments c LEFT JOIN users u ON u.id=c.user_id ${where}`,
        params
      )
    ).rows[0].n;
    const r = await pool.query(
      `SELECT c.id,c.content,c.created_at,c.deleted_at,c.parent_id,u.id AS user_id,u.username,u.email,u.role AS user_role,v.id AS video_id,v.title AS video_title
       FROM comments c LEFT JOIN users u ON u.id=c.user_id LEFT JOIN videos v ON v.id=c.video_id ${where} ORDER BY c.created_at DESC LIMIT $${pi} OFFSET $${pi + 1}`,
      [...params, limit, offset]
    );
    res.json({
      comments: r.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

// Lista compatta di video con almeno un commento (per il filtro a tendina)
router.get("/comments/videos-list", async (req, res) => {
  try {
    const showDel = req.query.show_deleted === "true";
    const cWhere = showDel ? "" : "WHERE c.deleted_at IS NULL";
    const r = await pool.query(
      `SELECT v.id, v.title, COUNT(c.id)::int AS comment_count
       FROM videos v JOIN comments c ON c.video_id = v.id
       ${cWhere}
       GROUP BY v.id, v.title
       ORDER BY comment_count DESC, v.title ASC
       LIMIT 500`
    );
    res.json({ videos: r.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

// Svuota cestino: elimina definitivamente tutti i commenti soft-deleted
router.delete("/comments/purge", async (req, res) => {
  try {
    const r = await pool.query("DELETE FROM comments WHERE deleted_at IS NOT NULL RETURNING id");
    await logAudit(
      req.user.id,
      "comments_purge",
      "comment",
      null,
      `Eliminati definitivamente ${r.rowCount} commenti`
    );
    res.json({ message: "Cestino svuotato", deleted: r.rowCount });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});
router.delete("/comments/:id", async (req, res) => {
  try {
    const r = await pool.query(
      "UPDATE comments SET deleted_at=NOW() WHERE id=$1 AND deleted_at IS NULL RETURNING id",
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Non trovato" });
    res.json({ message: "Eliminato" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});
router.put("/comments/:id/restore", async (req, res) => {
  try {
    const r = await pool.query(
      "UPDATE comments SET deleted_at=NULL WHERE id=$1 AND deleted_at IS NOT NULL RETURNING id",
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Non trovato" });
    res.json({ message: "Ripristinato" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

const REPORT_REASONS = {
  inappropriate: "Contenuto inappropriato",
  misinformation: "Informazioni mediche errate",
  copyright: "Violazione copyright",
  spam: "Spam o contenuto promozionale",
  other: "Altro",
};
const FLAG_THRESHOLD = 3; // Dopo 3 segnalazioni il video viene flaggato

// Lista segnalazioni (con filtri)
router.get("/reports", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 8, 50);
    const offset = (page - 1) * limit;
    const status = req.query.status || "";
    const videoId = req.query.video_id || "";
    const search = req.query.search || "";
    const reason = req.query.reason || "";

    let where = "WHERE 1=1",
      params = [],
      pi = 1;
    if (status) {
      where += ` AND r.status=$${pi}`;
      params.push(status);
      pi++;
    }
    if (reason && REPORT_REASONS[reason]) {
      where += ` AND r.reason=$${pi}`;
      params.push(reason);
      pi++;
    }
    if (videoId) {
      where += ` AND r.video_id=$${pi}`;
      params.push(parseInt(videoId));
      pi++;
    }
    if (search) {
      where += ` AND (v.title ILIKE $${pi} OR v.youtube_id ILIKE $${pi} OR u.username ILIKE $${pi} OR u.email ILIKE $${pi} OR r.comment ILIKE $${pi})`;
      params.push(`%${search}%`);
      pi++;
    }

    const total = (
      await pool.query(
        `SELECT COUNT(*)::int AS n FROM reports r LEFT JOIN videos v ON v.id=r.video_id LEFT JOIN users u ON u.id=r.user_id ${where}`,
        params
      )
    ).rows[0].n;

    const r = await pool.query(
      `SELECT r.id, r.reason, r.comment, r.status, r.created_at, r.reviewed_at,
              r.video_id, v.title AS video_title, v.youtube_id, v.is_flagged,
              r.user_id, u.username AS reporter_username, u.email AS reporter_email
       FROM reports r
       LEFT JOIN videos v ON v.id = r.video_id
       LEFT JOIN users u ON u.id = r.user_id
       ${where} ORDER BY r.created_at DESC LIMIT $${pi} OFFSET $${pi + 1}`,
      [...params, limit, offset]
    );

    res.json({
      reports: r.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      reasons: REPORT_REASONS,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

// Elimina tutte le segnalazioni gia' lavorate (approvate o rifiutate)
router.delete("/reports/reviewed", async (req, res) => {
  try {
    const r = await pool.query(
      "DELETE FROM reports WHERE status IN ('approved','rejected') RETURNING id"
    );
    await logAudit(
      req.user.id,
      "reports_clear",
      "report",
      null,
      `Eliminate ${r.rowCount} segnalazioni lavorate`
    );
    res.json({ message: "Segnalazioni lavorate eliminate", deleted: r.rowCount });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

// Lista compatta dei video segnalati (per il filtro a tendina)
router.get("/reports/videos-list", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT v.id, v.title, COUNT(rp.id)::int AS report_count
       FROM videos v JOIN reports rp ON rp.video_id = v.id
       GROUP BY v.id, v.title
       ORDER BY report_count DESC, v.title ASC
       LIMIT 500`
    );
    res.json({ videos: r.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

// Stats segnalazioni per la dashboard
router.get("/reports/stats", async (req, res) => {
  try {
    const stats = await pool.query(
      `SELECT 
        (SELECT COUNT(*)::int FROM reports WHERE status='pending') AS pending,
        (SELECT COUNT(*)::int FROM reports WHERE status='approved') AS approved,
        (SELECT COUNT(*)::int FROM reports WHERE status='rejected') AS rejected,
        (SELECT COUNT(*)::int FROM videos WHERE is_flagged=TRUE) AS flagged_videos`
    );
    // Video più segnalati
    const topReported = await pool.query(
      `SELECT v.id, v.title, v.youtube_id, v.is_flagged, COUNT(r.id)::int AS report_count
       FROM reports r JOIN videos v ON v.id = r.video_id
       WHERE r.status = 'pending'
       GROUP BY v.id ORDER BY report_count DESC LIMIT 5`
    );
    res.json({ ...stats.rows[0], topReported: topReported.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

// Approva segnalazione (blocca il video)
router.put("/reports/:id/approve", async (req, res) => {
  try {
    const report = await pool.query("SELECT * FROM reports WHERE id=$1", [req.params.id]);
    if (!report.rows.length) return res.status(404).json({ error: "Non trovata" });

    await pool.query("UPDATE reports SET status='approved', reviewed_at=NOW() WHERE id=$1", [
      req.params.id,
    ]);
    await pool.query("UPDATE videos SET is_flagged=TRUE WHERE id=$1", [report.rows[0].video_id]);
    try {
      await pool.query(
        "INSERT INTO admin_notifications(type,title,message,related_id) VALUES($1,$2,$3,$4)",
        [
          "report",
          "Video bloccato per segnalazione",
          `Un video è stato bloccato dopo una segnalazione approvata`,
          report.rows[0].video_id,
        ]
      );
    } catch {}
    await logAudit(
      req.user.id,
      "report_approve",
      "report",
      report.rows[0].id,
      `Video #${report.rows[0].video_id} bloccato`
    );

    res.json({ message: "Segnalazione approvata, video bloccato" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

// Rifiuta segnalazione (il video resta visibile)
router.put("/reports/:id/reject", async (req, res) => {
  try {
    const r = await pool.query(
      "UPDATE reports SET status='rejected', reviewed_at=NOW() WHERE id=$1 RETURNING id, video_id",
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Non trovata" });
    await logAudit(
      req.user.id,
      "report_reject",
      "report",
      r.rows[0].id,
      `Video #${r.rows[0].video_id}`
    );
    res.json({ message: "Segnalazione rifiutata" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

// Blocca/Sblocca video manualmente
router.put("/videos/:id/flag", async (req, res) => {
  try {
    const { flagged } = req.body;
    const r = await pool.query(
      "UPDATE videos SET is_flagged=$1 WHERE id=$2 RETURNING id, title, is_flagged, uploaded_by",
      [!!flagged, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Non trovato" });
    const v = r.rows[0];
    const action = flagged ? "bloccato" : "sbloccato";
    try {
      await pool.query(
        "INSERT INTO admin_notifications(type,title,message,related_id) VALUES($1,$2,$3,$4)",
        ["report", `Video ${action}`, `"${v.title}" è stato ${action} dall'admin`, v.id]
      );
    } catch {}

    // Notifica al creator: il suo video è stato (s)bloccato d'autorità.
    // Quando il video è flaggato non è più pubblicamente visibile, quindi
    // è importante che l'autore lo sappia subito. Il link punta a
    // creator.html (lista 'I miei video') invece di video.html, perché
    // se il video è flaggato la pagina pubblica risponde 404.
    try {
      await createNotificationIfDifferent(
        req.user.id,
        v.uploaded_by,
        flagged ? "video_flagged_admin" : "video_unflagged_admin",
        {
          actor_id: req.user.id,
          actor_name: req.user.username,
          video_id: v.id,
          video_title: v.title,
        },
        flagged ? "creator.html" : "video.html?id=" + v.id
      );
    } catch (_) {
      /* best effort */
    }

    // Notifica reporter SOLO quando si flagga (azione di moderazione).
    // Se si sflagga (rilascio), non notifichiamo nessuno: il video
    // è di nuovo pubblico, è sufficiente avvertire il creator.
    if (flagged) {
      try {
        const reportersR = await pool.query(
          `SELECT DISTINCT user_id
             FROM reports
            WHERE video_id = $1 AND user_id IS NOT NULL`,
          [v.id]
        );
        for (const row of reportersR.rows) {
          try {
            await createNotificationIfDifferent(
              req.user.id,
              row.user_id,
              "report_resolved",
              {
                action: "flagged",
                video_id: v.id,
                video_title: v.title,
              },
              null // niente link: il video flaggato non è più pubblico
            );
          } catch (_) {
            /* best effort */
          }
        }
      } catch (_) {
        /* best effort */
      }
    }

    await logAudit(req.user.id, flagged ? "video_flag" : "video_unflag", "video", v.id, v.title);
    res.json({ message: `Video ${action}`, video: v });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

// Elimina segnalazione
router.delete("/reports/:id", async (req, res) => {
  try {
    const r = await pool.query("DELETE FROM reports WHERE id=$1 RETURNING id", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: "Non trovata" });
    res.json({ message: "Eliminata" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ===== AUDIT LOG =====
router.get("/audit", async (req, res) => {
  try {
    // Se la tabella non esiste, ritorno lista vuota invece di 500
    try {
      await pool.query("SELECT 1 FROM admin_audit LIMIT 1");
    } catch {
      return res.json({ entries: [], pagination: { page: 1, limit: 8, total: 0, totalPages: 0 } });
    }

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 8, 100);
    const offset = (page - 1) * limit;
    const action = req.query.action || "";
    const search = req.query.search || "";

    let where = "WHERE 1=1",
      params = [],
      pi = 1;
    if (action) {
      where += ` AND a.action=$${pi}`;
      params.push(action);
      pi++;
    }
    if (search) {
      where += ` AND (a.details ILIKE $${pi} OR u.username ILIKE $${pi} OR u.email ILIKE $${pi} OR a.target_type ILIKE $${pi})`;
      params.push(`%${search}%`);
      pi++;
    }

    const total = (
      await pool.query(
        `SELECT COUNT(*)::int AS n FROM admin_audit a LEFT JOIN users u ON u.id=a.admin_id ${where}`,
        params
      )
    ).rows[0].n;
    const r = await pool.query(
      `SELECT a.id, a.action, a.target_type, a.target_id, a.details, a.created_at,
              u.id AS admin_id, u.username AS admin_username, u.email AS admin_email
       FROM admin_audit a LEFT JOIN users u ON u.id = a.admin_id
       ${where} ORDER BY a.created_at DESC LIMIT $${pi} OFFSET $${pi + 1}`,
      [...params, limit, offset]
    );
    res.json({
      entries: r.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

// Svuota completamente l'audit log. Registra comunque l'azione di svuotamento.
router.delete("/audit", async (req, res) => {
  try {
    try {
      await pool.query("SELECT 1 FROM admin_audit LIMIT 1");
    } catch {
      return res.status(404).json({ error: "Tabella audit non presente" });
    }
    const r = await pool.query("DELETE FROM admin_audit RETURNING id");
    // Niente logAudit qui: l'utente vuole il log completamente vuoto dopo la pulizia
    res.json({ message: "Audit log svuotato", deleted: r.rowCount });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

// GET /api/admin/creator-requests
// Elenco richieste pendenti di status "creator" (utenti con
// verified_request = TRUE non ancora verificati). Usato dalla
// pagina admin dedicata.
router.get("/creator-requests", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, username, email, created_at, verified_request_at, verified_profile
         FROM users
        WHERE verified_request = TRUE AND is_verified = FALSE
        ORDER BY verified_request_at ASC NULLS LAST, created_at ASC`
    );
    res.json({ requests: r.rows });
  } catch (e) {
    if (e.code === "42P01" || e.code === "42703") return res.json({ requests: [] });
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

// POST /api/admin/users/:id/deny-creator
// Rifiuta la richiesta creator: azzera verified_request e notifica
// l'utente. Non tocca is_verified (se per caso era gia' true non
// cambia nulla).
router.post("/users/:id/deny-creator", async (req, res) => {
  try {
    const uid = parseInt(req.params.id, 10);
    if (!uid) return res.status(400).json({ error: "ID non valido" });
    const r = await pool.query(
      `UPDATE users SET verified_request = FALSE
        WHERE id = $1 AND verified_request = TRUE
        RETURNING id, username, email`,
      [uid]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Richiesta non trovata" });
    try {
      await pool.query(
        `INSERT INTO notifications (user_id, type, payload, created_at)
         VALUES ($1, 'creator_denied', $2, NOW())`,
        [uid, JSON.stringify({ message: "La tua richiesta creator non e' stata approvata." })]
      );
    } catch (_) {}
    res.json({ ok: true, id: uid, username: r.rows[0].username });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

// Svuota contenuto del log
router.delete("/audit", async (req, res) => {
  try {
    try {
      await pool.query("SELECT 1 FROM admin_audit LIMIT 1");
    } catch {
      return res.json({ ok: true, deleted: 0 });
    }
    const r = await pool.query("DELETE FROM admin_audit RETURNING id");
    res.json({ ok: true, deleted: r.rows.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ============================================================
//  Approva/Rifiuta richiesta "diventa creator"
//  La GET /api/admin/creator-requests esiste gia' sopra; qui solo
//  gli endpoint POST chiamati dal pannello admin_richieste.html.
// ============================================================

router.post("/verified-requests/:uid/approve", async (req, res) => {
  try {
    const userId = parseInt(req.params.uid, 10);
    if (!userId) return res.status(400).json({ error: "ID non valido" });
    if (userId === req.user.id)
      return res.status(400).json({ error: "Non puoi verificare te stesso" });

    const r = await pool.query(
      `UPDATE users
          SET is_verified         = TRUE,
              verified_request    = FALSE,
              verified_by         = $1,
              verified_at         = NOW(),
              updated_at          = NOW()
        WHERE id = $2 AND role <> 'banned' AND is_verified = FALSE
        RETURNING id, username, email, role, is_verified, verified_profile, verified_at`,
      [req.user.id, userId]
    );
    if (!r.rows.length) {
      const chk = await pool.query("SELECT id, role, is_verified FROM users WHERE id = $1", [
        userId,
      ]);
      if (!chk.rows.length) return res.status(404).json({ error: "Utente non trovato" });
      if (chk.rows[0].role === "banned") return res.status(400).json({ error: "Utente bannato" });
      if (chk.rows[0].is_verified) return res.status(400).json({ error: "Utente gia' verificato" });
      return res.status(400).json({ error: "Approvazione non applicabile" });
    }

    // Come in PUT /users/:id/verify: se l'utente era stato revocato,
    // i video pubblici erano diventati privati. All'approvazione della
    // richiesta li riportiamo pubblici, cosi' non "spariscono" dopo il
    // giro revoca -> riapprova.
    await pool.query(
      "UPDATE videos SET is_private = FALSE WHERE uploaded_by = $1 AND is_private = TRUE",
      [userId]
    );

    await logAudit(req.user.id, "user_verify_approve", "user", userId, r.rows[0].username);
    createNotificationIfDifferent(
      req.user.id,
      userId,
      "verified_granted",
      {
        actor_id: req.user.id,
        actor_name: req.user.username,
      },
      "profilo.html"
    );

    res.json({ ok: true, user: r.rows[0] });
  } catch (e) {
    console.error("[POST /verified-requests/:uid/approve]", e);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.post("/verified-requests/:uid/reject", async (req, res) => {
  try {
    const userId = parseInt(req.params.uid, 10);
    if (!userId) return res.status(400).json({ error: "ID non valido" });

    const r = await pool.query(
      `UPDATE users
          SET verified_request = FALSE,
              updated_at       = NOW()
        WHERE id = $1 AND verified_request = TRUE
        RETURNING id, username, email`,
      [userId]
    );
    if (!r.rows.length) {
      return res.status(404).json({ error: "Richiesta non trovata o gia' evasa" });
    }

    await logAudit(req.user.id, "user_verify_reject", "user", userId, r.rows[0].username);
    createNotificationIfDifferent(
      req.user.id,
      userId,
      "creator_request_denied",
      {
        actor_id: req.user.id,
        actor_name: req.user.username,
        message: "La tua richiesta creator non e' stata approvata.",
      },
      "profilo.html"
    );

    res.json({ ok: true, user: r.rows[0] });
  } catch (e) {
    console.error("[POST /verified-requests/:uid/reject]", e);
    res.status(500).json({ error: "Errore interno" });
  }
});

module.exports = router;
