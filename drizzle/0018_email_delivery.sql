CREATE TYPE "public"."email_delivery_status" AS ENUM('queued', 'sent', 'failed', 'delivered', 'bounced', 'complained');--> statement-breakpoint
CREATE TABLE "email_delivery" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"provider" text NOT NULL,
	"provider_message_id" text,
	"status" "email_delivery_status" DEFAULT 'queued' NOT NULL,
	"error_code" text,
	"address_epoch" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_delivery_provider_message_id_unique" UNIQUE("provider_message_id")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "email_delivery_epoch" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "email_delivery" ADD CONSTRAINT "email_delivery_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_delivery_user_idx" ON "email_delivery" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "email_delivery_created_idx" ON "email_delivery" USING btree ("created_at");