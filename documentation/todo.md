# Open Work

This file used to track a much earlier phase of the project (payment-flow docs, platform-specific
iOS/Android native UI work, PayPal integration) — none of that matches the app as it's actually
built today (marketplace is cash/bank-transfer/in-person only, by design, not a payment processor;
mobile is a single cross-platform Expo/React Native codebase, not separate native iOS/Android UI
layers). Replaced with the real current backlog. For the fuller, narrated version of what's shipped
and why, see `documentation/cricclubs-feature-roadmap.md` and `documentation/mobile-app-rebuild.md`
— this file is just the flat open-items list.

## Product / legal

- [ ] Register `cricroots.com` — flagged 2026-08-14 as the immediate next priority action, not yet
      done. See `documentation/going-legal-and-live.md` Track B.
- [ ] Form the LLC (Track A in `documentation/going-legal-and-live.md`) — founder's own action,
      requires personal identity/signature/payment.
- [ ] Deploy the backend to real public infrastructure (Track B) — currently pilot-testing over a
      local network only; this is also what would make EAS Update pilot links portable off the
      publishing machine's LAN (see the limitation noted in `going-legal-and-live.md`).

## Mobile / pilot testing

- [ ] Root-cause why the EAS Update (OTA) path shows a silent blank screen with no error surfaced,
      vs. the dev-server path's normal crash overlay — worked around, never actually explained.
- [ ] Full App Store / Play Store submission, once past pilot testing (Apple Developer $99/yr,
      Google Play Console $25 one-time — see `going-legal-and-live.md` Track B).

## AI / data

- [ ] Retrain the win-probability/tactical-advisor model (`ai-engine/`) on real match data as it
      accumulates through this app's own scoring, instead of the current small synthetic dataset —
      needed before its live-updating behavior is meaningfully sensitive to match state rather than
      saturating near its extremes for long stretches.
- [ ] Source and verify the official D/L Standard resource table before treating rain-revision as
      more than an approximate, explicitly-labeled estimate.

## Backlog (see `cricclubs-feature-roadmap.md` for full context)

- [ ] Match/tournament notifications (push/email when a followed team's match goes live or a
      tournament posts an announcement).
- [ ] Advanced/chronological "recent form" trend tracking per player (currently hardcoded to 0 in
      the career-stats aggregation).
- [ ] Community feed (rules/education/trivia/quizzes/polls/stories) — lower priority than the
      stats/analytics gaps above.
