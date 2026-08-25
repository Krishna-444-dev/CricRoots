# Minimal deployment plan: mobile-only pilot

**Goal**: one friend, on cellular data, in a different city, scores a full match on CricRoots.
Nothing more. Everything not required for that is deferred.

**Scope decision (made 2026-08-18)**: the pilot is **mobile-only**. The web app is not deployed.
See §6 for what that costs and what it defers.

Derived from an audit of `going-legal-and-live.md` against the repository. Every claim below was
checked in code, not assumed. **Nothing here is implemented** — production remains frozen until
this plan is agreed.

---

## 1. What has to exist outside the repo

| # | Thing | Notes |
|---|---|---|
| 1 | Hosting account + small VPS | Hetzner (~$5-8/mo) or Railway. Needs to be your account. |
| 2 | MongoDB Atlas cluster, free tier | Create DB user; whitelist the VPS IP (or 0.0.0.0/0 initially, tightened after). |
| 3 | DNS: **`api.cricroots.com`** → VPS IP | **Not optional and not a free choice of name.** `mobile-app/src/shared/api/apiClient.ts:23` hardcodes `https://api.cricroots.com/api` as the non-dev fallback. Any other hostname requires a code change. |
| 4 | Let's Encrypt cert for that hostname | The checked-in `ssl/cert.pem` is self-signed, `CN=localhost`, `O=CricSync Dev`. A phone will refuse it. |

---

## 2. Repository changes required — small, but real

These are **not** covered by `DEPLOYMENT.md` as written.

**a. `docker-compose.yml` currently hardcodes the local Mongo.** Line 41:

```
MONGO_URI: mongodb://${MONGO_ROOT_USER:-admin}:${MONGO_ROOT_PASSWORD:-password}@mongodb:27017/cricsync?authSource=admin
```

For Atlas this must become overridable (`MONGO_URI: ${MONGO_URI}`), and the local `mongodb`
service plus the backend's `depends_on` should be dropped in the production compose. Otherwise the
server runs an unnecessary Mongo with `admin`/`password` defaults *alongside* Atlas.

**b. `nginx.conf` uses `server_name _`** (catch-all) and points `ssl_certificate` at
`/etc/nginx/ssl/cert.pem`. Needs the real hostname and the Let's Encrypt paths. Routing itself is
already correct: `/api/` → backend, `/socket.io` → backend, `/uploads/` → backend.

**c. Uploads volume must persist.** Group-chat attachments are served from `/uploads/` off a
Docker volume. On a fresh server that volume starts empty — fine — but it must not be recreated on
redeploy or attachments vanish.

---

## 3. Environment variables — two that will bite

`.env.example` lists 20 keys. Two behave in ways that are not obvious:

**`JWT_SECRET` — the server will refuse to start without it.** Phase 0 added
`backend/src/config/assertSecrets.js`, which fails the boot in production if `JWT_SECRET` is unset
or still the placeholder. This is correct behaviour, but on a remote server it looks like "the
container keeps dying" rather than a config error. Check logs first if that happens.

**`FRONTEND_URL` — inconsistent between HTTP and WebSocket, and worth setting even for a
mobile-only pilot.**

| Path | Behaviour when `FRONTEND_URL` is unset in production |
|---|---|
| Express (`app.js:25-32`) | `resolveCorsOrigin()` returns `false` — no `Access-Control-Allow-Origin` header emitted |
| Socket.IO (`index.js:21-23`) | falls back to `'*'` — fully permissive |

**Practical effect on this pilot: probably none.** React Native's `fetch` does not send an `Origin`
header and does not enforce CORS, so mobile requests should pass regardless. **But it is a
latent trap**: the API would appear to work perfectly from phones while being unusable from *any*
browser, and that only surfaces later when the web app or a browser test arrives. Set
`FRONTEND_URL` anyway, and treat the Express/Socket.IO mismatch as a known inconsistency to
reconcile before the web app is deployed.

---

## 4. Sequence

1. Provision VPS + Atlas cluster.
2. Point `api.cricroots.com` at the VPS.
3. Apply the §2 repo changes on a branch; do **not** merge to master until step 7 passes.
4. Issue the Let's Encrypt cert for `api.cricroots.com`.
5. Deploy; confirm the backend actually booted (see the `JWT_SECRET` note above).
6. **Merge `instrumentation/unbackfillable-capture` — before the acceptance test, not after.**
   Its research-safety gate is green (D8, amended). It must land here rather than later for two
   reasons: the acceptance test in step 7 is the *only* end-to-end scoring run before real users
   arrive, so it is the one chance to verify the capture works through the real mobile UI rather
   than only through unit tests; and every match scored without it loses per-ball state and MOTM
   provenance permanently.
7. **Acceptance test — the whole point of this plan:** publish an EAS update with
   `EXPO_PUBLIC_API_URL` **unset**, so `resolveBaseUrl()` uses the production fallback. Then, on a
   phone **on cellular data with Wi-Fi off**, open the published link in Expo Go, register an
   account, create a team, and score a full match end to end.
   **Then check the stored match**: every ball has `runsBefore`/`wicketsBefore`/`legalBallsBefore`,
   and completing it sets `manOfTheMatchComputed` and `manOfTheMatchSource`. Unit tests cover the
   controller; this covers the client actually reaching it.
8. Only after step 7: share the link with one remote friend.

**Step 7 is the gate.** Publishing with `EXPO_PUBLIC_API_URL` still set to a LAN IP produces a
bundle that works on your Wi-Fi and silently blank-screens everywhere else — the exact failure
already recorded in `going-legal-and-live.md`. Turning Wi-Fi off is the cheapest way to prove the
bundle is genuinely portable, and it must be done before anyone else is invited.

---

## 5. Legal — one item is a blocker, the rest are not

`web-app/app/privacy` and `web-app/app/terms` exist. The `User` model collects **email addresses**,
and grassroots cricket means **minors are plausibly among the players**.

Collecting identifiable personal data — some potentially from under-13s — with no legal entity
behind the privacy policy is the one Track A item that should precede real users, not follow them.
LLC + EIN is ~$200-350 and a few days. Insurance, business banking, and Tech E&O can wait for
payments.

---

## 6. What this plan deliberately defers, and what that costs

**The web app is not deployed.** There is no `web-app/Dockerfile`, no web-app service in
`docker-compose.yml`, and `nginx.conf` ends with `location / { return 404; }`.

Consequence: **`cricroots.com` has nothing behind it.** Only `api.cricroots.com` exists. Anyone who
types the bare domain — including a curious club official — gets nothing.

Options, in ascending cost: leave it unpointed; put a static one-page holding site on it (cheap,
recommended); or deploy the Next.js app (a real piece of work, and not needed for scoring).

Also deferred: app store submission (Expo Go is sufficient for a pilot), monitoring beyond a free
UptimeRobot ping, and the per-ball schema change — which is **not** a deployment dependency but
**is** a hard prerequisite before the first real match is scored, since it cannot be backfilled.
