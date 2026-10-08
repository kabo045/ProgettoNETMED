-- ============================================================================
--  NETMED - Esperimento sull'indice del feed pubblico (Capitolo 5 della tesi)
--
--  Misura il costo dell'interrogazione del feed pubblico
--  (GET /api/user/explore, routes/userRoutes.js) in tre condizioni:
--    A) al volume attuale del catalogo
--    B) con 50.000 video, senza indice su created_at
--    C) con 50.000 video, con indice su created_at
--
--  Uso:  psql -U <utente> -d <database> -f scripts/tesi-esperimento-indice.sql
--
--  ATTENZIONE: la fase 1 inserisce 50.000 righe nella tabella videos.
--  La fase 5 le rimuove tutte. Fai comunque un dump prima di partire.
-- ============================================================================

\timing off
\pset pager off

-- ---------------------------------------------------------------------------
--  FASE 0 - Stato di partenza
-- ---------------------------------------------------------------------------
\echo ''
\echo '=========== FASE 0 - STATO DI PARTENZA ==========='

SELECT count(*) AS video_totali,
       count(*) FILTER (WHERE is_private = FALSE AND is_flagged = FALSE) AS video_pubblici
  FROM videos;

\echo '--- indici attualmente definiti su videos ---'
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'videos' ORDER BY indexname;

\echo '--- piano di esecuzione del feed al volume attuale ---'
EXPLAIN (ANALYZE, BUFFERS)
SELECT v.id, v.youtube_id, v.title, v.thumbnail_url, v.created_at,
       c.name AS category_name, c.id AS category_id,
       u.username AS uploaded_by_username, u.is_verified AS uploaded_by_verified,
       (SELECT COUNT(*) FROM views WHERE video_id=v.id)::int AS views_count,
       (SELECT COUNT(*) FROM likes WHERE video_id=v.id AND vote=1)::int AS useful_count
  FROM videos v LEFT JOIN categories c ON c.id=v.category_id
  LEFT JOIN users u ON u.id=v.uploaded_by
 WHERE v.is_private = FALSE AND v.is_flagged = FALSE
 ORDER BY v.created_at DESC LIMIT 48;

DO $$
DECLARE t0 timestamptz; res numeric[] := '{}';
BEGIN
  FOR i IN 1..5 LOOP
    t0 := clock_timestamp();
    PERFORM * FROM (
      SELECT v.id, v.created_at,
             (SELECT COUNT(*) FROM views WHERE video_id=v.id)::int AS vc,
             (SELECT COUNT(*) FROM likes WHERE video_id=v.id AND vote=1)::int AS uc
        FROM videos v LEFT JOIN categories c ON c.id=v.category_id
        LEFT JOIN users u ON u.id=v.uploaded_by
       WHERE v.is_private = FALSE AND v.is_flagged = FALSE
       ORDER BY v.created_at DESC LIMIT 48) q;
    res := res || round((EXTRACT(epoch FROM clock_timestamp()-t0)*1000)::numeric, 2);
  END LOOP;
  RAISE NOTICE 'FASE 0 - tempi delle 5 esecuzioni (ms): %', res;
END $$;

-- ---------------------------------------------------------------------------
--  FASE 1 - Popolamento con 50.000 video sintetici
-- ---------------------------------------------------------------------------
\echo ''
\echo '=========== FASE 1 - POPOLAMENTO (50.000 righe) ==========='

DO $$
DECLARE uids int[]; cids int[];
BEGIN
  SELECT COALESCE(array_agg(id), ARRAY[]::int[]) INTO uids FROM users;
  SELECT COALESCE(array_agg(id), ARRAY[]::int[]) INTO cids FROM categories;

  INSERT INTO videos (youtube_id, title, description,
                      uploaded_by, category_id, is_private, is_flagged, created_at)
  SELECT 'ZZSEED' || lpad(g::text, 11, '0'),
         'Video sintetico numero ' || g,
         'Riga generata per la valutazione delle prestazioni del feed pubblico.',
         CASE WHEN cardinality(uids) > 0 THEN uids[1 + (g % cardinality(uids))] END,
         CASE WHEN cardinality(cids) > 0 THEN cids[1 + (g % cardinality(cids))] END,
         (g % 20 = 0),   -- 5% privati
         (g % 33 = 0),   -- 3% bloccati da segnalazione
         NOW() - (g || ' minutes')::interval
    FROM generate_series(1, 50000) g;
END $$;

ANALYZE videos;

SELECT count(*) AS video_totali,
       count(*) FILTER (WHERE is_private = FALSE AND is_flagged = FALSE) AS video_pubblici
  FROM videos;

-- ---------------------------------------------------------------------------
--  FASE 2 - 50.000 video, SENZA indice su created_at
-- ---------------------------------------------------------------------------
\echo ''
\echo '=========== FASE 2 - 50.000 VIDEO, SENZA INDICE ==========='

EXPLAIN (ANALYZE, BUFFERS)
SELECT v.id, v.youtube_id, v.title, v.thumbnail_url, v.created_at,
       c.name AS category_name, c.id AS category_id,
       u.username AS uploaded_by_username, u.is_verified AS uploaded_by_verified,
       (SELECT COUNT(*) FROM views WHERE video_id=v.id)::int AS views_count,
       (SELECT COUNT(*) FROM likes WHERE video_id=v.id AND vote=1)::int AS useful_count
  FROM videos v LEFT JOIN categories c ON c.id=v.category_id
  LEFT JOIN users u ON u.id=v.uploaded_by
 WHERE v.is_private = FALSE AND v.is_flagged = FALSE
 ORDER BY v.created_at DESC LIMIT 48;

DO $$
DECLARE t0 timestamptz; res numeric[] := '{}';
BEGIN
  FOR i IN 1..5 LOOP
    t0 := clock_timestamp();
    PERFORM * FROM (
      SELECT v.id, v.created_at,
             (SELECT COUNT(*) FROM views WHERE video_id=v.id)::int AS vc,
             (SELECT COUNT(*) FROM likes WHERE video_id=v.id AND vote=1)::int AS uc
        FROM videos v LEFT JOIN categories c ON c.id=v.category_id
        LEFT JOIN users u ON u.id=v.uploaded_by
       WHERE v.is_private = FALSE AND v.is_flagged = FALSE
       ORDER BY v.created_at DESC LIMIT 48) q;
    res := res || round((EXTRACT(epoch FROM clock_timestamp()-t0)*1000)::numeric, 2);
  END LOOP;
  RAISE NOTICE 'FASE 2 - tempi delle 5 esecuzioni (ms): %', res;
END $$;

-- ---------------------------------------------------------------------------
--  FASE 3 - Indice semplice su created_at
-- ---------------------------------------------------------------------------
\echo ''
\echo '=========== FASE 3 - INDICE SEMPLICE SU created_at ==========='

CREATE INDEX idx_videos_created_at ON videos (created_at DESC);
ANALYZE videos;

SELECT pg_size_pretty(pg_relation_size('idx_videos_created_at')) AS dimensione_indice;

EXPLAIN (ANALYZE, BUFFERS)
SELECT v.id, v.youtube_id, v.title, v.thumbnail_url, v.created_at,
       c.name AS category_name, c.id AS category_id,
       u.username AS uploaded_by_username, u.is_verified AS uploaded_by_verified,
       (SELECT COUNT(*) FROM views WHERE video_id=v.id)::int AS views_count,
       (SELECT COUNT(*) FROM likes WHERE video_id=v.id AND vote=1)::int AS useful_count
  FROM videos v LEFT JOIN categories c ON c.id=v.category_id
  LEFT JOIN users u ON u.id=v.uploaded_by
 WHERE v.is_private = FALSE AND v.is_flagged = FALSE
 ORDER BY v.created_at DESC LIMIT 48;

DO $$
DECLARE t0 timestamptz; res numeric[] := '{}';
BEGIN
  FOR i IN 1..5 LOOP
    t0 := clock_timestamp();
    PERFORM * FROM (
      SELECT v.id, v.created_at,
             (SELECT COUNT(*) FROM views WHERE video_id=v.id)::int AS vc,
             (SELECT COUNT(*) FROM likes WHERE video_id=v.id AND vote=1)::int AS uc
        FROM videos v LEFT JOIN categories c ON c.id=v.category_id
        LEFT JOIN users u ON u.id=v.uploaded_by
       WHERE v.is_private = FALSE AND v.is_flagged = FALSE
       ORDER BY v.created_at DESC LIMIT 48) q;
    res := res || round((EXTRACT(epoch FROM clock_timestamp()-t0)*1000)::numeric, 2);
  END LOOP;
  RAISE NOTICE 'FASE 3 - tempi delle 5 esecuzioni (ms): %', res;
END $$;

-- ---------------------------------------------------------------------------
--  FASE 4 - Indice parziale, allineato al predicato del feed
-- ---------------------------------------------------------------------------
\echo ''
\echo '=========== FASE 4 - INDICE PARZIALE ==========='

DROP INDEX idx_videos_created_at;
CREATE INDEX idx_videos_created_at ON videos (created_at DESC)
  WHERE is_private = FALSE AND is_flagged = FALSE;
ANALYZE videos;

SELECT pg_size_pretty(pg_relation_size('idx_videos_created_at')) AS dimensione_indice_parziale;

EXPLAIN (ANALYZE, BUFFERS)
SELECT v.id, v.youtube_id, v.title, v.thumbnail_url, v.created_at,
       c.name AS category_name, c.id AS category_id,
       u.username AS uploaded_by_username, u.is_verified AS uploaded_by_verified,
       (SELECT COUNT(*) FROM views WHERE video_id=v.id)::int AS views_count,
       (SELECT COUNT(*) FROM likes WHERE video_id=v.id AND vote=1)::int AS useful_count
  FROM videos v LEFT JOIN categories c ON c.id=v.category_id
  LEFT JOIN users u ON u.id=v.uploaded_by
 WHERE v.is_private = FALSE AND v.is_flagged = FALSE
 ORDER BY v.created_at DESC LIMIT 48;

DO $$
DECLARE t0 timestamptz; res numeric[] := '{}';
BEGIN
  FOR i IN 1..5 LOOP
    t0 := clock_timestamp();
    PERFORM * FROM (
      SELECT v.id, v.created_at,
             (SELECT COUNT(*) FROM views WHERE video_id=v.id)::int AS vc,
             (SELECT COUNT(*) FROM likes WHERE video_id=v.id AND vote=1)::int AS uc
        FROM videos v LEFT JOIN categories c ON c.id=v.category_id
        LEFT JOIN users u ON u.id=v.uploaded_by
       WHERE v.is_private = FALSE AND v.is_flagged = FALSE
       ORDER BY v.created_at DESC LIMIT 48) q;
    res := res || round((EXTRACT(epoch FROM clock_timestamp()-t0)*1000)::numeric, 2);
  END LOOP;
  RAISE NOTICE 'FASE 4 - tempi delle 5 esecuzioni (ms): %', res;
END $$;

-- ---------------------------------------------------------------------------
--  FASE 5 - Pulizia
-- ---------------------------------------------------------------------------
\echo ''
\echo '=========== FASE 5 - PULIZIA ==========='

DELETE FROM videos WHERE youtube_id LIKE 'ZZSEED%';
ANALYZE videos;

SELECT count(*) AS video_rimasti FROM videos;

\echo ''
\echo 'Fatto. L indice idx_videos_created_at resta creato.'
\echo 'Per rimuoverlo:  DROP INDEX idx_videos_created_at;'
