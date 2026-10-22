CREATE TABLE "analytics_early_return" (
	"user_id" text PRIMARY KEY NOT NULL,
	"returned_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_landing_view_day" (
	"day" date PRIMARY KEY NOT NULL,
	"views" integer NOT NULL,
	CONSTRAINT "analytics_landing_view_day_views_check" CHECK ("analytics_landing_view_day"."views" >= 1)
);
--> statement-breakpoint
ALTER TABLE "analytics_early_return" ADD CONSTRAINT "analytics_early_return_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;