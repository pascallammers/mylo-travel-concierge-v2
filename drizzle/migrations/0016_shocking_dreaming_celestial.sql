CREATE TABLE "deal_routes" (
	"id" text PRIMARY KEY NOT NULL,
	"origin" varchar(3) NOT NULL,
	"destination" varchar(3),
	"priority" integer DEFAULT 5 NOT NULL,
	"source" text DEFAULT 'basis' NOT NULL,
	"user_count" integer DEFAULT 0 NOT NULL,
	"last_scanned_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flight_deals" (
	"id" text PRIMARY KEY NOT NULL,
	"origin" varchar(3) NOT NULL,
	"destination" varchar(3) NOT NULL,
	"destination_name" text,
	"departure_date" timestamp NOT NULL,
	"return_date" timestamp,
	"price" real NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"average_price" real,
	"price_difference" real,
	"price_change_percent" real,
	"deal_score" integer DEFAULT 0 NOT NULL,
	"airline" text,
	"stops" integer DEFAULT 0,
	"flight_duration" integer,
	"cabin_class" text DEFAULT 'economy' NOT NULL,
	"trip_type" text DEFAULT 'roundtrip' NOT NULL,
	"affiliate_link" text,
	"categories" json DEFAULT '[]'::json,
	"source" text DEFAULT 'travelpayouts' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"id" text PRIMARY KEY NOT NULL,
	"origin" varchar(3) NOT NULL,
	"destination" varchar(3) NOT NULL,
	"price" real NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"cabin_class" text DEFAULT 'economy' NOT NULL,
	"source" text DEFAULT 'travelpayouts' NOT NULL,
	"scanned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "thrivecart_import_state" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"last_import_at" timestamp DEFAULT now() NOT NULL,
	"last_event_id" text,
	"total_imported" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'idle' NOT NULL,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "thrivecart_transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"base_product" text,
	"transaction_date" timestamp NOT NULL,
	"transaction_type" text NOT NULL,
	"item_type" text,
	"item_id" text,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"order_id" text,
	"invoice_id" text,
	"processor" text,
	"customer_name" text,
	"customer_email" text NOT NULL,
	"reference" text,
	"raw_data" json,
	"imported_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "thrivecart_transaction_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "user_deal_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"origin_airports" json DEFAULT '[]'::json,
	"preferred_destinations" json DEFAULT '[]'::json,
	"cabin_class" text DEFAULT 'economy',
	"max_price" real,
	"email_digest" text DEFAULT 'none' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_deal_preferences" ADD CONSTRAINT "user_deal_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deal_routes_active_priority_idx" ON "deal_routes" USING btree ("is_active","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "flight_deals_route_date_cabin_uniq" ON "flight_deals" USING btree ("origin","destination","departure_date","cabin_class");--> statement-breakpoint
CREATE INDEX "flight_deals_origin_expires_idx" ON "flight_deals" USING btree ("origin","expires_at");--> statement-breakpoint
CREATE INDEX "flight_deals_score_idx" ON "flight_deals" USING btree ("deal_score");--> statement-breakpoint
CREATE INDEX "price_history_route_scanned_idx" ON "price_history" USING btree ("origin","destination","scanned_at");