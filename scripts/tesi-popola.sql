-- Inserisce 50.000 video sintetici, per misurare i tempi di risposta
-- degli endpoint con un catalogo a regime (Capitolo 5, Sezione 5.3).
-- Per rimuoverli:  psql -f scripts/tesi-pulisci.sql
DO $$
DECLARE uids int[]; cids int[];
BEGIN
  SELECT COALESCE(array_agg(id), ARRAY[]::int[]) INTO uids FROM users;
  SELECT COALESCE(array_agg(id), ARRAY[]::int[]) INTO cids FROM categories;
  INSERT INTO videos (youtube_id, title, description,
                      uploaded_by, category_id, is_private, is_flagged, created_at)
  SELECT 'ZZSEED' || lpad(g::text, 11, '0'),
         'Video sintetico numero ' || g,
         'Riga generata per la valutazione delle prestazioni.',
         CASE WHEN cardinality(uids) > 0 THEN uids[1 + (g % cardinality(uids))] END,
         CASE WHEN cardinality(cids) > 0 THEN cids[1 + (g % cardinality(cids))] END,
         (g % 20 = 0), (g % 33 = 0),
         NOW() - (g || ' minutes')::interval
    FROM generate_series(1, 50000) g;
END $$;
ANALYZE videos;
SELECT count(*) AS video_totali,
       count(*) FILTER (WHERE is_private = FALSE AND is_flagged = FALSE) AS video_pubblici
  FROM videos;
