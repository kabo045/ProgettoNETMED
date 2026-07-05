
const pool = require("./db");

/*
  Crea una notifica per un utente.
 */

async function createNotification(userId, type, payload, link) {
  if (!userId || !type) return;
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, type, payload, link)
       VALUES ($1, $2, $3::jsonb, $4)`,
      [userId, type, JSON.stringify(payload || {}), link || null]
    );
  } catch (e) {
    console.warn("[notifications] insert failed:", e.code || "", e.message);
  }
}

/*
 Variante che evita di notificare l'attore stesso.
 */
async function createNotificationIfDifferent(actorId, recipientId, type, payload, link) {
  if (!recipientId || actorId === recipientId) return;
  return createNotification(recipientId, type, payload, link);
}

module.exports = {
  createNotification,
  createNotificationIfDifferent,
};
