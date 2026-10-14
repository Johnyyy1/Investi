-- Lesson 1 "Spoření vs. investování" now has three steps (positions 0–2).
-- Idempotent: saved positions past the last step move to the last step; completion status and receipts are untouched.
UPDATE "lesson_progress" SET "last_position" = 2 WHERE "lesson_id" = 'foundations-why-invest' AND "last_position" > 2;--> statement-breakpoint
UPDATE "lesson" SET "estimated_minutes" = 5, "summary" = 'Proč peníze v obálce časem ztrácejí hodnotu a co s tím má investování.', "content_version" = "content_version" + 1, "updated_at" = now()
WHERE "id" = 'foundations-why-invest' AND "estimated_minutes" <> 5;
