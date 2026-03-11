CREATE TABLE "failed_search_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"user_id" text NOT NULL,
	"query_text" text NOT NULL,
	"extracted_origin" text,
	"extracted_destination" text,
	"depart_date" text,
	"return_date" text,
	"cabin" text,
	"result_count" integer DEFAULT 0 NOT NULL,
	"error_type" text,
	"error_message" text,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "thrivecart_sync_log" (
	"id" text PRIMARY KEY NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"total_checked" integer DEFAULT 0,
	"total_corrected" integer DEFAULT 0,
	"total_errors" integer DEFAULT 0,
	"details" json,
	"status" text DEFAULT 'running' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "thrivecart_webhook_log" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"event_id" text,
	"order_id" text,
	"customer_email" text NOT NULL,
	"payload" json,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	"result" text NOT NULL,
	"error_message" text
);
--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "sync_source" text;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "last_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "failed_search_logs" ADD CONSTRAINT "failed_search_logs_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "failed_search_logs" ADD CONSTRAINT "failed_search_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;