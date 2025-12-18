CREATE TABLE "password_reset_history" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"sent_by" text,
	"trigger_type" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"error_message" text
);
--> statement-breakpoint
ALTER TABLE "password_reset_history" ADD CONSTRAINT "password_reset_history_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_history" ADD CONSTRAINT "password_reset_history_sent_by_user_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;