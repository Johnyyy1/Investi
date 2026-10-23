CREATE TYPE "public"."skill_attempt_context" AS ENUM('lesson', 'checkpoint', 'review');--> statement-breakpoint
CREATE TABLE "skill_attempt" (
	"user_id" text NOT NULL,
	"request_id" text NOT NULL,
	"skill_id" text NOT NULL,
	"item_id" text NOT NULL,
	"correct" boolean NOT NULL,
	"context" "skill_attempt_context" NOT NULL,
	"attempted_at" timestamp with time zone NOT NULL,
	CONSTRAINT "skill_attempt_user_id_request_id_pk" PRIMARY KEY("user_id","request_id")
);
--> statement-breakpoint
ALTER TABLE "skill_attempt" ADD CONSTRAINT "skill_attempt_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "skill_attempt_user_skill_idx" ON "skill_attempt" USING btree ("user_id","skill_id","attempted_at");