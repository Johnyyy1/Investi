// Demo sessions are one-time: a fixed 24 hours from the start, never extended by use. Guest sessions still extend.
// Runs against a fresh local server and its disposable database; time is simulated by moving session timestamps.
import "dotenv/config";
import assert from "node:assert/strict";
import postgres from "postgres";

const baseURL = process.env.DEMO_SESSION_TEST_URL;
const local = (url) => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
assert.ok(baseURL && local(baseURL), "DEMO_SESSION_TEST_URL must be a local server.");
assert.ok(process.env.DATABASE_URL && local(process.env.DATABASE_URL), "DATABASE_URL must be the server's local database.");
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const HOUR = 60 * 60 * 1000, DAY = 24 * HOUR;
const users = [];

async function signInAnonymous(kind) {
  const response = await fetch(`${baseURL}/api/auth/sign-in/anonymous`, {
    method: "POST",
    headers: { origin: baseURL, "content-type": "application/json", ...(kind === "guest" ? { "x-investi-anonymous-kind": "guest" } : {}) },
    body: "{}",
  });
  assert.equal(response.status, 200, `${kind} sign-in`);
  const cookie = response.headers.getSetCookie().map((header) => header.split(";")[0]).join("; ");
  const { user } = await response.json();
  users.push(user.id);
  return { userId: user.id, cookie };
}
const getSession = async (cookie) => (await fetch(`${baseURL}/api/auth/get-session`, { headers: { cookie } })).json();
const row = async (userId) => (await sql`select created_at, expires_at from session where user_id = ${userId}`)[0];
const hoursAfterStart = (session) => (session.expires_at - session.created_at) / HOUR;
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 0.01, `${label}: ${actual} h, expected ${expected} h`);

try {
  // 1. A demo starts with 24 hours and using it does not extend them.
  const demo = await signInAnonymous("demo");
  near(hoursAfterStart(await row(demo.userId)), 24, "new demo");
  assert.equal((await getSession(demo.cookie))?.user?.id, demo.userId);
  near(hoursAfterStart(await row(demo.userId)), 24, "demo after a refresh");

  // 2. Late in the day it is still valid, still capped at its start + 24 h.
  await sql`update session set created_at = now() - interval '23 hours', expires_at = now() + interval '1 hour' where user_id = ${demo.userId}`;
  assert.equal((await getSession(demo.cookie))?.user?.id, demo.userId, "valid within its 24 hours");
  near(hoursAfterStart(await row(demo.userId)), 24, "demo near its end");

  // 3. After 24 hours it is over and the session is removed.
  await sql`update session set created_at = now() - interval '25 hours', expires_at = now() - interval '1 hour' where user_id = ${demo.userId}`;
  assert.equal(await getSession(demo.cookie), null, "an expired demo is signed out");
  assert.equal(await row(demo.userId), undefined, "the expired demo session is deleted");
  console.log("PASS: a demo session lasts a fixed 24 hours from its start; use does not extend it, and it ends afterwards.");

  // 4. A demo extended before this change ends no later than its next request.
  const legacy = await signInAnonymous("demo");
  await sql`update session set created_at = now() - interval '3 days', expires_at = now() + interval '5 days' where user_id = ${legacy.userId}`;
  await getSession(legacy.cookie);
  assert.ok((await row(legacy.userId)).expires_at < new Date(), "the refresh caps it at its original end");
  assert.equal(await getSession(legacy.cookie), null, "and the following request is signed out");
  console.log("PASS: a previously extended demo is capped at its original end on its next request.");

  // 5. Guests are real learners: their sessions keep extending while used.
  const guest = await signInAnonymous("guest");
  near(hoursAfterStart(await row(guest.userId)), 7 * 24, "new guest");
  await sql`update session set created_at = now() - interval '3 days', expires_at = now() + interval '1 day' where user_id = ${guest.userId}`;
  assert.equal((await getSession(guest.cookie))?.user?.id, guest.userId);
  const refreshed = await row(guest.userId);
  assert.ok(refreshed.expires_at - Date.now() > 6.9 * DAY, "a used guest session extends to seven days from now");
  console.log("PASS: guest sessions still extend while used.");
} finally {
  if (users.length) await sql`delete from "user" where id in ${sql(users)}`;
  await sql.end();
}
