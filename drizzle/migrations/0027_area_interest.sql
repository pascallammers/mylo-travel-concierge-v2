CREATE TABLE "area_interest" (
	"user_id" text NOT NULL,
	"area_slug" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "area_interest_user_id_area_slug_pk" PRIMARY KEY("user_id","area_slug")
);
--> statement-breakpoint
ALTER TABLE "area_interest" ADD CONSTRAINT "area_interest_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;