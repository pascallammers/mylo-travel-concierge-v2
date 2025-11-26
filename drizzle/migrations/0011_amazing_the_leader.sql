ALTER TABLE "kb_documents" ADD COLUMN "file_search_store_name" text;--> statement-breakpoint
ALTER TABLE "kb_documents" ADD COLUMN "file_search_document_name" text;--> statement-breakpoint
ALTER TABLE "kb_documents" ADD COLUMN "file_search_indexed_at" timestamp;