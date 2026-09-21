CREATE TYPE "public"."transfer_check_outcome" AS ENUM('unchanged', 'applied', 'held', 'source_error');--> statement-breakpoint
CREATE TABLE "transfer_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_program_id" text NOT NULL,
	"partner_key" text NOT NULL,
	"source_points" integer NOT NULL,
	"partner_units" integer NOT NULL,
	"min_transfer" integer NOT NULL,
	"transfer_increment" integer NOT NULL,
	"transfer_duration_de" text NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone,
	"origin" text NOT NULL,
	"check_id" uuid,
	CONSTRAINT "transfer_rates_positive_values" CHECK ("transfer_rates"."source_points" > 0 AND "transfer_rates"."partner_units" > 0 AND "transfer_rates"."min_transfer" > 0 AND "transfer_rates"."transfer_increment" > 0),
	CONSTRAINT "transfer_rates_source_valid" CHECK ("transfer_rates"."source_program_id" IN ('amex_dach', 'payback')),
	CONSTRAINT "transfer_rates_origin_valid" CHECK ("transfer_rates"."origin" IN ('seed', 'check'))
);
--> statement-breakpoint
CREATE TABLE "transfer_table_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_program_id" text NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	"outcome" "transfer_check_outcome" NOT NULL,
	"changes" jsonb NOT NULL,
	"error" text,
	"resolution" text,
	"resolved_at" timestamp with time zone,
	"resolved_by" text,
	CONSTRAINT "transfer_checks_source_valid" CHECK ("transfer_table_checks"."source_program_id" IN ('amex_dach', 'payback')),
	CONSTRAINT "transfer_checks_resolution_valid" CHECK ("transfer_table_checks"."resolution" IS NULL OR ("transfer_table_checks"."outcome" = 'held' AND "transfer_table_checks"."resolution" IN ('approved', 'rejected')))
);
--> statement-breakpoint
ALTER TABLE "transfer_rates" ADD CONSTRAINT "transfer_rates_check_id_transfer_table_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."transfer_table_checks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "transfer_rates_current_unique" ON "transfer_rates" USING btree ("source_program_id","partner_key") WHERE "transfer_rates"."valid_to" IS NULL;--> statement-breakpoint
CREATE INDEX "transfer_checks_source_date_idx" ON "transfer_table_checks" USING btree ("source_program_id","checked_at");