// The "clubhouse + scorebook" visual grammar.
//
// The existing app is a coherent design SYSTEM (navy/green, rounded cards, coloured icons) but it
// applies one composition everywhere, which is what made it read as a feature directory rather
// than a cricket product. This module keeps the brand tokens and changes the COMPOSITION rules:
//
//   1. Ruled rows, not cards. A scorebook is ruled paper. Cards are reserved for the one thing
//      that is actually happening - the live match - so elevation means something again.
//   2. Figures dominate. Numbers are large and tabular; their labels are small, uppercase and
//      letterspaced, the way a scorebook column heading is subordinate to the runs in it.
//   3. Section headings are ledger headings - small caps against a hairline rule, not bold H2s.
//   4. Accent colour is semantic, never decorative: green = live/now, gold = standing/achievement,
//      red = wicket/urgent.
//
// Shared here rather than copied into each screen so this stays a system. If a fourth screen is
// redesigned later it should import from this file, not re-invent the spacing.
import { StyleSheet, TextStyle } from 'react-native';
import { colors } from './index';

export const NUM: TextStyle = { fontVariant: ['tabular-nums'] };

export const scorebook = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // --- ledger heading: small caps over a hairline, the scorebook column-header device ---------
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 28,
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  heading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: colors.inkMuted,
    textTransform: 'uppercase',
  },
  headingRule: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },

  // --- ruled row: the default row. No radius, no fill - just ruled paper. --------------------
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 14,
  },
  rowLast: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowBody: { flex: 1 },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  rowMeta: {
    fontSize: 12,
    color: colors.inkMuted,
    marginTop: 3,
  },

  // --- figure strip: the scorebook summary line. Numbers big, labels tiny. -------------------
  figureStrip: {
    flexDirection: 'row',
    paddingHorizontal: 20,
  },
  figure: {
    flex: 1,
  },
  figureDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  figureValue: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.ink,
    ...NUM,
  },
  figureLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    marginTop: 4,
  },

  // --- the ONE elevated surface, used only for what is happening now -------------------------
  hero: {
    marginHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.pitch700,
    backgroundColor: colors.pitch900,
    overflow: 'hidden',
  },
  heroInner: { padding: 18 },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 14,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.wicket500,
  },
  liveTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: colors.wicket400,
  },

  // --- primary action: a full-width bar, not a pill. Reads as "the thing to do". -------------
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: colors.pitch500,
  },
  actionBarText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#04140A',
  },

  // --- quiet chips for the de-emphasised tail of the screen ----------------------------------
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
  },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: {
    fontSize: 13,
    color: colors.inkSecondary,
    fontWeight: '600',
  },

  empty: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.inkMuted,
    lineHeight: 19,
  },
});
