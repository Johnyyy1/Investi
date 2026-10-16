import type { DiagnosticResult } from "../features/personalization/diagnostic";
import { sql } from "drizzle-orm";
import { experienceValues, goalValues, interestValues } from "../features/onboarding/domain";
import {
  boolean,
  bigint,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const progressStatus = pgEnum("progress_status", [
  "not_started",
  "in_progress",
  "completed",
]);

// Better Auth tables remain separate from the learning domain tables.
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  /** Anonymous identities only: "guest" learns before saving an account, "demo" gets seeded sample data.
   * NULL on anonymous rows created before this column means demo. */
  anonymousKind: text("anonymous_kind"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
}, (table) => [
  check("user_anonymous_kind_check", sql`${table.anonymousKind} is null or (${table.isAnonymous} and ${table.anonymousKind} in ('demo', 'guest'))`),
]);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const learningModule = pgTable(
  "learning_module",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    position: integer("position").notNull(),
    isPublished: boolean("is_published").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [uniqueIndex("learning_module_slug_idx").on(table.slug)],
);

export const lesson = pgTable(
  "lesson",
  {
    id: text("id").primaryKey(),
    moduleId: text("module_id").notNull().references(() => learningModule.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    position: integer("position").notNull(),
    estimatedMinutes: integer("estimated_minutes").notNull(),
    contentVersion: integer("content_version").notNull().default(1),
    isPublished: boolean("is_published").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("lesson_module_slug_idx").on(table.moduleId, table.slug),
    index("lesson_module_position_idx").on(table.moduleId, table.position),
  ],
);

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id").notNull().references(() => lesson.id, { onDelete: "cascade" }),
    status: progressStatus("status").notNull().default("not_started"),
    lastPosition: integer("last_position").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.lessonId] }),
    index("lesson_progress_user_idx").on(table.userId),
  ],
);

export const experienceLevelEnum = pgEnum("experience_level", experienceValues);
export const learningGoalEnum = pgEnum("learning_goal", goalValues);
export const learningInterestEnum = pgEnum("learning_interest", interestValues);
export const recommendedStartEnum = pgEnum("recommended_start", ["returns", "investing-foundations"]);

/** One learning profile per account; nullable answers allow resumable onboarding. */
export const learningProfile = pgTable("learning_profile", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  experienceLevel: experienceLevelEnum("experience_level"),
  goals: learningGoalEnum("goals").array().notNull().default([]),
  interests: learningInterestEnum("interests").array().notNull().default([]),
  dailyGoalMinutes: integer("daily_goal_minutes"),
  timeZone: text("time_zone"),
  recommendedStart: recommendedStartEnum("recommended_start"),
  onboardingStep: integer("onboarding_step").notNull().default(0),
  diagnosticResult: jsonb("diagnostic_result").$type<DiagnosticResult>(),
  personalizedOnboardingCompletedAt: timestamp("personalized_onboarding_completed_at", { withTimezone: true }),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Completion receipt and learning-day ledger. One lifetime award per lesson per learner. */
export const lessonAward = pgTable("lesson_award", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  lessonId: text("lesson_id").notNull().references(() => lesson.id, { onDelete: "cascade" }),
  xp: integer("xp").notNull(),
  practiceCapitalMinor: bigint("practice_capital_minor", { mode: "bigint" }).notNull(),
  rewardPolicyVersion: integer("reward_policy_version").notNull(),
  learningDate: date("learning_date").notNull(),
  timeZone: text("time_zone").notNull(),
  awardedAt: timestamp("awarded_at", { withTimezone: true }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.lessonId] }),
  index("lesson_award_user_date_idx").on(table.userId, table.learningDate),
  check("lesson_award_xp_check", sql`${table.xp} = 60`),
  check("lesson_award_practice_capital_nonnegative_check", sql`${table.practiceCapitalMinor} >= 0`),
  check("lesson_award_reward_policy_version_positive_check", sql`${table.rewardPolicyVersion} > 0`),
]);

/** Durable Lab entitlement and its one-time Practice Capital contribution. */
export const progressionUnlock = pgTable("progression_unlock", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  unlockId: text("unlock_id").notNull(),
  practiceCapitalMinor: bigint("practice_capital_minor", { mode: "bigint" }).notNull().default(sql`0`),
  reason: text("reason").notNull(),
  unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.unlockId] }),
  check("progression_unlock_capital_nonnegative_check", sql`${table.practiceCapitalMinor} >= 0`),
]);

export const portfolioTradeSide = pgEnum("portfolio_trade_side", ["BUY", "SELL"]);

/** One auditable sandbox generation. Closed generations and their trades are retained. */
export const portfolio = pgTable("portfolio", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  baseCurrency: text("base_currency").notNull().default("CZK"),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  resetFromPortfolioId: text("reset_from_portfolio_id").references((): AnyPgColumn => portfolio.id, { onDelete: "set null" }),
  resetIdempotencyKey: text("reset_idempotency_key"),
  openingCapitalMinor: bigint("opening_capital_minor", { mode: "bigint" }).notNull(),
}, (table) => [
  index("portfolio_user_opened_idx").on(table.userId, table.openedAt),
  uniqueIndex("portfolio_one_active_per_user_idx").on(table.userId).where(sql`${table.closedAt} is null`),
  uniqueIndex("portfolio_reset_idempotency_idx").on(table.userId, table.resetIdempotencyKey),
  check("portfolio_base_currency_check", sql`${table.baseCurrency} in ('CZK', 'USD', 'EUR')`),
  check("portfolio_opening_capital_nonnegative_check", sql`${table.openingCapitalMinor} >= 0`),
  check("portfolio_closed_after_opened_check", sql`${table.closedAt} is null or ${table.closedAt} >= ${table.openedAt}`),
  check("portfolio_reset_not_self_check", sql`${table.resetFromPortfolioId} is null or ${table.resetFromPortfolioId} <> ${table.id}`),
]);

/** Append-only execution ledger. Numeric strings preserve PostgreSQL decimal precision. */
export const portfolioTrade = pgTable("portfolio_trade", {
  id: text("id").primaryKey(),
  portfolioId: text("portfolio_id").notNull().references(() => portfolio.id, { onDelete: "cascade" }),
  instrumentId: text("instrument_id").notNull(),
  instrumentSymbol: text("instrument_symbol").notNull(),
  instrumentName: text("instrument_name").notNull(),
  instrumentAssetType: text("instrument_asset_type").notNull(),
  side: portfolioTradeSide("side").notNull(),
  quantity: numeric("quantity", { precision: 24, scale: 8 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 24, scale: 8 }).notNull(),
  quoteCurrency: text("quote_currency").notNull(),
  fxRateToBase: numeric("fx_rate_to_base", { precision: 24, scale: 12 }).notNull(),
  grossAmountBaseMinor: bigint("gross_amount_base_minor", { mode: "bigint" }).notNull(),
  feeBaseMinor: bigint("fee_base_minor", { mode: "bigint" }).notNull().default(sql`0`),
  cashDeltaBaseMinor: bigint("cash_delta_base_minor", { mode: "bigint" }).notNull(),
  quoteObservedAt: timestamp("quote_observed_at", { withTimezone: true }).notNull(),
  executedAt: timestamp("executed_at", { withTimezone: true }).notNull(),
  marketDataProvider: text("market_data_provider").notNull(),
  marketDataDataset: text("market_data_dataset").notNull(),
  marketDataKind: text("market_data_kind").notNull(),
  marketDataIsDeterministic: boolean("market_data_is_deterministic").notNull(),
  /** Nullable only for executions created before separate FX provenance was introduced. */
  fxRateProvider: text("fx_rate_provider"),
  fxRateDataset: text("fx_rate_dataset"),
  fxRateKind: text("fx_rate_kind"),
  fxRateIsDeterministic: boolean("fx_rate_is_deterministic"),
  fxReferenceDate: date("fx_reference_date"),
  fxRateRetrievedAt: timestamp("fx_rate_retrieved_at", { withTimezone: true }),
  clientIdempotencyKey: text("client_idempotency_key").notNull(),
}, (table) => [
  index("portfolio_trade_portfolio_executed_idx").on(table.portfolioId, table.executedAt),
  uniqueIndex("portfolio_trade_idempotency_idx").on(table.portfolioId, table.clientIdempotencyKey),
  check("portfolio_trade_quantity_positive_check", sql`${table.quantity} > 0`),
  check("portfolio_trade_unit_price_positive_check", sql`${table.unitPrice} > 0`),
  check("portfolio_trade_fx_positive_check", sql`${table.fxRateToBase} > 0`),
  check("portfolio_trade_gross_positive_check", sql`${table.grossAmountBaseMinor} > 0`),
  check("portfolio_trade_fee_nonnegative_check", sql`${table.feeBaseMinor} >= 0`),
  check("portfolio_trade_currency_check", sql`${table.quoteCurrency} in ('CZK', 'USD', 'EUR')`),
  check("portfolio_trade_asset_type_check", sql`${table.instrumentAssetType} in ('equity', 'etf', 'bond', 'cash', 'index')`),
  check("portfolio_trade_data_kind_check", sql`${table.marketDataKind} in ('synthetic', 'historical', 'live')`),
  check("portfolio_trade_fx_provenance_complete_check", sql`(
    (${table.fxRateProvider} is null and ${table.fxRateDataset} is null and ${table.fxRateKind} is null and ${table.fxRateIsDeterministic} is null and ${table.fxReferenceDate} is null and ${table.fxRateRetrievedAt} is null)
    or (${table.fxRateProvider} is not null and ${table.fxRateDataset} is not null and ${table.fxRateKind} is not null and ${table.fxRateIsDeterministic} is not null and ${table.fxReferenceDate} is not null and ${table.fxRateRetrievedAt} is not null)
  )`),
  check("portfolio_trade_fx_kind_check", sql`${table.fxRateKind} is null or ${table.fxRateKind} in ('synthetic', 'reference')`),
  check("portfolio_trade_cash_delta_check", sql`(
    (${table.side} = 'BUY' and ${table.cashDeltaBaseMinor} = -(${table.grossAmountBaseMinor} + ${table.feeBaseMinor}))
    or (${table.side} = 'SELL' and ${table.cashDeltaBaseMinor} = ${table.grossAmountBaseMinor} - ${table.feeBaseMinor})
  )`),
]);

/**
 * Append-only target mixes ("Uložit portfolio"). Each saved version records the learner's
 * intended weights and the trades it executed through the ordinary ledger; the latest version
 * of the active generation is the current target. It holds no balance: cash, holdings and
 * valuation are still derived from receipts and trades only.
 */
export const portfolioAllocation = pgTable("portfolio_allocation", {
  id: text("id").primaryKey(),
  portfolioId: text("portfolio_id").notNull().references(() => portfolio.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  cashWeightBasisPoints: integer("cash_weight_basis_points").notNull(),
  /** Audit snapshot of the portfolio value the weights were applied to; never read back as a balance. */
  appliedValueMinor: bigint("applied_value_minor", { mode: "bigint" }).notNull(),
  clientIdempotencyKey: text("client_idempotency_key").notNull(),
}, (table) => [
  index("portfolio_allocation_portfolio_created_idx").on(table.portfolioId, table.createdAt),
  uniqueIndex("portfolio_allocation_idempotency_idx").on(table.portfolioId, table.clientIdempotencyKey),
  check("portfolio_allocation_cash_weight_check", sql`${table.cashWeightBasisPoints} between 0 and 10000`),
  check("portfolio_allocation_applied_value_check", sql`${table.appliedValueMinor} >= 0`),
]);

export const portfolioAllocationLine = pgTable("portfolio_allocation_line", {
  allocationId: text("allocation_id").notNull(),
  position: integer("position").notNull(),
  instrumentId: text("instrument_id").notNull(),
  instrumentSymbol: text("instrument_symbol").notNull(),
  instrumentName: text("instrument_name").notNull(),
  instrumentAssetType: text("instrument_asset_type").notNull(),
  quoteCurrency: text("quote_currency").notNull(),
  weightBasisPoints: integer("weight_basis_points").notNull(),
}, (table) => [
  primaryKey({ columns: [table.allocationId, table.instrumentId] }),
  foreignKey({ name: "portfolio_allocation_line_allocation_fk", columns: [table.allocationId], foreignColumns: [portfolioAllocation.id] }).onDelete("cascade"),
  uniqueIndex("portfolio_allocation_line_position_idx").on(table.allocationId, table.position),
  check("portfolio_allocation_line_weight_check", sql`${table.weightBasisPoints} between 1 and 10000`),
  check("portfolio_allocation_line_asset_type_check", sql`${table.instrumentAssetType} in ('equity', 'etf', 'bond')`),
  check("portfolio_allocation_line_currency_check", sql`${table.quoteCurrency} in ('CZK', 'USD', 'EUR')`),
]);

/**
 * Shared, cross-instance cache of normalized market data (instrument metadata, quotes, history,
 * fundamentals, ETF datasets, FX). Purely derived from providers and safe to truncate at any time.
 * It is not user-owned, so it never cascades with user deletion. Rows past expires_at are never
 * served and are purged opportunistically; format_version retires rows written by older code.
 */
export const marketDataCache = pgTable("market_data_cache", {
  family: text("family").notNull(),
  cacheKey: text("cache_key").notNull(),
  formatVersion: integer("format_version").notNull(),
  value: jsonb("value").$type<unknown>().notNull(),
  storedAt: timestamp("stored_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.family, table.cacheKey] }),
  index("market_data_cache_expires_at_idx").on(table.expiresAt),
  check("market_data_cache_expiry_check", sql`${table.expiresAt} > ${table.storedAt}`),
  check("market_data_cache_key_length_check", sql`length(${table.cacheKey}) <= 512`),
]);

/**
 * Shared, cross-instance fixed-window rate-limit counters for auth endpoints and market-data reads.
 * Keys are a readable scope plus an HMAC of the subject (IP, account or user), so no raw IP address
 * or e-mail is stored. Rows past expires_at are restarted on the next hit and purged opportunistically;
 * the table holds no authoritative data and is safe to truncate at any time.
 */
export const rateLimitBucket = pgTable("rate_limit_bucket", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => [
  index("rate_limit_bucket_expires_at_idx").on(table.expiresAt),
  check("rate_limit_bucket_count_check", sql`${table.count} >= 1`),
  check("rate_limit_bucket_window_check", sql`${table.expiresAt} > ${table.windowStartedAt}`),
  check("rate_limit_bucket_key_length_check", sql`length(${table.key}) <= 256`),
]);
