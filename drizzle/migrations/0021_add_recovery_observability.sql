ALTER TABLE "failover_events" ADD COLUMN "stream_id" text;
ALTER TABLE "failover_events" ADD COLUMN "user_id" text;
ALTER TABLE "failover_events" ADD COLUMN "recovery_used" boolean DEFAULT false NOT NULL;

CREATE INDEX "failover_events_created_at_recovery_used_idx"
  ON "failover_events" USING btree ("created_at", "recovery_used");
