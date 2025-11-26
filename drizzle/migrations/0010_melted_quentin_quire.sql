CREATE TABLE "kb_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"gemini_file_name" text NOT NULL,
	"gemini_file_uri" text NOT NULL,
	"display_name" text NOT NULL,
	"original_file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"status" text DEFAULT 'uploading' NOT NULL,
	"status_message" text,
	"indexed_at" timestamp,
	"chunk_count" integer,
	"confidence_threshold" integer DEFAULT 70,
	"uploaded_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "kb_documents" ADD CONSTRAINT "kb_documents_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_kb_documents_status" ON "kb_documents" ("status") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX "idx_kb_documents_gemini_name" ON "kb_documents" ("gemini_file_name");