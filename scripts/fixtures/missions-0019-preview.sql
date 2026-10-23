CREATE TABLE "mission_attempt" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mission_id" text NOT NULL,
	"request_id" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"completed" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mission_attempt" ADD CONSTRAINT "mission_attempt_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mission_attempt_request_idx" ON "mission_attempt" USING btree ("user_id","mission_id","request_id");--> statement-breakpoint
CREATE INDEX "mission_attempt_completion_idx" ON "mission_attempt" USING btree ("user_id","mission_id","completed");