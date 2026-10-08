#!/usr/bin/env node
/**
 * loadtest.js — Load test degli endpoint principali di NETMED con autocannon.
 *
 * Uso:
 *   node loadtest.js
 *
 * Variabili d'ambiente (tutte opzionali, con default):
 *   BASE_URL        default: http://localhost:3000
 *   ADMIN_EMAIL     default: admin@netmed.com
 *   ADMIN_PASSWORD  default: Admin123!
 *   USER_EMAIL      email di un utente normale (non-admin) già registrato
 *   USER_PASSWORD   password dell'utente normale
 *   DURATION        durata di ogni test in secondi, default: 10
 *   CONNECTIONS     connessioni concorrenti, default: 10
 *
 * Se USER_EMAIL/USER_PASSWORD non sono forniti, gli endpoint "utente"
 * vengono testati comunque usando il token admin (autenticato, ma non
 * rappresentativo del ruolo "viewer" — va bene per stimare i tempi di
 * risposta di middleware/DB, ma non per validare le regole di
 * autorizzazione specifiche del ruolo).
 *
 * NOTA IMPORTANTE su /api/auth/login:
 * l'endpoint è protetto da un rate limiter (loginLimiter, vedi routes/auth.js).
 * Con alta concorrenza è ATTESO ricevere molte risposte 429 dopo le prime
 * richieste — il rate limiter sta funzionando correttamente, non è un
 * errore del load test. Se vuoi misurare il tempo di risposta "puro"
 * dell'endpoint senza l'interferenza del rate limiter, alza temporaneamente
 * la soglia di loginLimiter in ambiente di test, oppure riduci
 * CONNECTIONS/DURATION solo per quell'endpoint.
 */

const autocannon = require('autocannon');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@netmed.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!';
const USER_EMAIL = process.env.USER_EMAIL || null;
const USER_PASSWORD = process.env.USER_PASSWORD || null;
const DURATION = parseInt(process.env.DURATION || '10', 10);
const CONNECTIONS = parseInt(process.env.CONNECTIONS || '10', 10);

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.min(Math.max(idx, 0), sortedArr.length - 1)];
}

async function login(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login fallito per ${email}: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.token;
}

async function getSampleVideoId() {
  const res = await fetch(`${BASE_URL}/api/user/explore`);
  if (!res.ok) {
    throw new Error(`Impossibile recuperare la lista video da /api/user/explore: ${res.status}`);
  }
  const data = await res.json();
  const list = data.videos || [];
  if (!list.length) {
    throw new Error(
      'Nessun video trovato nel DB. Crea almeno un video di test (es. via seed o script admin) prima di lanciare il load test.'
    );
  }
  return list[0].id;
}

function runLoadTest({ title, method, path, token, body, connections, duration }) {
  return new Promise((resolve, reject) => {
    const samples = [];
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const instance = autocannon(
      {
        url: `${BASE_URL}${path}`,
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        connections: connections || CONNECTIONS,
        duration: duration || DURATION,
      },
      (err, result) => {
        if (err) return reject(err);
        samples.sort((a, b) => a - b);
        resolve({
          title,
          method,
          avg: samples.length
            ? samples.reduce((a, b) => a + b, 0) / samples.length
            : result.latency.average,
          p95: percentile(samples, 95),
          p99: percentile(samples, 99),
          rps: result.requests.average,
          statusCodes: result.statusCodeStats,
        });
      }
    );

    instance.on('response', (client, statusCode, resBytes, responseTime) => {
      samples.push(responseTime);
    });
  });
}

async function main() {
  console.log(`Target: ${BASE_URL}`);
  console.log(`Durata per endpoint: ${DURATION}s, Connessioni concorrenti: ${CONNECTIONS}\n`);

  console.log('Login admin...');
  const adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);

  let userToken = adminToken;
  if (USER_EMAIL && USER_PASSWORD) {
    console.log('Login utente normale...');
    userToken = await login(USER_EMAIL, USER_PASSWORD);
  } else {
    console.log(
      'USER_EMAIL/USER_PASSWORD non impostati: uso il token admin anche per gli endpoint "utente" (vedi nota in testa al file).'
    );
  }

  console.log('Recupero un video id di esempio...');
  const videoId = await getSampleVideoId();
  console.log(`Video id usato per i test parametrici: ${videoId}\n`);

  // Path verificati direttamente su userRoutes.js e adminRoutes.js
  // (GET /api/user/videos non esiste: si usa /api/user/explore come lista pubblica;
  //  GET /api/user/notifications non esiste: il path reale è /api/user/me/notifications)
  const endpoints = [
    { title: '/api/user/explore', method: 'GET', path: '/api/user/explore' },
    { title: '/api/user/videos/:id', method: 'GET', path: `/api/user/videos/${videoId}` },
    {
      title: '/api/user/videos/:id/comments',
      method: 'GET',
      path: `/api/user/videos/${videoId}/comments`,
    },
    {
      title: '/api/auth/login',
      method: 'POST',
      path: '/api/auth/login',
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      // Carico ridotto rispetto agli altri endpoint: loginLimiter blocca dopo
      // poche richieste, quindi un test lungo produrrebbe solo 429 e non
      // misure utili sul tempo di risposta reale dell'endpoint.
      connections: 3,
      duration: 5,
    },
    {
      title: '/api/user/videos/:id/like',
      method: 'POST',
      path: `/api/user/videos/${videoId}/like`,
      token: userToken,
      // L'alias /like inoltra a /vote, che richiede { vote: 1|-1|0 } nel body,
      // altrimenti risponde sempre 400 "Voto non valido".
      body: { vote: 1 },
    },
    {
      title: '/api/user/me/notifications',
      method: 'GET',
      path: '/api/user/me/notifications',
      token: userToken,
    },
    {
      title: '/api/admin/reports',
      method: 'GET',
      path: '/api/admin/reports',
      token: adminToken,
    },
  ];

  const results = [];
  for (const ep of endpoints) {
    console.log(`--- Test: ${ep.method} ${ep.path} ---`);
    const r = await runLoadTest(ep);
    results.push(r);
    console.log(
      `media: ${r.avg.toFixed(1)}ms | p95: ${r.p95}ms | p99: ${r.p99}ms | req/s: ${r.rps.toFixed(1)}`
    );
    console.log('status codes:', r.statusCodes, '\n');
  }

  console.log('\n=== RIEPILOGO — pronto per la Tabella 4.2 ===\n');
  console.log(
    'Endpoint'.padEnd(32) +
      'Metodo'.padEnd(8) +
      'Media'.padEnd(10) +
      'p95'.padEnd(10) +
      'p99'.padEnd(10) +
      'Req/s'
  );
  for (const r of results) {
    console.log(
      r.title.padEnd(32) +
        r.method.padEnd(8) +
        `${r.avg.toFixed(1)}ms`.padEnd(10) +
        `${r.p95}ms`.padEnd(10) +
        `${r.p99}ms`.padEnd(10) +
        r.rps.toFixed(1)
    );
  }
}

main().catch((err) => {
  console.error('Errore durante il load test:', err);
  process.exit(1);
});