CREATE TABLE "portfolio_allocation" (
	"id" text PRIMARY KEY NOT NULL,
	"portfolio_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"cash_weight_basis_points" integer NOT NULL,
	"applied_value_minor" bigint NOT NULL,
	"client_idempotency_key" text NOT NULL,
	CONSTRAINT "portfolio_allocation_cash_weight_check" CHECK ("portfolio_allocation"."cash_weight_basis_points" between 0 and 10000),
	CONSTRAINT "portfolio_allocation_applied_value_check" CHECK ("portfolio_allocation"."applied_value_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "portfolio_allocation_line" (
	"allocation_id" text NOT NULL,
	"position" integer NOT NULL,
	"instrument_id" text NOT NULL,
	"instrument_symbol" text NOT NULL,
	"instrument_name" text NOT NULL,
	"instrument_asset_type" text NOT NULL,
	"quote_currency" text NOT NULL,
	"weight_basis_points" integer NOT NULL,
	CONSTRAINT "portfolio_allocation_line_allocation_id_instrument_id_pk" PRIMARY KEY("allocation_id","instrument_id"),
	CONSTRAINT "portfolio_allocation_line_weight_check" CHECK ("portfolio_allocation_line"."weight_basis_points" between 1 and 10000),
	CONSTRAINT "portfolio_allocation_line_asset_type_check" CHECK ("portfolio_allocation_line"."instrument_asset_type" in ('equity', 'etf', 'bond')),
	CONSTRAINT "portfolio_allocation_line_currency_check" CHECK ("portfolio_allocation_line"."quote_currency" in ('CZK', 'USD', 'EUR'))
);
--> statement-breakpoint
ALTER TABLE "portfolio_allocation" ADD CONSTRAINT "portfolio_allocation_portfolio_id_portfolio_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_allocation_line" ADD CONSTRAINT "portfolio_allocation_line_allocation_fk" FOREIGN KEY ("allocation_id") REFERENCES "public"."portfolio_allocation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "portfolio_allocation_portfolio_created_idx" ON "portfolio_allocation" USING btree ("portfolio_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "portfolio_allocation_idempotency_idx" ON "portfolio_allocation" USING btree ("portfolio_id","client_idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "portfolio_allocation_line_position_idx" ON "portfolio_allocation_line" USING btree ("allocation_id","position");