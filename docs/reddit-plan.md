# Plan: community build knowledge from r/Gunpla

**Goal:** per-kit build experience (stability, loose joints, ABS cracking, beginner-friendliness) to replace the estimated scores that were removed. Every value must come from real community posts; nothing is invented.

## What Reddit allows (checked 2026-10-18)

| Check | Result |
|---|---|
| `reddit.com/robots.txt` | `User-agent: *` / `Disallow: /`, pointing to Reddit's [Public Content Policy](https://support.reddithelp.com/hc/en-us/articles/26410290525844-Public-Content-Policy) |
| Unauthenticated JSON (`/r/Gunpla/top.json`) | HTTP 403 for an honest client |
| Official Data API | OAuth app required, which means a Reddit account. Free tier covers non-commercial and academic use. Commercial use, which includes a site carrying affiliate links, needs a separate agreement with Reddit. Third-party summaries put the rate limit at 60–100 requests/min per client; Reddit's own docs were not reachable from here, so verify before building. |
| Data handling | Reddit's terms require removing content when users delete it. Training ML models on user content needs the rightsholders' permission. |

**Conclusion:** scraping r/Gunpla without an account is off-limits (robots.txt plus a 403). Any automated collection needs a Reddit account, a registered OAuth app and, for this project's eventual affiliate use, a commercial agreement.

## Options

### A. Link out (shipped now, no account, no data collected)
Each kit drawer has a "Discuss on r/Gunpla" link: a Reddit search for the kit's official name or JAN, restricted to r/Gunpla. No Reddit content is stored or shown.

### B. Official Data API, aggregates only (needs your Reddit account and, for commercial use, Reddit's agreement)
1. Register a "script" app at reddit.com/prefs/apps and keep the credentials in `.env.local` (never committed).
2. Add an ingest adapter `scripts/ingest/reddit.ts`:
   - query r/Gunpla search per kit (official name, item code, JAN) at ≤1 request/second
   - store **post IDs, scores, timestamps and permalinks only**
3. Derive per-kit **signals**, not text, using transparent keyword rules: count of threads mentioning "hand grenade" / "loose" / "ABS crack" / "first kit". Show them as counts linked to the threads (for example "12 threads mention loose joints →"), never as an invented score.
4. Re-check stored post IDs on each run and drop deleted posts, as the terms require.
5. Validation, in the same spirit as the JAN audit: every displayed signal must link to at least one live thread.

### C. Community submissions (no Reddit account; needs somewhere to store submissions)
Let visitors attach a thread URL to a kit, and show the link only after a second visitor confirms it is about that kit. This needs a small shared store, such as an artifact database or a GitHub PR to a JSON file.

## Recommendation
Ship **A** now (done). Do **B** only if you're willing to create a Reddit account and keep the use non-commercial or get Reddit's agreement. Keep estimated build scores out of the app either way.
