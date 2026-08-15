# Open Work

This file used to track a much earlier phase of the project (payment-flow docs, platform-specific
iOS/Android native UI work, PayPal integration) — none of that matches the app as it's actually
built today (marketplace is cash/bank-transfer/in-person only, by design, not a payment processor;
mobile is a single cross-platform Expo/React Native codebase, not separate native iOS/Android UI
layers). Replaced with the real current backlog. For the fuller, narrated version of what's shipped
and why, see `documentation/cricclubs-feature-roadmap.md` and `documentation/mobile-app-rebuild.md`
— this file is just the flat open-items list.

## Product / legal

- [x] Register `cricroots.com` — done 2026-08-14 via Cloudflare Registrar, auto-renew on. DNS not
      configured yet (no public deployment target until hosting is set up, see below).
- [ ] Form the LLC (Track A in `documentation/going-legal-and-live.md`) — founder's own action,
      requires personal identity/signature/payment.
- [ ] Deploy the backend to real public infrastructure (Track B) — currently pilot-testing over a
      local network only; this is also what would make EAS Update pilot links portable off the
      publishing machine's LAN (see the limitation noted in `going-legal-and-live.md`).

## Mobile / pilot testing

- [ ] Confirm the EAS Update (OTA) blank-screen fix on a real device — 2026-08-14: no error boundary
      existed anywhere in the app (`App.tsx` was bare nested providers), which explains the asymmetry
      (production/OTA bundles have no LogBox, so any uncaught mount-time error just fails silently,
      while the same error under the Metro dev-server shows the normal red-screen overlay). Added
      `mobile-app/src/components/ErrorBoundary.tsx` wrapping the whole provider tree — a future
      occurrence now shows a real error message + stack instead of blank. The exact historical
      trigger is still unconfirmed (no device access during the fix); a real, separate, adjacent risk
      was flagged too: `apiClient.ts` falls back to the unreachable `api.cricroots.com` (no DNS) when
      `EXPO_PUBLIC_API_URL` isn't set at publish time — set that env var explicitly on the next
      `eas update` publish. Still open: force-quit + reopen Expo Go and confirm the fallback screen
      (not blank) appears if/when the bug recurs.
- [ ] Full App Store / Play Store submission, once past pilot testing (Apple Developer $99/yr,
      Google Play Console $25 one-time — see `going-legal-and-live.md` Track B).

## AI / data

- [x] Retrain the win-probability model's regressor (`ai-engine/src/models/recommendation_model.py`'s
      `win_prob_model`) on real match outcomes — done 2026-08-14. `backend/src/scripts/
      extractWinProbabilityData.js` walks every Completed match's chasing innings ball-by-ball
      (one row per completed over) and labels each row with whether the chasing team actually won,
      replacing `data_generator.py`'s hand-written heuristic formula label. 577 completed matches ->
      11,233 real rows in `ai-engine/data/real_matches.csv`; `train_all_models()` now trains
      `win_prob_model` on that file when present (falls back to the old synthetic column
      otherwise). Match-level holdout evaluation (`ai-engine/evaluate_win_probability.py`): Brier
      score 0.156 vs. 0.400 for what the old synthetic-trained model predicts on the same real
      situations, and decile calibration is now monotonic (the synthetic model was miscalibrated -
      predicting ~0.86 average across situations that actually won only ~45% of the time).
      Still open: `batsman_model`/`bowler_model`/`fielding_model` remain trained on synthetic data
      only — there's no real recorded label anywhere in this app for "which player should bat/bowl
      next" or "optimal fielding position" (no historian ever recorded a "correct" decision), so
      retraining those needs a different data source (e.g. outcome-based reward signal) than
      "real data already exists," not just more scoring volume.
- [ ] Source and verify the official D/L Standard resource table before treating rain-revision as
      more than an approximate, explicitly-labeled estimate.

## Backlog (see `cricclubs-feature-roadmap.md` for full context)

- [ ] Match/tournament notifications (push/email when a followed team's match goes live or a
      tournament posts an announcement).
- [ ] Advanced/chronological "recent form" trend tracking per player (currently hardcoded to 0 in
      the career-stats aggregation).
- [ ] Community feed (rules/education/trivia/quizzes/polls/stories) — lower priority than the
      stats/analytics gaps above.
