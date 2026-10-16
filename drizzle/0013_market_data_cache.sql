CREATE TABLE "market_data_cache" (
	"family" text NOT NULL,
	"cache_key" text NOT NULL,
	"format_version" integer NOT NULL,
	"value" jsonb NOT NULL,
	"stored_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "market_data_cache_family_cache_key_pk" PRIMARY KEY("family","cache_key"),
	CONSTRAINT "market_data_cache_expiry_check" CHECK ("market_data_cache"."expires_at" > "market_data_cache"."stored_at"),
	CONSTRAINT "market_data_cache_key_length_check" CHECK (length("market_data_cache"."cache_key") <= 512)
);
--> statement-breakpoint
CREATE INDEX "market_data_cache_expires_at_idx" ON "market_data_cache" USING btree ("expires_at");