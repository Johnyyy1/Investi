import "dotenv/config";
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
try {
  // An explicit marker, never an email pattern, controls deletion. Dry-run is the default.
  const [{ count }] = await sql`select count(*)::int as count from "user" where is_anonymous = true and created_at < now() - interval '7 days'`;
  if (process.argv.includes("--apply")) {
    const removed = await sql`delete from "user" where is_anonymous = true and created_at < now() - interval '7 days' returning id`;
    console.log(`Removed ${removed.length} expired anonymous (demo and guest) identities and their cascading learning/session data.`);
  } else console.log(`${count} anonymous (demo and guest) identities older than 7 days are eligible. Run with --apply to remove them.`);
} finally { await sql.end(); }
