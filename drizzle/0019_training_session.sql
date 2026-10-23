CREATE TABLE "training_action" (
	"session_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"month" integer NOT NULL,
	"kind" text NOT NULL,
	"amount_minor" bigint,
	"quantity" numeric(24, 8),
	"created_at" timestamp with time zone NOT NULL,
	"client_idempotency_key" text NOT NULL,
	CONSTRAINT "training_action_session_id_sequence_pk" PRIMARY KEY("session_id","sequence"),
	CONSTRAINT "training_action_kind_check" CHECK (("training_action"."kind" = 'buy' and "training_action"."amount_minor" > 0 and "training_action"."quantity" is null)
    or ("training_action"."kind" = 'sell' and "training_action"."quantity" > 0 and "training_action"."amount_minor" is null)
    or ("training_action"."kind" = 'advance' and "training_action"."amount_minor" is null and "training_action"."quantity" is null)),
	CONSTRAINT "training_action_sequence_check" CHECK ("training_action"."sequence" >= 0 and "training_action"."month" >= 0)
);
--> statement-breakpoint
CREATE TABLE "training_session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"scenario_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ips_artifact_id" text,
	"plan" jsonb NOT NULL,
	"series" jsonb NOT NULL,
	"fee_profile_id" text NOT NULL,
	"initial_capital_minor" bigint NOT NULL,
	"request_id" text NOT NULL,
	CONSTRAINT "training_session_initial_capital_check" CHECK ("training_session"."initial_capital_minor" > 0)
);
--> statement-breakpoint
ALTER TABLE "training_action" ADD CONSTRAINT "training_action_session_id_training_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."training_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session" ADD CONSTRAINT "training_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session" ADD CONSTRAINT "training_session_ips_artifact_id_learner_artifact_id_fk" FOREIGN KEY ("ips_artifact_id") REFERENCES "public"."learner_artifact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "training_action_idempotency_idx" ON "training_action" USING btree ("session_id","client_idempotency_key");--> statement-breakpoint
CREATE INDEX "training_session_user_started_idx" ON "training_session" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "training_session_user_request_idx" ON "training_session" USING btree ("user_id","request_id");