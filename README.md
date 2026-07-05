Piattaforma di streaming di video divulgativi medico-scientifici.

NETMED e' un catalogo di video divulgativi verificati da professionisti
sanitari. Ogni utente può:
- Guardare video con lettore embedded YouTube.
- Iscriversi ai canali dei creator preferiti.
- Salvare i video nei propri preferiti (con cartelle).
- Commentare e mettere like.
- Segnalare contenuti inappropriati.

I creatori verificati possono caricare video, moderare i commenti sui
propri contenuti e rispondere agli iscritti. Gli amministratori/admin hanno un
pannello dedicato per gestire utenti, video, segnalazioni e richieste
di verifica creator.

Tecnologie utilizzate 

- Backend: Node.js + Express 
- Database: PostgreSQL
- Frontend: HTML + CSS + JavaScript vanilla (nessun framework)
- Autenticazione: JWT HS256 + bcrypt (10 round)
- Container: Docker Compose (app + db)
- Test: Mocha + Chai + Supertest

DOCKER  

1. Clona il repo
git clone https://github.com/kabo045/Progetto-TESI.git
cd Progetto-TESI

2. Copia il template delle variabili d'ambiente
cp .env.example .env

3. Avvia app + database
docker compose up --build

4. Apri il browser → http://localhost:3000


Test --> comando npm test

I test girano contro un DB reale in Docker.

