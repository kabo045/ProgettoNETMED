# NETMED — Struttura del progetto

Documento di supporto alla lettura del codice. Spiega come sono
organizzate le cartelle e perche' ho fatto certe scelte.

## Panoramica

NETMED e' una piattaforma di streaming di video divulgativi
medico-scientifici. Lo stack e':

- **Backend**: Node.js 18 + Express 5
- **Database**: PostgreSQL 16
- **Frontend**: HTML + CSS + JavaScript vanilla (nessun framework)
- **Autenticazione**: JWT con firma HS256 + bcrypt (10 round) per le password
- **Runtime**: Docker Compose (due container: `netmed-app` e `netmed-db`)
- **Test**: Mocha + Chai + Supertest contro un DB reale in Docker

Ho tenuto lo stack volutamente semplice per non nascondere la logica
dentro un framework.

## Albero delle cartelle

```
NetflixTeleMedicina/
├── server.js                # Entry point Express
├── package.json             # Dipendenze npm + script (start, test)
├── package-lock.json        # Versioni bloccate delle dipendenze
├── Dockerfile               # Build image dell'app
├── docker-compose.yml       # Orchestrazione app + db
├── .env.example             # Template delle variabili d'ambiente
├── .gitignore
├── .dockerignore
│
├── config/                  # Configurazioni condivise
│   └── security.js          # Gestione centralizzata di JWT_SECRET
│
├── middleware/              # Middleware Express
│   ├── authMiddleware.js    # Verifica JWT su rotte protette
│   ├── creatorMiddleware.js # Blocca chi non e' creator
│   └── rateLimit.js         # Anti brute-force su login
│
├── routes/                  # Rotte REST divise per ruolo
│   ├── auth.js              # /register, /login
│   ├── userRoutes.js        # API utente comune
│   ├── creatorRoutes.js     # API riservate ai creator
│   └── adminRoutes.js       # API riservate agli admin
│
├── services/                # Logica di dominio riusabile
│   ├── email.js             # Invio email di conferma
│   └── passwordPolicy.js    # Regole di robustezza password
│
├── db/                      # Accesso al database
│   ├── db.js                # Pool di connessione Postgres
│   └── notifications.js     # Helper best-effort per creare notifiche
│
├── db-init/                 # SQL eseguito al primo avvio del container
│   └── 01_schema.sql        # Schema (tabelle, indici, CHECK, UNIQUE)
│
├── scripts/                 # Script utility standalone
│   ├── createAdmin.js       # Crea un utente admin da CLI
│   └── init-db.js           # Popola il DB con dati di esempio
│
├── test/                    # Test automatici (Mocha)
│   ├── helpers.js           # Utility riusate dai test
│   ├── test-admin-api.js
│   ├── test-creator-api.js
│   └── test-utente-api.js
│
└── public/                  # File serviti al browser
    ├── *.html               # Pagine (index, home, login, ecc.)
    ├── css/                 # Fogli di stile
    │   ├── admin/           #   -> stili pannello admin
    │   ├── user/            #   -> stili pagine utente
    │   └── *.css            #   -> stili condivisi (footer, responsive)
    ├── js/                  # JavaScript client
    │   ├── admin/           #   -> logica pannello admin
    │   ├── user/            #   -> logica pagine utente
    │   └── *.js             #   -> script condivisi (i18n, cookie)
    └── img/                 # Immagini (loghi, favicon, hero)
```

## Divisione admin / user

La distinzione tra `admin/` e `user/` (sia lato CSS che lato JS) e' voluta:
sono due esperienze completamente separate.

- Le **pagine utente** (home, video, ricerca, profilo…) hanno il loro header
  verde, il feed di video, il player YouTube, i preferiti.
- Il **pannello admin** e' una SPA con sidebar, tabelle, moderazione,
  audit log. Non condivide componenti UI con la parte utente.

Tenerli separati mi permette di:

1. Non rischiare di rompere una parte modificando l'altra.
2. Non caricare CSS/JS dell'admin sulle pagine utente (piu' leggere).
3. Riusare gli stessi nomi di file (`core.js`, `profilo.js`) senza
   collisioni, perche' vivono in cartelle diverse.

## Flusso di una richiesta

Prendiamo come esempio "l'utente clicca like a un video":

1. Il browser esegue una `fetch(POST /api/videos/:id/like)` da
   `public/js/user/video.js` con il JWT nell'header `Authorization`.
2. La richiesta arriva a `server.js` che la instrada verso
   `routes/userRoutes.js`.
3. Prima passa dal `middleware/authMiddleware.js` che verifica il JWT
   con la chiave in `config/security.js`.
4. La route esegue una `INSERT` nel DB usando il pool di `db/db.js`.
5. Se il video appartiene a un creator diverso, `db/notifications.js`
   crea una notifica per il proprietario.
6. La response torna al browser, che aggiorna il contatore like.

## Convenzioni di naming

- **File JS**: `camelCase.js` per moduli backend, `nome-pagina.js` per
  script frontend legati a una pagina (es. `home.js`, `video.js`).
- **File CSS**: `nome-componente.css` (es. `card.css`, `header.css`) o
  `vd-*.css` per il modulo Video Detail.
- **Rotte HTTP**: sempre in inglese, plurale, kebab-case
  (es. `/api/creator-requests`).
- **Tabelle DB**: singolare per l'entita' (`user`, `video`), plurale per
  le relazioni (`user_follows_user`).

## Cose che ho scelto di NON fare

- **Nessun bundler** (Webpack/Vite): file JS caricati direttamente dai
  tag `<script>`. Vantaggio: si legge quello che gira, senza sorpresa
  di transpiling. Svantaggio: nessun tree-shaking (poco importante qui).
- **Nessun ORM**: uso `pg` direttamente con query SQL. Volevo che il
  SQL fosse leggibile e verificabile riga per riga.
- **Nessun sistema di componenti**: gli HTML condividono header e footer
  per copia. E' ripetitivo ma trasparente. Se il progetto crescesse
  passerei a un template engine (EJS/Pug) o a un framework.

## Come avviarlo (per il prof)

```bash
# 1. Copia il template variabili e personalizzalo se serve
cp .env.example .env

# 2. Avvia app + DB
docker compose up --build

# 3. Popola il DB con dati di esempio
docker compose exec app node scripts/init-db.js

# 4. Crea l'utente admin
docker compose exec app node scripts/createAdmin.js

# 5. Apri il browser su http://localhost:3000
```

I test si lanciano con:

```bash
npm test
```
