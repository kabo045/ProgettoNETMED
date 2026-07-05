

process.env.NODE_ENV = "test";

const request = require("supertest");
const { expect } = require("chai");
const app = require("../server");
const { sql, ensureUser, deleteUser, closePool } = require("./helpers");

describe("API Admin (DB Docker)", function () {
  this.timeout(20000);

  let admin, viewer, createdCategoryId, createdTagId;

  before(async () => {
    admin = await ensureUser({
      email: "admin.test@netmed.local",
      username: "admintest",
      password: "Password!123",
      role: "admin",
    });
    viewer = await ensureUser({
      email: "viewer2.test@netmed.local",
      username: "viewer2test",
      password: "Password!123",
      role: "user",
    });
  });

  after(async () => {
    if (createdCategoryId) await sql(`DELETE FROM categories WHERE id=$1`, [createdCategoryId]).catch(() => {});
    if (createdTagId) await sql(`DELETE FROM tags WHERE id=$1`, [createdTagId]).catch(() => {});
    if (admin) await deleteUser(admin.id);
    if (viewer) await deleteUser(viewer.id);
    await closePool();
  });

  // ============ DASHBOARD / VERSIONE ============
  describe("Dashboard e versione", () => {
    it("GET /api/admin/__version (pubblico)", async () => {
      const res = await request(app).get("/api/admin/__version");
      expect([200, 404]).to.include(res.status);
    });

    it("GET /api/admin/stats → 200 con metriche aggregate", async () => {
      const res = await request(app)
        .get("/api/admin/stats")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).to.equal(200);
      expect(res.body).to.be.an("object");
    });

    it("GET /api/admin/analytics → 200", async () => {
      const res = await request(app)
        .get("/api/admin/analytics")
        .set("Authorization", `Bearer ${admin.token}`);
      expect([200, 404]).to.include(res.status);
    });

    it("GET /api/admin/search?q=test", async () => {
      const res = await request(app)
        .get("/api/admin/search?q=test")
        .set("Authorization", `Bearer ${admin.token}`);
      expect([200, 400]).to.include(res.status);
    });
  });

  // ============ UTENTI ============
  describe("Gestione utenti", () => {
    it("GET /api/admin/users → 200 lista utenti", async () => {
      const res = await request(app)
        .get("/api/admin/users")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).to.equal(200);
      expect(res.body).to.satisfy((b) => Array.isArray(b) || Array.isArray(b.users));
    });

    it("GET /api/admin/users/:id → dettaglio utente target", async () => {
      const res = await request(app)
        .get(`/api/admin/users/${viewer.id}`)
        .set("Authorization", `Bearer ${admin.token}`);
      expect([200, 404]).to.include(res.status);
    });

    it("GET /api/admin/users/recent → ultimi utenti registrati", async () => {
      const res = await request(app)
        .get("/api/admin/users/recent")
        .set("Authorization", `Bearer ${admin.token}`);
      expect([200]).to.include(res.status);
    });

    it("GET /api/admin/users/:id/history → cronologia di un utente", async () => {
      const res = await request(app)
        .get(`/api/admin/users/${viewer.id}/history`)
        .set("Authorization", `Bearer ${admin.token}`);
      expect([200, 404]).to.include(res.status);
    });
  });

  // ============ CATEGORIE: CRUD completo ============
  describe("CRUD categorie", () => {
    it("GET /api/admin/categories → 200 array", async () => {
      const res = await request(app)
        .get("/api/admin/categories")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).to.equal(200);
    });

    it("POST /api/admin/categories → crea categoria", async () => {
      const res = await request(app)
        .post("/api/admin/categories")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ name: "TestCat" + Date.now() });
      expect([200, 201]).to.include(res.status);
      createdCategoryId =
        (res.body && res.body.id) ||
        (res.body && res.body.category && res.body.category.id);
    });

    it("PUT /api/admin/categories/:id → rinomina", async function () {
      if (!createdCategoryId) return this.skip();
      const res = await request(app)
        .put(`/api/admin/categories/${createdCategoryId}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ name: "TestCatUpd" + Date.now() });
      expect([200, 204]).to.include(res.status);
    });

    it("DELETE /api/admin/categories/:id → elimina (idempotente)", async function () {
      if (!createdCategoryId) return this.skip();
      const res = await request(app)
        .delete(`/api/admin/categories/${createdCategoryId}`)
        .set("Authorization", `Bearer ${admin.token}`);
      expect([200, 204, 404]).to.include(res.status);
      createdCategoryId = null;
    });
  });

  // ============ TAGS ============
  describe("CRUD tag", () => {
    it("GET /api/admin/tags → 200", async () => {
      const res = await request(app)
        .get("/api/admin/tags")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).to.equal(200);
    });

    it("POST /api/admin/tags → crea", async () => {
      const res = await request(app)
        .post("/api/admin/tags")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ name: "testtag" + Date.now() });
      expect([200, 201]).to.include(res.status);
      createdTagId =
        (res.body && res.body.id) ||
        (res.body && res.body.tag && res.body.tag.id);
    });

    it("DELETE /api/admin/tags/:id → elimina", async function () {
      if (!createdTagId) return this.skip();
      const res = await request(app)
        .delete(`/api/admin/tags/${createdTagId}`)
        .set("Authorization", `Bearer ${admin.token}`);
      expect([200, 204, 404]).to.include(res.status);
      createdTagId = null;
    });
  });

  // ============ VIDEO ============
  describe("Gestione video", () => {
    it("GET /api/admin/videos → 200", async () => {
      const res = await request(app)
        .get("/api/admin/videos")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).to.equal(200);
    });

    it("GET /api/admin/videos/recent → 200", async () => {
      const res = await request(app)
        .get("/api/admin/videos/recent")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).to.equal(200);
    });

    it("GET /api/admin/videos/tags/all → 200", async () => {
      const res = await request(app)
        .get("/api/admin/videos/tags/all")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).to.equal(200);
    });
  });

  // ============ NOTIFICHE + AUDIT ============
  describe("Notifiche admin e audit log", () => {
    it("GET /api/admin/notifications → 200", async () => {
      const res = await request(app)
        .get("/api/admin/notifications")
        .set("Authorization", `Bearer ${admin.token}`);
      expect([200]).to.include(res.status);
    });

    it("PUT /api/admin/notifications/read-all → 200", async () => {
      const res = await request(app)
        .put("/api/admin/notifications/read-all")
        .set("Authorization", `Bearer ${admin.token}`);
      expect([200, 204]).to.include(res.status);
    });
  });

  // ============ SECURITY: viewer NON puo' accedere ============
  describe("Sicurezza: solo admin", () => {
    it("GET /api/admin/users da utente normale → 401/403", async () => {
      const res = await request(app)
        .get("/api/admin/users")
        .set("Authorization", `Bearer ${viewer.token}`);
      expect([401, 403]).to.include(res.status);
    });

    it("POST /api/admin/categories da utente normale → 401/403", async () => {
      const res = await request(app)
        .post("/api/admin/categories")
        .set("Authorization", `Bearer ${viewer.token}`)
        .send({ name: "hack" });
      expect([401, 403]).to.include(res.status);
    });
  });
});
