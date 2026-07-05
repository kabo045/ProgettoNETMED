/*
-  Per ricostruire il DB da zero in dev:
-docker compose down -v  
-docker compose up -d     
Eseguito automaticamente al primo avvio del container
*/ 

DROP TABLE IF EXISTS nm_push_subscriptions    CASCADE;
DROP TABLE IF EXISTS nm_watch_progress        CASCADE;
DROP TABLE IF EXISTS nm_user_follows          CASCADE;
DROP TABLE IF EXISTS account_delete_tokens    CASCADE;
DROP TABLE IF EXISTS email_change_tokens      CASCADE;
DROP TABLE IF EXISTS password_reset_tokens    CASCADE;
DROP TABLE IF EXISTS email_tokens             CASCADE;
DROP TABLE IF EXISTS collection_videos        CASCADE;
DROP TABLE IF EXISTS collections              CASCADE;
DROP TABLE IF EXISTS comment_reports          CASCADE;
DROP TABLE IF EXISTS admin_audit              CASCADE;
DROP TABLE IF EXISTS notifications            CASCADE;
DROP TABLE IF EXISTS admin_notifications      CASCADE;
DROP TABLE IF EXISTS video_favorites          CASCADE;
DROP TABLE IF EXISTS views                    CASCADE;
DROP TABLE IF EXISTS comments                 CASCADE;
DROP TABLE IF EXISTS likes                    CASCADE;
DROP TABLE IF EXISTS video_tags               CASCADE;
DROP TABLE IF EXISTS tags                     CASCADE;
DROP TABLE IF EXISTS reports                  CASCADE;
DROP TABLE IF EXISTS videos                   CASCADE;
DROP TABLE IF EXISTS categories               CASCADE;
DROP TABLE IF EXISTS users                    CASCADE;



CREATE TABLE users (
    id                   SERIAL        PRIMARY KEY,
    email                VARCHAR(255)  UNIQUE NOT NULL,
    username             VARCHAR(100)  UNIQUE NOT NULL,     -- username va bene per il login
    password_hash        TEXT          NOT NULL,          -- bcrypt 10 round
    role                 VARCHAR(50)   NOT NULL DEFAULT 'user',  -- 'user' | 'admin' | 'banned'
    avatar_url           TEXT,
    is_verified          BOOLEAN       NOT NULL DEFAULT FALSE,   --  if true creator
    verified_profile     JSONB,                                  -- {title,qualifica,organization} JSONB per campi variabili (creator)
    verified_by          INTEGER       REFERENCES users(id) ON DELETE SET NULL,  -- l' admin che ha approvato; 
    verified_at          TIMESTAMP,
    verified_request     BOOLEAN       NOT NULL DEFAULT FALSE,   -- true = richiesta di diventare creator
    verified_request_at  TIMESTAMPTZ,
    email_confirmed      BOOLEAN       NOT NULL DEFAULT FALSE,
    strike_count         INTEGER       NOT NULL DEFAULT 0,       -- contatore +1  ogni commento segnalato che un moderatore conferma; a 3 ban
    created_at           TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMP     NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_verified         ON users(id) WHERE is_verified = TRUE;
CREATE INDEX idx_users_strike_count     ON users(strike_count);
CREATE INDEX idx_users_verified_request ON users(verified_request_at)
    WHERE verified_request = TRUE;



CREATE TABLE admin_notifications (
    id          SERIAL        PRIMARY KEY,
    type        VARCHAR(50)   NOT NULL,
    title       VARCHAR(255)  NOT NULL,
    message     TEXT,
    is_read     BOOLEAN       NOT NULL DEFAULT FALSE,
    related_id  INTEGER,
    created_at  TIMESTAMP     NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_admin_notif_read ON admin_notifications(is_read);
CREATE INDEX idx_admin_notif_date ON admin_notifications(created_at DESC);

INSERT INTO admin_notifications (type, title, message, related_id) VALUES
    ('info', 'Benvenuto su NETMED', 'Il pannello admin e'' pronto', NULL); -- All

-- categories: eliminare una categoria NON distrugge i suoi video rimangono senza categoria finche non vengono riassegnati (not delete cascade)
CREATE TABLE categories (
    id          SERIAL        PRIMARY KEY,
    name        VARCHAR(100)  UNIQUE NOT NULL,
    created_at  TIMESTAMP     NOT NULL DEFAULT NOW()
);
INSERT INTO categories (name) VALUES
    ('Fisioterapia'), ('Neurologia'), ('Ortopedia'), ('Cardiologia');


-- videos: il vero contenuto e' YouTube (embed via youtube_id). Salviamo solo metadati. Il UNIQUE su youtube_id impedisce che due creator carichino lo stesso video YT.
CREATE TABLE videos (
    id             SERIAL        PRIMARY KEY,
    youtube_id     VARCHAR(20)   NOT NULL UNIQUE,        -- id YouTube ( 11 caratteri + margine))
    title          VARCHAR(255)  NOT NULL,
    description    TEXT,
    thumbnail_url  TEXT,
    uploaded_by    INTEGER       REFERENCES users(id)      ON DELETE SET NULL,  -- creator eliminato -> video sopravvive anonimo
    category_id    INTEGER       REFERENCES categories(id) ON DELETE SET NULL,  -- categoria eliminata ->video "senza categoria"
    is_private     BOOLEAN       NOT NULL DEFAULT FALSE,  -- scelta creator (o auto-privatizzato quando la sua verifica viene revocata quindi "nascosto")
    is_flagged     BOOLEAN       NOT NULL DEFAULT FALSE,  -- alzato dall'admin quando approva una segnalazione
    created_at     TIMESTAMP     NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_videos_category ON videos(category_id);


-- reports: segnalazioni SUI VIDEO. UNIQUE(video_id, user_id) =
-- un utente non puo' segnalare lo stesso video due volte.
-- Video CASCADE, User CASCADE: se cancello l'uno o l'altro, la segnalazione non esiste più.
CREATE TABLE reports (
    id          SERIAL        PRIMARY KEY,
    video_id    INTEGER       NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    user_id     INTEGER       NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    reason      VARCHAR(50)   NOT NULL,                     
    comment     TEXT,
    status      VARCHAR(20)   NOT NULL DEFAULT 'pending',   -- 'pending' | 'approved' | 'rejected'
    created_at  TIMESTAMP     NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMP,
    UNIQUE(video_id, user_id)
);
CREATE INDEX idx_reports_video  ON reports(video_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_date   ON reports(created_at DESC);


-- tags UNIQUE sul name previene i doppioni.
CREATE TABLE tags (
    id          SERIAL        PRIMARY KEY,
    name        VARCHAR(100)  UNIQUE NOT NULL,
    created_at  TIMESTAMP     NOT NULL DEFAULT NOW()
);
INSERT INTO tags (name) VALUES
    ('riabilitazione'), ('ginocchio'), ('spalla'), ('fisioterapia'), ('post-operatorio');

CREATE TABLE video_tags (
    video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    tag_id   INTEGER NOT NULL REFERENCES tags(id)   ON DELETE CASCADE,
    PRIMARY KEY (video_id, tag_id)
);
CREATE INDEX idx_tags_name      ON tags(name);
CREATE INDEX idx_video_tags_tag ON video_tags(tag_id);

CREATE TABLE likes (
    user_id    INTEGER  NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    video_id   INTEGER  NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    vote       SMALLINT NOT NULL DEFAULT 1 CHECK (vote IN (1, -1)),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, video_id)
);
CREATE INDEX idx_likes_video ON likes(video_id);
CREATE INDEX idx_likes_vote  ON likes(video_id, vote);

CREATE TABLE video_favorites (
    user_id    INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    video_id   INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, video_id)
);
CREATE INDEX idx_favorites_user  ON video_favorites(user_id);
CREATE INDEX idx_favorites_video ON video_favorites(video_id);


-- comments: soft delete tramite deleted_at. Le query di lettura filtrano sempre `WHERE deleted_at IS NULL`, cosi il commento cancellato "sparisce" ma resta in tabella (ripristinabile)
-- parent_id -> ON DELETE SET NULL: se cancello un commento padre in hard, le risposte sopravvivono come commenti orfani. 

CREATE TABLE comments (
    id          SERIAL    PRIMARY KEY,
    user_id     INTEGER   NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    video_id    INTEGER   NOT NULL REFERENCES videos(id)  ON DELETE CASCADE,
    parent_id   INTEGER   REFERENCES comments(id)         ON DELETE SET NULL,
    content     TEXT      NOT NULL,
    deleted_at  TIMESTAMP,                                 
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_comments_video  ON comments(video_id);
CREATE INDEX idx_comments_parent ON comments(parent_id);


-- comment_reports: segnalazioni SUI COMMENTI. Al raggiungere di
-- 3 segnalazioni open, il backend notifica il creator del vide.
CREATE TABLE comment_reports (
    id               SERIAL        PRIMARY KEY,
    comment_id       INTEGER       NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    reporter_user_id INTEGER       NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    reason           VARCHAR(40)   NOT NULL DEFAULT 'altro',
    note             VARCHAR(500),
    status           VARCHAR(20)   NOT NULL DEFAULT 'open',       -- 'open' | 'resolved'
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    resolved_at      TIMESTAMPTZ,
    UNIQUE (comment_id, reporter_user_id)                        -- un utente non puo ovviamente segnalare lo stesso commento due volte
);
CREATE INDEX idx_comment_reports_comment ON comment_reports(comment_id);
CREATE INDEX idx_comment_reports_status  ON comment_reports(status);


CREATE TABLE views (
    id        SERIAL    PRIMARY KEY,
    user_id   INTEGER   REFERENCES users(id)   ON DELETE SET NULL,
    video_id  INTEGER   NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_views_video ON views(video_id);



CREATE TABLE notifications (
    id         SERIAL       PRIMARY KEY,
    user_id    INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       VARCHAR(50)  NOT NULL,
    payload    JSONB,                                  -- campi variabili per tipo
    link       TEXT,                                   -- URL su cui portare l'utente al click
    read_at    TIMESTAMPTZ,                            -- NULL = non letta, valorizzato = letta
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_user_unread ON notifications(user_id, read_at);
CREATE INDEX idx_notif_user_date   ON notifications(user_id, created_at DESC);


-- admin_audit: traccia di TUTTE le azioni sensibili degli admin.
-- l'utente viene eliminato, il log resta comunque interpretabile.
-- actor_id -> ON DELETE SET NULL per non perdere azioni passate se l'admin che le ha fatte viene rimosso.
CREATE TABLE admin_audit (
    id           SERIAL      PRIMARY KEY,
    actor_id     INTEGER     REFERENCES users(id) ON DELETE SET NULL,
    action       VARCHAR(64) NOT NULL,           -- es. 'user_verify', 'user_ban', 'video_flag', ...
    target_type  VARCHAR(32),                    -- 'user' | 'video' | 'comment' | ...
    target_id    INTEGER,
    target_label VARCHAR(255),                   -- snapshot per audit resistente alle cancellazioni
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_date  ON admin_audit(created_at DESC);
CREATE INDEX idx_audit_actor ON admin_audit(actor_id);



-- UNIQUE (user_id, name) = un utente non puo' avere due cartelle no doppioni per lo stesso utente
CREATE TABLE collections (
    id         SERIAL        PRIMARY KEY,
    user_id    INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       VARCHAR(80)   NOT NULL,
    created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, name)
);
CREATE INDEX idx_collections_user ON collections(user_id);

-- collection_videos: associazione N a N con chiave composta. CASCADE su entrambi i lati: se sparisce la cartella o il video, l'associazione sparisce.
CREATE TABLE collection_videos (
    collection_id INTEGER     NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    video_id      INTEGER     NOT NULL REFERENCES videos(id)      ON DELETE CASCADE,
    added_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (collection_id, video_id)
);
CREATE INDEX idx_cv_video ON collection_videos(video_id);


--  TOKEN MONOUSO PER I FLUSSI EMAIL
--  Pattern comune: token generato con crypto.randomBytes(32),
--  scadenza tipica 1h (reset) o 24h (conferma), campo used_at
--  valorizzato al consumo per bloccare il riuso.
-- email_tokens: conferma indirizzo email alla registrazione.
-- Non ha used_at perche' al consumo lo eliminiamo direttamente
-- (la conferma email e' definitiva, non serve tracciare l'uso).
CREATE TABLE email_tokens (
    id         SERIAL       PRIMARY KEY,
    user_id    INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      VARCHAR(80)  UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ  NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_et_token   ON email_tokens(token);
CREATE INDEX idx_et_user_id ON email_tokens(user_id);


-- password_reset_tokens: link via email per reset password.
-- used_at bloccante: un token utilizzato non si puo' piu' usare.
CREATE TABLE password_reset_tokens (
    id         SERIAL       PRIMARY KEY,
    user_id    INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      VARCHAR(80)  UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ  NOT NULL,
    used_at    TIMESTAMPTZ,                            -- valorizzato al consumo, blocca riuso
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_prt_token   ON password_reset_tokens(token);
CREATE INDEX idx_prt_user_id ON password_reset_tokens(user_id);


-- email_change_tokens: verifica del NUOVO indirizzo email. new_email non e' UNIQUE (potrebbero esserci piu' utenti che provano lo stesso indirizzo contemporaneamente; l'unicita imposta al momento dell'UPDATE users.email).
CREATE TABLE email_change_tokens (
    id         SERIAL       PRIMARY KEY,
    user_id    INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    new_email  VARCHAR(120) NOT NULL,
    token      VARCHAR(80)  UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ  NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ect_token   ON email_change_tokens(token);
CREATE INDEX idx_ect_user_id ON email_change_tokens(user_id);


-- account_delete_tokens: DELETE /api/user/me non elimina direttamente. Crea un token, lo invia via email. Solo cliccando il link l'account viene davvero eliminato. Evita cancellazioni accidentali.
CREATE TABLE account_delete_tokens (
    id         SERIAL       PRIMARY KEY,
    user_id    INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      VARCHAR(80)  UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ  NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_adt_token   ON account_delete_tokens(token);
CREATE INDEX idx_adt_user_id ON account_delete_tokens(user_id);



-- iscrizioni ai creator.
-- CHECK(follower_id <> following_id) = impossibile auto-iscriversi
CREATE TABLE nm_user_follows (
    follower_id  INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id),
    CHECK (follower_id <> following_id)
);
CREATE INDEX idx_nm_user_follows_following ON nm_user_follows(following_id);
CREATE INDEX idx_nm_user_follows_follower  ON nm_user_follows(follower_id);


-- "Continua a guardare" 
CREATE TABLE nm_watch_progress (
    user_id     INTEGER   NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    video_id    INTEGER   NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    seconds     INTEGER   NOT NULL DEFAULT 0,     -- secondi guardati
    duration    INTEGER   NOT NULL DEFAULT 0,     -- durata totale
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, video_id)
);
CREATE INDEX idx_watch_progress_user ON nm_watch_progress (user_id, updated_at DESC);


-- nm_push_subscriptions: iscrizioni Web Push del browser.
-- endpoint UNIQUE = uno stesso browser genera una sola subscription.
-- p256dh + auth = chiavi ECDH del browser usate dal server con la
-- libreria web-push per cifrare il payload (VAPID, RFC 8030).
CREATE TABLE nm_push_subscriptions (
    id         SERIAL    PRIMARY KEY,
    user_id    INTEGER   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint   TEXT      NOT NULL UNIQUE,        -- URL del push service (fcm.googleapis.com, mozilla, ...)
    p256dh     TEXT      NOT NULL,               -- chiave pubblica ECDH del browser
    auth       TEXT      NOT NULL,               -- segreto d'autenticazione
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_push_user ON nm_push_subscriptions (user_id);