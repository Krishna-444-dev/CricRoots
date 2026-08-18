# CricRoots research programme

A controlled synthetic benchmark and preregistered experiment suite, built to answer one question:
**does the deployed hierarchical matchup engine actually work?**

It does not. A jointly-estimated regularized model outperformed it on every metric in both test
worlds. Five hypotheses were refuted or unsupported along the way.

**Read this first**: [`state-of-the-program.md`](state-of-the-program.md) — what was established,
what was ruled out and at what evidence scale, what remains open.

---

## The standing caveat

**Every finding here is simulator-conditional.** Worlds A/B/C/D were written for this programme. The
variance decomposition, the sparsity regime, the activation thresholds — all are properties of a
generator built to an agreed specification, not measurements of cricket.

This was not a shortcut. The product's own match database cannot evaluate a matchup engine:
`backend/src/scripts/matchSimulator.js` draws dismissals as `Math.random() < 0.045`, independent of
batter, bowler, line and length, so there is no matchup structure in it to recover. See
[`../documentation/research-readiness-audit.md`](../documentation/research-readiness-audit.md).

Real-data validation is gated on pilot adoption, not on analysis.

---

## Where to start, by purpose

| If you want… | Read |
|---|---|
| The current position | [`state-of-the-program.md`](state-of-the-program.md) |
| How conclusions are allowed to be drawn | [`protocol.md`](protocol.md) — the Research Principle and six validity gates |
| What is currently believed, and how strongly | [`hypotheses.md`](hypotheses.md) — H1–H13 with status and falsification criteria |
| Why a methodological choice was made | [`decisions.md`](decisions.md) — D1–D20, each with evidence and rejected alternatives |
| What happened, in order | [`research-log.md`](research-log.md) |
| Whether an idea is novel | [`general-algorithm-landscape.md`](general-algorithm-landscape.md) — prior-art map; §0 explains why no novelty claim currently stands |

## Layout

```
protocol.md            governing principle + validity gates
state-of-the-program.md current position (start here)
hypotheses.md          H1-H13, status, falsification criteria
decisions.md           D1-D20, methodological record
research-log.md        chronological narrative

experiment-{4..9}-design.md   preregistered designs, written before implementation
world-d-design.md             latent-factor benchmark design
synthetic/                    generator, league design, World B design, generator tests
harness/                      evaluation harness (leakage control) + experiment runners
models/                       joint regularized model, low-rank model, their verification tests
diagnostics/                  post-hoc investigations and validity gates
results/                      raw output, one timestamped directory per run
oracles.js baselines.js metrics.js
```

## Running things

`research/` has no dependencies of its own and borrows the backend's:

```bash
NODE_PATH=$PWD/backend/node_modules node research/synthetic/generator.test.js
NODE_PATH=$PWD/backend/node_modules node research/models/regularizedHierarchicalLogit.test.js
```

Experiments write to `results/<name>_<timestamp>/`. They are deterministic — same seeds produce
byte-identical output — and take 20–40 minutes each.

## Two rules that govern everything here

> **Before testing whether X predicts Y, establish that Y is measurable in the regime being tested.**
>
> **Before concluding that X failed, establish that X was active and correctly implemented.**

Both were adopted after their absence produced a wrong conclusion. Three separate times a question
turned out to be unanswerable in the environment where it was asked; each would have yielded a
confident, wrong, negative result about a *method*. See `protocol.md` for the gates that operationalise
these.

## What this produced

Not an algorithm. An environment that reliably detects when a question cannot be answered with the
evidence available, and a discipline for closing mechanisms without closing questions.

If an algorithm eventually emerges, this is what will make it credible. If none does, this is still
the contribution.
