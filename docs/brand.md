# Brand and domain

The product is **Investník**, a free Czech investing-education platform at **https://investnik.cz**. Until 2026-10-21 it was called investi and ran at `https://tryinvesti.vercel.app`. [terminology.md](terminology.md) has the spelling and declension rules, [DESIGN.md](../DESIGN.md) the visual system.

## Name

- Visible copy always says **Investník**, with the accent and a capital I. It declines as an inanimate noun: „v Investníku“, „pravidla Investníku“, „napříč Investníkem“.
- `investnik` without diacritics is for the domain, technical identifiers, slugs and filenames (`investnik-moje-data-2026-10-21.json`). „Investnik“ never appears in visible copy.
- `src/lib/site.ts` holds `BRAND_NAME`, `SITE_URL`, `SITE_HOST` and the default description. Metadata, structured data, the manifest and e-mails read them there.
- `src/lib/terminology.test.ts` fails on the former name in copy and on „Investnik“ outside identifiers.

The positioning line is „Nauč se investovat. Od základů po vlastní plán.“ It names the first milestone, a learner's own investment plan, and promises no returns. The landing hero („Peníze jsou vážné. Učení nemusí být.“) is unchanged.

## Wordmark and symbol

The symbol is the í of the wordmark: a stem and a rising acute on an Action Teal tile. The accent is what Czech readers notice in the name, and the rising stroke reads as progress without becoming a chart.

The wordmark is the symbol plus „Investník“ in Manrope ExtraBold (800) with -0.035em tracking. In the app it is the `Wordmark` component (`src/components/brand/wordmark.tsx`): live text, so diacritics render with the loaded Manrope `latin-ext` subset, and a symbol sized in em, so each placement keeps its existing font-size class. A link around it names its target in `aria-label`: „Investník · úvodní stránka“ or „Investník · Učení“. E-mails use a text wordmark because clients block images.

| File | Use |
| --- | --- |
| `public/brand/investnik-symbol.svg` | Symbol on a rounded tile. Source of `src/app/icon.svg`, the favicon and the PWA `any` icons |
| `public/brand/investnik-symbol-maskable.svg` | Full-bleed tile with the glyph inside the maskable safe zone. Source of the maskable and Apple touch icons |
| `public/brand/investnik-wordmark.svg` | Lockup for light backgrounds (ink text) |
| `public/brand/investnik-wordmark-dark.svg` | Lockup for dark backgrounds (paper text, Graphic Teal tile) |
| `public/brand/investnik-og.svg` | 1200×630 social image source with the guide illustration `12-compounding` |
| `src/app/icon.svg` | Browser tab icon |
| `src/app/favicon.ico` | 16/32/48 px fallback |
| `src/app/apple-icon.png` | 180 px iOS home screen icon |
| `public/brand/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | Manifest icons |
| `src/app/opengraph-image.png` + `.alt.txt` | Open Graph and X card image for every route |

The SVG text is outlined (Manrope and Inter glyph paths), so the files render without web fonts. After changing an SVG source, regenerate the rasters with `BROWSER_CHANNEL=chrome npm run brand:assets` and commit them. The colours are the token anchors: Action Teal `#236F66`, Graphic Teal `#2F8F83`, Ink `#171717`, Paper `#F7F2E8`.

## Domain and SEO

- `metadataBase` is `https://investnik.cz`. The landing page, `/privacy`, `/terms` and `/sign-in` declare canonical URLs.
- `www.investnik.cz` answers with a 308 to the same path and query on the apex (`canonicalHostRedirects` in `src/lib/site.ts`, applied by `next.config.ts`). The rule matches that host only. Localhost, `tryinvesti.vercel.app` and preview URLs are not redirected by code.
- `robots.txt` allows indexing on production and on deployments outside Vercel, and disallows everything when `VERCEL_ENV` is `preview` or `development`. `/api/` and `/dev/` are always disallowed.
- Signed-in routes (`(app)` layout), onboarding and one-off auth steps (forgot/reset password, e-mail verification) carry `noindex, nofollow`.
- Those noindex routes stay out of `robots.txt` on purpose. A crawler only sees `noindex` on a page it may fetch, and a blocked URL can still be indexed without content from links such as the landing page's „Začít se učit“ → `/onboarding`. `src/lib/site.test.ts` keeps them crawlable (#49).
- `sitemap.xml` lists the landing page and the two legal pages.
- The landing page emits JSON-LD for `Organization` and `WebSite`. It describes the product only: the operator's legal identity is still a placeholder in `src/components/legal/legal-page.tsx`.
- `manifest.webmanifest` installs the app as „Investník“ with start URL `/learn`. There is no service worker, so no cached assets need invalidating.

## Identifiers that keep the old name

These are persisted, shared with tests or relied on by tooling. Renaming them would break saved data or continuity, so they stay:

- browser storage: `investi-personalization-v1:*` (sessionStorage onboarding drafts), `investi-personalization-prompt:*` (localStorage);
- database values: market-data and FX provider `investi-deterministic`, `investi-identity`, dataset `investi-education-market-v1`, fee profiles `investi-standard-v1` and `investi-low-fx-v1` (their display names now say Investník);
- the account-export `format: "investi-account-export"` field, which API consumers may check;
- the request header `x-investi-anonymous-kind`, DOM events `investi:*`, CSS hooks `.investi-theme`, `.investi-range`, `--font-investi-*`, `data-investi-*`;
- log prefixes `[investi:*]` and `INVESTI_PERF_DEBUG`, so existing log queries keep working;
- QA database names (`investi_ci`, `investi_6a3a_qa`, …), `/tmp/investi-*` screenshot folders, `public/investi-assets`, `investi-design.pen` and its Pen board names;
- the GitHub repository `Johnyyy1/investi` and the npm package name (no runtime effect).

Archived documents in `docs/archive`, the performance log and the research brief keep the old name as historical records.

## Rollout checklist

Code cannot complete these steps. Do them in this order and verify each before the next.

1. **Vercel domains.** Add `investnik.cz` and `www.investnik.cz` to the production project. Set `investnik.cz` as the primary domain and configure `www.investnik.cz` as a 308 redirect to it. The app redirects `www` too, so a missed setting does not split the site.
2. **DNS.** At the `.cz` registrar, create exactly the records the Vercel dashboard shows for the apex and for `www`, and wait until Vercel reports both domains valid with issued certificates. Remove conflicting parking records.
3. **Production environment.** Set `BETTER_AUTH_URL=https://investnik.cz` for Production only and redeploy. Better Auth trusts only this origin for its CSRF/origin check, and OAuth callbacks and reset/verification links derive from it. Preview keeps its own value, so previews never get production credentials or links. While the old host still serves pages (step 7), also set `BETTER_AUTH_TRUSTED_ORIGINS=https://tryinvesti.vercel.app`, a comma-separated list that Better Auth reads itself, so e-mail sign-in and saving guest progress keep working there. Social sign-in started on the old host cannot finish there, because its callback runs on the new origin.
4. **Google OAuth** (if enabled): add the authorized redirect URI `https://investnik.cz/api/auth/callback/google` and JavaScript origin `https://investnik.cz`. Rename the consent screen to Investník and set the home page, `https://investnik.cz/privacy` and `https://investnik.cz/terms`. Add `investnik.cz` as an authorized domain, which needs Search Console verification. Keep the old URIs until the cutover is verified.
5. **Facebook Login** (if enabled): add the valid OAuth redirect URI `https://investnik.cz/api/auth/callback/facebook`. Set App Domains to `investnik.cz` and update the site URL, the display name, the privacy policy URL and the data deletion URL.
6. **Resend.** Verify a sending domain for `investnik.cz` (or a subdomain), using the DKIM, SPF and return-path records Resend shows. Add a DMARC record (`_dmarc`), starting with `p=none` and a reporting address you control. Then set `EMAIL_FROM="Investník <address@your-verified-domain>"`. Choose the address yourself: the repository assumes none. Send a reset e-mail to yourself and check the sender name with its accent. Use `Investnik` in the display name only if a client renders the accent incorrectly.
7. **Old domain.** When steps 1–6 work, configure `tryinvesti.vercel.app` in Vercel as a 308 redirect to `https://investnik.cz`, keeping the path. Code deliberately does not do this, so deploying it before DNS is ready cannot break production.
8. **Search Console.** Verify `investnik.cz` as a Domain property, submit `https://investnik.cz/sitemap.xml`, and check that the canonical and Open Graph tags resolve. The old domain is a Vercel subdomain, so Change of Address is not available. The 308 and canonical tags carry the move.
9. **GitHub (optional).** Rename the repository and update its description and homepage to `https://investnik.cz`. GitHub forwards the old URL, but update local remotes. Rename the Vercel project if you want; its name does not affect the domain.

## Session impact

Cookies belong to the host. After step 7, signed-in learners on `tryinvesti.vercel.app` arrive at `investnik.cz` without a session cookie and must sign in again. Their accounts, progress, receipts and portfolios are untouched. **Guests and demo users have no credentials:** a guest's learning stays attached to a cookie on the old host (7-day sessions) and cannot follow the redirect. Before step 7, keep the old domain serving for at least seven days with `BETTER_AUTH_TRUSTED_ORIGINS` set (step 3), and ideally announce the move, so guests can save their progress to an account. Remove `BETTER_AUTH_TRUSTED_ORIGINS` after the redirect is live.
