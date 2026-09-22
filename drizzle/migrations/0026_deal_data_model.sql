ALTER TABLE "flight_deals" ADD COLUMN "program_id" text;--> statement-breakpoint
ALTER TABLE "flight_deals" ADD COLUMN "program_reachable_dach" boolean;--> statement-breakpoint
ALTER TABLE "flight_deals" ADD COLUMN "taxes_amount" real;--> statement-breakpoint
ALTER TABLE "flight_deals" ADD COLUMN "taxes_currency" varchar(3);--> statement-breakpoint
ALTER TABLE "flight_deals" ADD COLUMN "taxes_eur" real;--> statement-breakpoint
ALTER TABLE "flight_deals" ADD COLUMN "seats_left" integer;--> statement-breakpoint
ALTER TABLE "flight_deals" ADD COLUMN "cash_reference_price" real;--> statement-breakpoint
ALTER TABLE "flight_deals" ADD COLUMN "cash_reference_samples" integer;--> statement-breakpoint
ALTER TABLE "flight_deals" ADD COLUMN "valuation_rate_ct" real;--> statement-breakpoint
ALTER TABLE "flight_deals" ADD COLUMN "valuation_rate_valid_from" timestamp;--> statement-breakpoint
ALTER TABLE "flight_deals" ADD COLUMN "savings_percent" real;--> statement-breakpoint
CREATE INDEX "flight_deals_savings_idx" ON "flight_deals" USING btree ("source","savings_percent");--> statement-breakpoint
-- New base routes (priority 1, 'basis'): FRA/MUC/ZRH x {SIN, LAX, MLE, CPT, HND} + MUC-JFK, MUC-DXB.
INSERT INTO "deal_routes" ("id", "origin", "destination", "priority", "source", "is_active")
SELECT gen_random_uuid()::text, v.origin, v.destination, 1, 'basis', true
FROM (VALUES
  ('FRA', 'SIN'), ('FRA', 'LAX'), ('FRA', 'MLE'), ('FRA', 'CPT'), ('FRA', 'HND'),
  ('MUC', 'SIN'), ('MUC', 'LAX'), ('MUC', 'MLE'), ('MUC', 'CPT'), ('MUC', 'HND'),
  ('MUC', 'JFK'), ('MUC', 'DXB'),
  ('ZRH', 'SIN'), ('ZRH', 'LAX'), ('ZRH', 'MLE'), ('ZRH', 'CPT'), ('ZRH', 'HND')
) AS v("origin", "destination")
WHERE NOT EXISTS (
  SELECT 1 FROM "deal_routes" r
  WHERE r."origin" = v."origin" AND r."destination" = v."destination"
);