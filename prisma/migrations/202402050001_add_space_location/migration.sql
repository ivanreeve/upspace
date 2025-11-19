ALTER TABLE "space"
  ADD COLUMN IF NOT EXISTS location geography(Point, 4326);

UPDATE "space"
SET location = ST_SetSRID(ST_MakePoint("long"::double precision, "lat"::double precision), 4326)
WHERE location IS NULL
  AND "lat" IS NOT NULL
  AND "long" IS NOT NULL;

CREATE INDEX IF NOT EXISTS space_location_idx
  ON "space"
  USING GIST (location);
