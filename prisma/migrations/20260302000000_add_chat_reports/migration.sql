-- Prisma Migrate: Add chat moderation reports for conversation reporting workflows

BEGIN;

CREATE TYPE chat_report_reason AS ENUM ('harassment', 'scam', 'spam', 'inappropriate', 'other');
CREATE TYPE chat_report_status AS ENUM ('pending', 'resolved', 'dismissed');

CREATE TABLE chat_report (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL,
  reporter_id BIGINT NOT NULL,
  reported_user_id BIGINT NOT NULL,
  reason chat_report_reason NOT NULL,
  details TEXT,
  status chat_report_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ(6),
  processed_by_user_id BIGINT,
  resolution_note TEXT,
  CONSTRAINT chat_report_room_fk
    FOREIGN KEY (room_id) REFERENCES chat_room (id)
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT chat_report_reporter_fk
    FOREIGN KEY (reporter_id) REFERENCES "user" (user_id)
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT chat_report_reported_user_fk
    FOREIGN KEY (reported_user_id) REFERENCES "user" (user_id)
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT chat_report_processed_by_fk
    FOREIGN KEY (processed_by_user_id) REFERENCES "user" (user_id)
    ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX idx_chat_report_room_created ON chat_report (room_id, created_at DESC);
CREATE INDEX idx_chat_report_reporter_created ON chat_report (reporter_id, created_at DESC);
CREATE INDEX idx_chat_report_status_created ON chat_report (status, created_at);

COMMIT;
