CREATE TABLE "failover_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "chat_id" text,
  "original_model_id" text NOT NULL,
  "final_provider" text NOT NULL,
  "model_attempt_count" integer NOT NULL,
  "primary_succeeded" boolean NOT NULL,
  "total_provider_attempt_count" integer NOT NULL,
  "fallback_chain" jsonb NOT NULL,
  CONSTRAINT "failover_events_chat_id_chat_id_fk"
    FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id")
    ON DELETE set null ON UPDATE no action
);

CREATE INDEX "failover_events_created_at_primary_succeeded_idx"
  ON "failover_events" USING btree ("created_at", "primary_succeeded");
