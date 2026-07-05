
process.env.NODE_ENV = "test";

const request = require("supertest");
const { expect } = require("chai");
const app = require("../server");
const { ensureUser, pickRealData, deleteUser, closePool } = require("./helpers");

describe("API Utente (DB Docker)", function () {
  this.timeout(20000);

  let user, videoId, categoryId;

  before(async () => {
    user = await ensureUser({
      email: "utente.test@netmed.local",
      username: "utentetest",
      password: "Password!123",
      role: "user",
    });
    const real = await pickRealData();
    videoId = real.videoId;
    categoryId = real.categoryId;
  });

  after(async () => {
    if (user) await deleteUser(user.id);
    await closePool();
  });

  // ============ ENDPOINT PUBBLICI ============
  describe("Catalogo pubblico (no auth)", () => {
    it("GET /api/user/home → rows", async () => {
      const res = await request(app).get("/api/user/home");
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("rows");
      expect(res.body.rows).to.be.an("array");
    });

    it("GET /api/user/categories → array", async () => {
      const res = await request(app).get("/api/user/categories");
      expect(res.status).to.equal(200);
      expect(res.body).to.be.an("array");
    });

    it("GET /api/user/tags?limit=10 → { tags }", async () => {
      const res = await request(app).get("/api/user/tags?limit=10");
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("tags");
    });

    it("GET /api/user/explore", async () => {
      const res = await request(app).get("/api/user/explore");
      expect(res.status).to.equal(200);
    });

    it("GET /api/user/search?q=cuore", async () => {
      const res = await request(app).get("/api/user/search?q=cuore");
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("videos");
    });

    it("GET /api/user/categories/:id/videos (se esiste categoria)", async function () {
      if (!categoryId) return this.skip();
      const res = await request(app).get(`/api/user/categories/${categoryId}/videos`);
      expect(res.status).to.equal(200);
      expect(res.body).to.be.an("array");
    });
  });

  // ============ DETTAGLIO VIDEO ============
  describe("Dettaglio video", () => {
    it("GET /api/user/videos/:id (se esiste video)", async function () {
      if (!videoId) return this.skip();
      const res = await request(app).get(`/api/user/videos/${videoId}`);
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("id");
    });

    it("GET /api/user/videos/:id/related", async function () {
      if (!videoId) return this.skip();
      const res = await request(app).get(`/api/user/videos/${videoId}/related`);
      expect(res.status).to.equal(200);
      expect(res.body).to.be.an("array");
    });

    it("GET /api/user/videos/:id/comments", async function () {
      if (!videoId) return this.skip();
      const res = await request(app).get(`/api/user/videos/${videoId}/comments`);
      expect(res.status).to.equal(200);
      expect(res.body).to.be.an("array");
    });

    it("POST /api/user/videos/:id/view (loggato)", async function () {
      if (!videoId) return this.skip();
      const res = await request(app)
        .post(`/api/user/videos/${videoId}/view`)
        .set("Authorization", `Bearer ${user.token}`);
      expect([200, 201, 204]).to.include(res.status);
    });

  });

  // ============ COMMENTI (round-trip) ============
  describe("Commenti (write + read + delete)", () => {
    let commentId;

    it("POST commento → 200/201 con shape giusto", async function () {
      if (!videoId) return this.skip();
      const res = await request(app)
        .post(`/api/user/videos/${videoId}/comments`)
        .set("Authorization", `Bearer ${user.token}`)
        .send({ content: "Commento test automatico " + Date.now() });
      expect([200, 201]).to.include(res.status);
      // Il backend ritorna { ok, comment, ...campi } per compat
      const c = res.body.comment || res.body;
      expect(c).to.have.property("id");
      commentId = c.id;
    });

    it("PUT commento → modifica il contenuto", async function () {
      if (!commentId) return this.skip();
      const res = await request(app)
        .put(`/api/user/comments/${commentId}`)
        .set("Authorization", `Bearer ${user.token}`)
        .send({ content: "Modificato " + Date.now() });
      expect([200, 204]).to.include(res.status);
    });

    it("DELETE commento (soft) → 200", async function () {
      if (!commentId) return this.skip();
      const res = await request(app)
        .delete(`/api/user/comments/${commentId}`)
        .set("Authorization", `Bearer ${user.token}`);
      expect([200, 204]).to.include(res.status);
    });

    it("DELETE commento purge (hard delete del proprio) → 200", async function () {
      if (!commentId) return this.skip();
      const res = await request(app)
        .delete(`/api/user/comments/${commentId}/purge`)
        .set("Authorization", `Bearer ${user.token}`);
      expect([200, 204]).to.include(res.status);
    });
  });

  // ============ PROFILO PERSONALE ============
  describe("Profilo personale", () => {
    it("GET /api/user/me → utente loggato", async () => {
      const res = await request(app)
        .get("/api/user/me")
        .set("Authorization", `Bearer ${user.token}`);
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("id", user.id);
    });

    it("GET /api/user/me/history", async () => {
      const res = await request(app)
        .get("/api/user/me/history")
        .set("Authorization", `Bearer ${user.token}`);
      expect(res.status).to.equal(200);
    });

    it("GET /api/user/me/comments → { items, videos }", async () => {
      const res = await request(app)
        .get("/api/user/me/comments")
        .set("Authorization", `Bearer ${user.token}`);
      expect(res.status).to.equal(200);
      // Il backend ritorna { items: [], videos: [] } per la pagina /miei-commenti
      expect(res.body).to.be.an("object");
      expect(res.body).to.have.property("items");
    });

    it("PUT /api/user/me/profile → aggiorna username", async () => {
      const res = await request(app)
        .put("/api/user/me/profile")
        .set("Authorization", `Bearer ${user.token}`)
        .send({ username: user.username + "_upd" });
      expect([200, 204]).to.include(res.status);
    });
  });

  // ============ PREFERITI + COLLEZIONI ============
  describe("Preferiti e collezioni", () => {
    it("GET /api/user/favorites → array", async () => {
      const res = await request(app)
        .get("/api/user/favorites")
        .set("Authorization", `Bearer ${user.token}`);
      expect(res.status).to.equal(200);
      expect(res.body).to.be.an("array");
    });

    it("GET /api/user/collections → array", async () => {
      const res = await request(app)
        .get("/api/user/collections")
        .set("Authorization", `Bearer ${user.token}`);
      expect(res.status).to.equal(200);
      expect(res.body).to.be.an("array");
    });

  });

  // ============ NOTIFICHE ============
  describe("Notifiche", () => {
    it("GET /api/user/me/notifications → array", async () => {
      const res = await request(app)
        .get("/api/user/me/notifications")
        .set("Authorization", `Bearer ${user.token}`);
      expect(res.status).to.equal(200);
    });

    it("GET /api/user/me/notifications/unread-count", async () => {
      const res = await request(app)
        .get("/api/user/me/notifications/unread-count")
        .set("Authorization", `Bearer ${user.token}`);
      expect(res.status).to.equal(200);
    });

    it("PUT /api/user/me/notifications/read-all", async () => {
      const res = await request(app)
        .put("/api/user/me/notifications/read-all")
        .set("Authorization", `Bearer ${user.token}`);
      expect([200, 204]).to.include(res.status);
    });
  });

  // ============ ENDPOINT PROTETTI - NEGATIVE TESTS ============
  describe("Sicurezza: endpoint protetti rifiutano richieste senza token", () => {
    it("GET /api/user/me senza token → 401", async () => {
      const res = await request(app).get("/api/user/me");
      expect(res.status).to.equal(401);
    });

    it("GET /api/admin/stats da utente normale → 401 o 403", async () => {
      const res = await request(app)
        .get("/api/admin/stats")
        .set("Authorization", `Bearer ${user.token}`);
      expect([401, 403]).to.include(res.status);
    });

    it("GET /api/creator/my/videos da utente non-verificato → 403", async () => {
      const res = await request(app)
        .get("/api/creator/my/videos")
        .set("Authorization", `Bearer ${user.token}`);
      expect([401, 403]).to.include(res.status);
    });
  });
});
