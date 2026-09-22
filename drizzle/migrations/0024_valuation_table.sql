CREATE TABLE "valuation_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" text NOT NULL,
	"anchor" text NOT NULL,
	"cabin" text NOT NULL,
	"cents_per_unit" numeric(6, 3) NOT NULL,
	"source" text NOT NULL,
	"source_url" text,
	"source_as_of" date NOT NULL,
	"review_due" date NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone,
	"origin" text NOT NULL,
	"created_by" text,
	"note" text,
	CONSTRAINT "valuation_rates_positive_value" CHECK ("valuation_rates"."cents_per_unit" > 0),
	CONSTRAINT "valuation_rates_anchor_valid" CHECK ("valuation_rates"."anchor" IN ('travel', 'no_plan')),
	CONSTRAINT "valuation_rates_cabin_valid" CHECK ("valuation_rates"."cabin" IN ('all', 'economy', 'premium_economy', 'business', 'first')),
	CONSTRAINT "valuation_rates_origin_valid" CHECK ("valuation_rates"."origin" IN ('seed', 'admin')),
	CONSTRAINT "valuation_rates_no_plan_cabin" CHECK ("valuation_rates"."anchor" = 'travel' OR "valuation_rates"."cabin" = 'all')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "valuation_rates_current_unique" ON "valuation_rates" USING btree ("program_id","anchor","cabin") WHERE "valuation_rates"."valid_to" IS NULL;--> statement-breakpoint
CREATE INDEX "valuation_rates_program_valid_to_idx" ON "valuation_rates" USING btree ("program_id","valid_to");