# Ownership, licence and trademark

Investník is proprietary. [LICENSE](../LICENSE) reserves all rights to the code, the curriculum and lesson content, the illustrations, the brand assets and the documentation. It grants no licence, so a public repository does not make them reusable. `package.json` declares `"license": "UNLICENSED"`, the npm value for a package nobody may reuse; together with `"private": true` it can never be published to the registry.

The copyright holder is Jonas Sobotka until the company exists. As of 2026-10-22, all human-authored commits on `main` are his, under two Git e-mail identities. The remaining commits are AI-assisted (`Claude`) and Dependabot dependency bumps. No third party has contributed code or content that needs a separate agreement. Keep it that way, or sign an agreement before merging outside work.

The licence does not cover:

- npm dependencies, which keep their own licences (`package-lock.json` records each one);
- Manrope and Inter, loaded through `next/font` under the SIL Open Font License. The brand SVGs contain outlined glyphs from them, which that licence permits;
- third-party data loaded at runtime. FMP data must never be committed ([market-data.md](market-data.md)), and TickerInside data carries its own attribution.

## Remaining steps

Code cannot complete these. They belong to [#357](https://github.com/Johnyyy1/Investnik/issues/357), and the operator details in [#68](https://github.com/Johnyyy1/Investnik/issues/68) depend on step 2.

1. **Repository visibility.** Decide between a private repository and a public one under the proprietary licence. The issue recommends private until the business model is clear. A public repository exposes the curriculum, the architecture and the commit history to anyone, even though they may not reuse them. Before switching, check what the current GitHub plan allows for private repositories (Actions minutes, branch protection and rulesets) and that the Vercel and Dependabot integrations keep working.
2. **Rights to the company.** After the s.r.o. is founded, move the rights to the code and content to it with a written agreement. Czech copyright law (zákon č. 121/2000 Sb.) treats the author's economic rights differently from ordinary property, so have a lawyer choose the form, for example an exclusive licence or an in-kind contribution (nepeněžitý vklad). Then change the copyright line in LICENSE and this page to the company.
3. **Trademark „Investník“.** Search existing marks in the ÚPV database and TMview, choose the Nice classes (for example 9, 41 and 42 for software, education and an online service) and file with ÚPV (Czech Republic) or EUIPO (EU), ideally in the company's name. Check current fees and procedures on the offices' own sites. Until registration, never mark the name with ®.
