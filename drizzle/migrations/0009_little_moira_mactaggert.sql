CREATE TABLE "user_access_control" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"subscription_id" text,
	"has_access" boolean DEFAULT false,
	"access_level" text DEFAULT 'basic',
	"grace_period_end" timestamp,
	"features" json DEFAULT '{}'::json,
	"last_access_check" timestamp DEFAULT now(),
	"access_granted_at" timestamp,
	"access_revoked_at" timestamp,
	"status_flag" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "thrivecard_payment_id" text;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "thrivecard_customer_id" text;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "payment_provider" text DEFAULT 'thrivecard';--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "webhook_source" text;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "thrivecard_customer_id" text;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "thrivecard_subscription_id" text;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "plan_type" text;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "plan_name" text;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "grace_period_end" timestamp;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "access_level" text DEFAULT 'basic';--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "features" json DEFAULT '{}'::json;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "auto_renew" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "is_trial" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "trial_end_date" timestamp;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "last_payment_date" timestamp;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "next_payment_date" timestamp;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "payment_method" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_active" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "activation_status" text DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "deactivated_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "last_active_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "supabase_user_id" uuid;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "raw_user_meta_data" json DEFAULT '{}'::json;--> statement-breakpoint
ALTER TABLE "user_access_control" ADD CONSTRAINT "user_access_control_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_access_control" ADD CONSTRAINT "user_access_control_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE set null ON UPDATE no action;