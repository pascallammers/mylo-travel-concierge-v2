CREATE TABLE IF NOT EXISTS "thrivecart_transaction" (
  "id" text PRIMARY KEY NOT NULL,
  "event_id" text NOT NULL UNIQUE,
  "base_product" text,
  "transaction_date" timestamp NOT NULL,
  "transaction_type" text NOT NULL,
  "item_type" text,
  "item_id" text,
  "amount" integer NOT NULL,
  "currency" text NOT NULL DEFAULT 'EUR',
  "order_id" text,
  "invoice_id" text,
  "processor" text,
  "customer_name" text,
  "customer_email" text NOT NULL,
  "reference" text,
  "raw_data" json,
  "imported_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "thrivecart_import_state" (
  "id" text PRIMARY KEY DEFAULT 'singleton',
  "last_import_at" timestamp NOT NULL DEFAULT now(),
  "last_event_id" text,
  "total_imported" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'idle',
  "last_error" text
);

-- Indexes for KPI queries
CREATE INDEX IF NOT EXISTS "idx_tc_txn_date" ON "thrivecart_transaction" ("transaction_date");
CREATE INDEX IF NOT EXISTS "idx_tc_txn_type" ON "thrivecart_transaction" ("transaction_type");
CREATE INDEX IF NOT EXISTS "idx_tc_txn_email" ON "thrivecart_transaction" ("customer_email");
CREATE INDEX IF NOT EXISTS "idx_tc_txn_order" ON "thrivecart_transaction" ("order_id");

-- Seed the singleton import state row
INSERT INTO "thrivecart_import_state" ("id", "status") VALUES ('singleton', 'idle') ON CONFLICT DO NOTHING;
