ALTER TABLE "learning_profile" ADD COLUMN "broker_fee_profile_id" text;--> statement-breakpoint
ALTER TABLE "portfolio_trade" ADD COLUMN "fee_profile_id" text;--> statement-breakpoint
ALTER TABLE "portfolio_trade" ADD COLUMN "trade_fee_rate_bps" integer;--> statement-breakpoint
ALTER TABLE "portfolio_trade" ADD COLUMN "trade_fee_min_minor" bigint;--> statement-breakpoint
ALTER TABLE "portfolio_trade" ADD COLUMN "trade_fee_max_minor" bigint;--> statement-breakpoint
ALTER TABLE "portfolio_trade" ADD COLUMN "trade_fee_currency" text;--> statement-breakpoint
ALTER TABLE "portfolio_trade" ADD COLUMN "fx_markup_bps" integer;--> statement-breakpoint
ALTER TABLE "portfolio_trade" ADD COLUMN "fx_markup_base_minor" bigint;--> statement-breakpoint
ALTER TABLE "portfolio_trade" ADD COLUMN "reference_fx_rate_to_base" numeric(24, 12);--> statement-breakpoint
ALTER TABLE "portfolio_trade" ADD COLUMN "reference_gross_amount_base_minor" bigint;--> statement-breakpoint
ALTER TABLE "portfolio_trade" ADD CONSTRAINT "portfolio_trade_cost_audit_check" CHECK ((
    ("portfolio_trade"."fee_profile_id" is null and "portfolio_trade"."trade_fee_rate_bps" is null and "portfolio_trade"."trade_fee_min_minor" is null and "portfolio_trade"."trade_fee_max_minor" is null and "portfolio_trade"."trade_fee_currency" is null and "portfolio_trade"."fx_markup_bps" is null and "portfolio_trade"."fx_markup_base_minor" is null and "portfolio_trade"."reference_fx_rate_to_base" is null and "portfolio_trade"."reference_gross_amount_base_minor" is null)
    or ("portfolio_trade"."fee_profile_id" is not null and "portfolio_trade"."trade_fee_rate_bps" is not null and "portfolio_trade"."trade_fee_rate_bps" >= 0
      and "portfolio_trade"."trade_fee_min_minor" is not null and "portfolio_trade"."trade_fee_min_minor" >= 0
      and "portfolio_trade"."trade_fee_max_minor" is not null and "portfolio_trade"."trade_fee_max_minor" >= "portfolio_trade"."trade_fee_min_minor"
      and "portfolio_trade"."trade_fee_currency" is not null and "portfolio_trade"."trade_fee_currency" = 'CZK'
      and "portfolio_trade"."fx_markup_bps" is not null and "portfolio_trade"."fx_markup_bps" >= 0 and "portfolio_trade"."fx_markup_bps" < 10000
      and "portfolio_trade"."fx_markup_base_minor" is not null and "portfolio_trade"."fx_markup_base_minor" >= 0
      and "portfolio_trade"."reference_fx_rate_to_base" is not null and "portfolio_trade"."reference_fx_rate_to_base" > 0
      and "portfolio_trade"."reference_gross_amount_base_minor" is not null and "portfolio_trade"."reference_gross_amount_base_minor" > 0
      and (("portfolio_trade"."side" = 'BUY' and "portfolio_trade"."gross_amount_base_minor" = "portfolio_trade"."reference_gross_amount_base_minor" + "portfolio_trade"."fx_markup_base_minor")
        or ("portfolio_trade"."side" = 'SELL' and "portfolio_trade"."gross_amount_base_minor" = "portfolio_trade"."reference_gross_amount_base_minor" - "portfolio_trade"."fx_markup_base_minor")))
  ));