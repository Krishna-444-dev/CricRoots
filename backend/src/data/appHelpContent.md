# CricRoots App Help — Reference for the In-App Assistant

This is grounding text for the assistant chatbot, not user-facing documentation. Answer questions
about the app using only what's actually described here. If something isn't covered, say so plainly
rather than guessing at menu labels or flows that aren't described below.

## Accounts and player profiles

Registering creates a login (name, email, password). On the web app, registration also collects
specialization (Batsman/Bowler/All-rounder/Wicket-keeper), batting style (Right-hand/Left-hand), and
bowling style. On the mobile app, registration is separate from setting up a player profile — a new
mobile user may need to complete their player profile (via the web app, or the in-app player
registration step) before some features (like creating a team) will work, since those require a
linked player profile, not just a login.

## Teams

Any player with a completed profile can create a team (name + city required). Every team has a
single required **captain**. A captain can promote one player to **vice-captain** and add any
number of **coaches** — both get admin-level team management access (editing team details, adding
or removing players from the roster), but only the captain can delete the team or change who holds
the vice-captain/coach roles. Removing a player from the roster also removes their vice-captain/
coach status if they held it. There's no self-serve "join a team" button — a team's captain (or
vice-captain/coach) adds players to the roster directly.

Teams have their own group chat for the whole roster.

## Groups

Separate from team chat: any player can create a "Group" (optionally tagged to one of their teams,
which auto-fills the roster as a starting point, or fully custom membership). Groups are private to
their members and support text messages, polls (single or multiple-choice, 2-10 options), and image/
video attachments. Only members can see a group or its messages.

## Direct messages

Any player can start a 1:1 conversation with any other player — either from their profile, or via
"New Message" in the Messages inbox, which opens a searchable player picker. Conversations are
private between the two participants.

## Matches and live scoring

A match is created with two teams, a venue, a date, total overs, and optionally linked to a
tournament. Once created, the match owner can score it ball-by-ball: runs, extras (wide/no-ball/
bye/leg-bye/penalty), and wickets (with dismissal type and fielder where relevant), plus optional
delivery detail — line, length, shot type, shot zone — which powers the tactical features below.
Scoring can be done by tapping buttons, or by voice: hold the microphone button, say a phrase like
"yorker, off stump, driven for four," and it fills in the delivery form for confirmation before
recording (it never auto-submits). Voice input supports selecting a recognition language (Hindi,
Urdu, Bengali, Punjabi, Tamil, Telugu, or regional English variants) for better accuracy, though
cricket terms themselves are still recognized in English regardless of the language selected.

Every recorded ball gets auto-generated natural-language commentary shown live on the match page.
Completed matches show a full scorecard, Manhattan and Worm charts (run-rate progression), and
"Key Moments" — the deliveries that swung the win probability the most in a chased innings.

## Tactical insights

These are computed from the line/length/shot-zone/shot-type data tagged during scoring, blended
using a shrinkage-based statistical model that avoids overreacting to small sample sizes (typical at
club level) rather than a black-box prediction:

- **Shot advice / bowling plan / fielding plan** for an individual player, based on their own tagged
  history where there's enough of it, falling back to a wider player-pool average otherwise.
- **Matchup finder** (on a match's Scouting Report page): pick a specific batter and a specific
  bowler to see a bowling-line-and-length recommendation for that exact pairing, blended across
  their head-to-head history, similar players, and the wider pool.
- **Live tactical read**, shown during live scoring: the same matchup recommendation, but adjusted
  in real time using the striker's deliveries so far in the current match — it shifts as the innings
  actually unfolds, not just what history says.
- **Post-match performance report** for each player: their numbers in that match vs. their career
  average, a recent-form trend across their last several matches, personal bests/milestones, and a
  note on whether each dismissal matched a zone the data had already flagged as high-risk for them.

## Tournaments

Organizers create tournaments, register teams, and can auto-generate fixtures (round-robin or
knockout). The points table updates automatically as linked matches complete (win/loss/tie/no-result
points, net run rate). Completed tournaments can have awards computed automatically (winner, runner-
up, best batsman/bowler, player of the tournament). Tournaments can also have organizer-set
**house rules** — free-text custom playing conditions for that specific league or tournament (overs
per side, boundary variants, anything customized from standard play) - always defer to a
tournament's own house rules over generic cricket rules when answering a question in that context.

## Predictions

On any scheduled match, players can pick which team will win before it starts, see what percentage
of other players picked each side, and earn points if their pick is correct once the match finishes.
A leaderboard ranks players by prediction points, and each player can see their own prediction
history.

## Stats and leaderboards

Every player has a career stats page: batting/bowling averages, strike rate/economy, a wagon-wheel
chart of scoring zones, wicketkeeper stats (catches/stumpings/run-outs), and achievement badges
(Century Maker, Five-Wicket Haul, Hat-trick Hero, and others) computed automatically from match data.
Leaderboards rank the top batsmen and bowlers.

## Calendar

A month-view calendar shows scheduled matches and ongoing tournament date ranges.

## News and Learn

News is a feed of posts about matches and tournaments, with a "My Feed" view for players you follow.
Learn is a library of short lessons organized by batting, bowling, fielding, fitness, rules, and
strategy, with a personalized "Recommended for You" section.

## Marketplace

Players can list cricket gear for sale, browse and add listings to a cart, and track orders as a
buyer or seller. Payment happens directly between buyer and seller (cash, bank transfer, or in
person) — the app is not a party to the transaction and doesn't process payments itself.

## Frequently asked follow-ups

**"I created an account but can't create a team - why?"** Creating a team requires a completed
player profile (specialization, batting style), not just a login. This is most likely to trip up new
mobile users, since mobile registration doesn't collect the player profile the way web registration
does - complete it via the web app or the in-app player registration step first.

**"Who can actually score a match?"** Only the person who created the match (the match owner) can
record deliveries for it. If you need someone else to score, they'd need to be the one who created
the match in the first place - there's no separate "assign a scorer" step described here.

**"Can I fix a mistake after recording a ball?"** Not described in this reference - if a player asks
about correcting or deleting an already-recorded ball, say you don't have information on an edit
flow rather than assuming one exists.

**"How is my career average calculated?"** From every completed match you've batted or bowled in,
computed live each time it's requested - not a number stored and updated after each match, so it's
always current as of the moment you look at it.

**"What's the difference between team chat and a group?"** Team chat is automatic and tied to the
team roster - every player on the team is in it by default. A group is opt-in and can include anyone
you choose, whether or not they share a team, and supports polls and attachments that team chat
doesn't.

**"Why don't I see a 'join team' button anywhere?"** There isn't one by design - rosters are managed
by the captain (or vice-captain/coach), not self-service. Ask whoever runs the team to add you.

**"Does the voice scoring work on mobile?"** No - voice-driven scoring and the language selector are
web-only features. Mobile scoring (where available) uses the tap-based delivery form.

**"Can I see who else predicted the same result I did?"** You can see the overall percentage split
of picks across both teams, not the identity of individual predictors.

**"What happens if a match ends in a tie or gets abandoned?"** Tournament points tables account for
win/loss/tie/no-result outcomes distinctly, each with their own points value the tournament
organizer configures - the exact point values for a tie or no-result vary by tournament, so check
that tournament's points configuration or house rules if asked for a specific number.
