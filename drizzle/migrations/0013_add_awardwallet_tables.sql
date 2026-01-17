CREATE TABLE "awardwallet_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"aw_user_id" text NOT NULL,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"last_synced_at" timestamp,
	"status" text DEFAULT 'connected' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "awardwallet_connections_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "loyalty_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"provider_code" text NOT NULL,
	"provider_name" text NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"balance_unit" text DEFAULT 'points' NOT NULL,
	"elite_status" text,
	"expiration_date" timestamp,
	"account_number" text,
	"logo_url" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "password_reset_history" ADD COLUMN "resend_email_id" text;--> statement-breakpoint
ALTER TABLE "password_reset_history" ADD COLUMN "resend_status" text;--> statement-breakpoint
ALTER TABLE "password_reset_history" ADD COLUMN "resend_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "awardwallet_connections" ADD CONSTRAINT "awardwallet_connections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_connection_id_awardwallet_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."awardwallet_connections"("id") ON DELETE cascade ON UPDATE no action;