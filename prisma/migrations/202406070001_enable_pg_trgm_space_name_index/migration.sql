CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

CREATE INDEX IF NOT EXISTS space_name_trgm_idx
  ON "space"
  USING gin (lower(name) gin_trgm_ops);
