# Going Legal and Going Live

A practical checklist for the two things that have to happen before CricRoots can run a real pilot
season with real clubs: forming a legal entity, and getting the app onto real infrastructure.
Written after the market/viability research in this session's conversation history - see that for
the reasoning behind the cost figures cited here. This doc is action items, not analysis.

Neither of these two tracks blocks the other - they can happen in parallel.

## Track A: Forming the legal entity

This is the founder's own action - filing requires personal identity, a signature, and a real
payment, none of which an assistant can do on someone's behalf. This is a sequenced checklist for
doing it yourself.

1. **Pick a business name and check availability.** Search your state's Secretary of State business
   registry, and check the matching `.com` domain and social handles are free before falling in love
   with a name.
2. **Pick where to form the LLC.**
   - **Simplest for a US-based single-state operation: your own home state.** Filing fees run
     roughly $50-200 depending on the state (national average ~$130). You avoid the extra cost and
     paperwork of registering as a "foreign LLC" in your home state on top of a Delaware/Wyoming one,
     which is what you'd otherwise need to do to actually operate where you live.
   - **Delaware or Wyoming** are the popular low-cost/investor-familiar alternatives ($100-110 to
     form, Delaware has a flat $300/yr franchise tax, Wyoming's annual report fee is a much lower
     ~$60/yr minimum) - worth it mainly if you expect to raise real outside VC money later, since
     investors are more used to Delaware C-corps/LLCs. Not necessary for a friends-and-family
     pre-seed round.
   - **Recommendation for now: home state.** You can always convert or re-incorporate later if a
     real funding round makes Delaware worth the switch.
3. **File the LLC.** Either DIY directly on your state's Secretary of State website (cheapest), or
   use a formation service if you'd rather not deal with the paperwork - Northwest Registered Agent
   is the cheapest reputable option (~$39 + state fee, includes a year of registered-agent service).
   Avoid LegalZoom's upsell-heavy flow if you're being cost-conscious.
4. **Get a registered agent** if you used a DIY filing (a formation service usually includes this
   for the first year). ~$100-250/yr after that.
5. **Get an EIN (federal tax ID) directly from IRS.gov - it's free.** Takes about 15 minutes online.
   Ignore any third-party site that tries to charge for this; it's a well-known scam pattern.
6. **Open a business bank account** using the LLC paperwork and EIN. Keep personal and business
   money separate from day one - this matters both for liability protection and for not creating a
   bookkeeping mess later.
7. **Decide on Tech E&O / general liability insurance.** Not urgent for a free pilot with people you
   know; worth adding (~$150-300/mo combined) once you're handling real user data at scale or before
   taking any payments. Vouch and similar startup-focused insurers are built for exactly this.

**Total realistic cost for this whole track, done leanly: $200-350 one-time, plus ~$100-250/yr
ongoing for the registered agent.**

## Track B: Making the app production-ready

The Docker-based deployment mechanics are already documented in `DEPLOYMENT.md` at the repo root -
this is the checklist of what's still missing around it.

1. **Pick a hosting provider and create an account.** From the cost research: Hetzner (cheapest,
   ~$5-8/mo for a small VPS, 20TB free egress) or Railway (~$10-15/mo all-in for a small multi-service
   stack, less server management) are the two leanest realistic options for this stack's size. This
   needs to be your own account (billing, credentials) - happy to walk through the actual setup once
   you've picked one and created the account.
2. **Register the domain - done 2026-08-14.** `cricroots.com` registered via Cloudflare Registrar
   ($10.46/yr, at-cost with no markup - Cloudflare's standard model), auto-renew on, expires
   2027-08-14. Decided 2026-08-12: the app is renamed **CricRoots** (from CricSync - a company
   already runs an app literally called "CricSync," and `cricsync.com`/`cricsync.app` were both
   already taken; see the demand-reality-check artifact from that session for the full research).
   DNS isn't configured yet - there's no publicly deployed target to point it at until the hosting
   step below happens; the domain just sits registered until then. GitHub repo renamed to
   `Krishna-444-dev/CricRoots` on 2026-08-12; the local clone's `origin` remote and all clone
   instructions in README/DEPLOYMENT were updated to match. Everything else in the codebase - app
   name, package names, bundle IDs, Docker container labels, storage keys - was renamed in that
   same pass. The live MongoDB database
   name and Docker volume names were deliberately left as `cricsync` internally to avoid orphaning
   real pilot data (users, teams, uploaded group-chat attachments) - purely invisible infrastructure,
   not worth a live-data migration for a cosmetic string nobody sees.
3. **Set up MongoDB Atlas** on the free/shared tier to start (it's genuinely free at pilot scale) -
   don't self-host Mongo in production, a managed tier removes a whole category of operational risk.
4. **Follow `DEPLOYMENT.md`'s production section**: environment variables, SSL via Let's Encrypt,
   pointing DNS at the server.
5. **Set up basic uptime/error monitoring.** Even a free tier of something like UptimeRobot (pings
   the site and texts/emails you if it goes down) is far better than finding out your scoring app was
   down during someone's actual match because a player told you afterward.
6. **App store submission (for a real public launch, later):**
   - Apple Developer Program: $99/yr - needed for iOS.
   - Google Play Console: $25 one-time - needed for Android.
7. **Do a full dry run yourself first.** Register an account, create a team, score a full match
   start to finish, on the actual production deployment - before a single real person outside your
   own circle touches it.

**Total realistic cost for this track: ~$40-65/mo once live at pilot scale** (hosting, domain
amortized, Apple Developer fee amortized) - see the viability report for the fuller breakdown.

## Track C: getting it in front of real testers, with zero setup on their end

> **Read this first (added 2026-08-18, after a repository audit).** The "zero setup, share
> anywhere" promise below is **true only after Track B is done**. Until a publicly reachable
> HTTPS backend exists at `api.cricroots.com`, this path is local-network testing, not an
> internet-accessible pilot — see the limitation subsection at the end of this track. Do not
> read the setup-is-done note as meaning the pilot is ready to share.
>
> There is, however, a clean path already in the code: `mobile-app/src/shared/api/apiClient.ts:23`
> falls back to `https://api.cricroots.com/api` for any non-`__DEV__` build with
> `EXPO_PUBLIC_API_URL` unset. So once Track B is live, publishing with that variable **unset**
> should produce a genuinely portable bundle. See `documentation/pilot-deployment-plan.md`.

For a pilot ("a few people, a few matches, one season"), skip app store distribution entirely at
first - it's slower (developer account approval, app review) and not what it's for yet. The mobile
app (Expo SDK 54) can be shared as a live link that opens instantly inside the free **Expo Go**
app - no waitlist, no review, no account approval needed on the tester's side.

**Setup: done — but see the warning above; setup being done is not the same as the pilot being
shareable.** The Expo project is linked (project ID `c42d8897-9374-4b2c-8ceb-7282f6180e2b`,
owner `krishnadev444`), and updates publish for real to the `preview` channel:

```bash
cd mobile-app
npx eas-cli update --channel preview --message "describe what changed"
```

`--channel` (not `--branch`) is the flag that actually matters here - it publishes to whichever
branch is mapped to that channel, auto-creating the mapping the first time a given channel name is
used. This gives a shareable `expo.dev` link and QR code pointing at
`exp://u.expo.dev/c42d8897-9374-4b2c-8ceb-7282f6180e2b?channel-name=preview`.

**What a tester does:** install the free "Expo Go" app from the App Store or Play Store, then tap
your link (or scan the QR code) - CricRoots opens immediately inside it. That's the entire install
process.

**Confirmed real limitation, found during the first actual pilot test:** an EAS Update bundle bakes
in whatever `EXPO_PUBLIC_API_URL` was set in `mobile-app/.env` on the machine that ran the publish
command, at publish time - it is not re-resolved per device. Until the backend is actually deployed
somewhere publicly reachable (Track B), this means the "opens instantly, zero setup" promise above
only holds for testers on the **same LAN as the machine that published the update**, with that
machine's Docker backend running - not "anywhere," despite EAS Updates normally being marketed as
portable. A tester off that network gets a silent blank screen (see
`documentation/mobile-app-rebuild.md` - this is a real, open, unexplained failure mode: no error is
surfaced, unlike the local dev-server path, which shows a normal error overlay on a genuine crash).
Don't promise "share this link with anyone" until Track B is actually done.

When you're ready for something that feels more like a "real app" (its own icon on the home screen,
no Expo Go wrapper) - or once you need push notifications or any native module Expo Go doesn't
support - that's when to move to EAS Build + TestFlight/Play internal testing instead. Not needed
for the first pilot.

## Status of this document

Audited against the repository on 2026-08-18. Two findings that were not in the original checklist:

1. **The web app is not deployed by anything here.** No `web-app/Dockerfile`, no web-app service in
   `docker-compose.yml`, and `nginx.conf` ends with `location / { return 404; }`. Following Track B
   as written produces a working API at `api.cricroots.com` and **nothing at `cricroots.com`**.
   Decided 2026-08-18: the first pilot is **mobile-only** and this is accepted, not fixed.
2. **Track B item 3 (Atlas) conflicts with `docker-compose.yml`**, which hardcodes a local Mongo
   connection string. Using Atlas requires a small compose change, not just an env var.

The concrete, verified version of Track B now lives in `documentation/pilot-deployment-plan.md`.

## Sequencing recommendation

Don't build more features before doing both tracks above. The product already has more depth than
most of what turned up in the competitor research - what it's missing is reliability under real
usage and the legal basics, not more capability. Get through both tracks, run one full season with
whoever you can pull in, and let what actually happens - not more building - decide what comes next.
