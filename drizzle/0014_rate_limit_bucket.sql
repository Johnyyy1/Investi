CREATE TABLE "rate_limit_bucket" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "rate_limit_bucket_count_check" CHECK ("rate_limit_bucket"."count" >= 1),
	CONSTRAINT "rate_limit_bucket_window_check" CHECK ("rate_limit_bucket"."expires_at" > "rate_limit_bucket"."window_started_at"),
	CONSTRAINT "rate_limit_bucket_key_length_check" CHECK (length("rate_limit_bucket"."key") <= 256)
);
--> statement-breakpoint
CREATE INDEX "rate_limit_bucket_expires_at_idx" ON "rate_limit_bucket" USING btree ("expires_at");