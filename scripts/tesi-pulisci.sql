-- Rimuove i video sintetici inseriti da scripts/tesi-popola.sql
DELETE FROM videos WHERE youtube_id LIKE 'ZZSEED%';
ANALYZE videos;
SELECT count(*) AS video_rimasti FROM videos;
