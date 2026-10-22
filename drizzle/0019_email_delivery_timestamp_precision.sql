ALTER TABLE "email_delivery" ALTER COLUMN "address_epoch" SET DATA TYPE timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "email_delivery_epoch" SET DATA TYPE timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "email_delivery_epoch" SET DEFAULT now();