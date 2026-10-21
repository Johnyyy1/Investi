CREATE TYPE "public"."learner_artifact_kind" AS ENUM('goal_map', 'financial_checkup', 'fee_profile', 'etf_checklist', 'safeguards', 'investment_plan', 'trade_checklist', 'business_map', 'investment_thesis', 'journal');--> statement-breakpoint
CREATE TABLE "learner_artifact" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" "learner_artifact_kind" NOT NULL,
	"version" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_lesson_id" text,
	"request_id" text NOT NULL,
	CONSTRAINT "learner_artifact_version_positive" CHECK ("learner_artifact"."version" > 0),
	CONSTRAINT "learner_artifact_payload_object" CHECK (jsonb_typeof("learner_artifact"."payload") = 'object')
);
--> statement-breakpoint
ALTER TABLE "learner_artifact" ADD CONSTRAINT "learner_artifact_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_artifact" ADD CONSTRAINT "learner_artifact_source_lesson_id_lesson_id_fk" FOREIGN KEY ("source_lesson_id") REFERENCES "public"."lesson"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "learner_artifact_user_kind_version_idx" ON "learner_artifact" USING btree ("user_id","kind","version");--> statement-breakpoint
CREATE UNIQUE INDEX "learner_artifact_user_request_idx" ON "learner_artifact" USING btree ("user_id","request_id");