import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../theme';

// Line and length as ONE tap on a pitch, instead of two selections from thirteen chips.
//
// The scoring screen asked for line and length as separate chip rows, and reset both to 'unknown'
// after every delivery - so tagging a ball meant re-opening a collapsed panel and picking from 13
// chips, 240 times a match. That is the burden, and most of it is interaction cost rather than the
// number of fields.
//
// A pitch map is also how the information is actually held in a cricketer's head: nobody thinks
// "off stump" and "good length" as two independent facts, they think about a spot on the pitch.
// One gesture, no scrolling, and the whole space visible at once so the scorer can aim rather
// than read.
//
// Orientation is from the bowler's end, which is the view a scorer has: short lengths at the top
// (bouncing early, far from the batter), full at the bottom, off side on the left for a
// right-hander.

export const PITCH_LINES = [
  'wide-outside-off', 'outside-off', 'off-stump', 'middle-stump', 'leg-stump', 'down-leg',
] as const;

// Top (far from the batter) to bottom (at their feet).
export const PITCH_LENGTHS = [
  'bouncer', 'short', 'short-of-good-length', 'good-length', 'full', 'yorker', 'full-toss',
] as const;

const LINE_SHORT: Record<string, string> = {
  'wide-outside-off': 'Wide off',
  'outside-off': 'Outside off',
  'off-stump': 'Off',
  'middle-stump': 'Middle',
  'leg-stump': 'Leg',
  'down-leg': 'Down leg',
};

const LENGTH_SHORT: Record<string, string> = {
  bouncer: 'Bouncer',
  short: 'Short',
  'short-of-good-length': 'Back of a length',
  'good-length': 'Good length',
  full: 'Full',
  yorker: 'Yorker',
  'full-toss': 'Full toss',
};

interface Props {
  line: string;
  length: string;
  onSelect: (line: string, length: string) => void;
  // True when the values were carried over from the previous delivery rather than tapped for this
  // one. Rendered differently so a carried value never looks like a recorded observation.
  carriedOver?: boolean;
}

export default function PitchMap({ line, length, onSelect, carriedOver = false }: Props) {
  const chosen = line !== 'unknown' && length !== 'unknown';

  return (
    <View style={s.wrap}>
      <View style={s.legendRow}>
        <Text style={s.legendSide}>OFF SIDE</Text>
        <Text style={s.legendSide}>LEG SIDE</Text>
      </View>

      <View style={s.grid}>
        {PITCH_LENGTHS.map((len) => (
          <View key={len} style={s.row}>
            <Text style={s.rowLabel} numberOfLines={1}>{LENGTH_SHORT[len]}</Text>
            <View style={s.cells}>
              {PITCH_LINES.map((ln) => {
                const active = ln === line && len === length;
                return (
                  <TouchableOpacity
                    key={ln}
                    style={[s.cell, active && (carriedOver ? s.cellCarried : s.cellActive)]}
                    onPress={() => onSelect(ln, len)}
                    accessibilityLabel={`${LENGTH_SHORT[len]}, ${LINE_SHORT[ln]}`}
                  />
                );
              })}
            </View>
          </View>
        ))}
      </View>

      <View style={s.lineLabels}>
        {PITCH_LINES.map((ln) => (
          <Text key={ln} style={s.lineLabel} numberOfLines={2}>{LINE_SHORT[ln]}</Text>
        ))}
      </View>

      <Text style={[s.readout, !chosen && s.readoutEmpty]}>
        {chosen
          ? `${LENGTH_SHORT[length]}, ${LINE_SHORT[line]}${carriedOver ? '  · carried over' : ''}`
          : 'Tap the pitch to set line and length'}
      </Text>
    </View>
  );
}

const CELL = 42;

const s = StyleSheet.create({
  wrap: { marginTop: 12 },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 96,
    paddingRight: 4,
    marginBottom: 6,
  },
  legendSide: { fontSize: 9, fontWeight: '700', letterSpacing: 1, color: colors.inkMuted },
  grid: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowLabel: {
    width: 92,
    paddingLeft: 8,
    fontSize: 10,
    color: colors.inkMuted,
  },
  cells: { flexDirection: 'row', flex: 1 },
  cell: {
    flex: 1,
    height: 30,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cellActive: { backgroundColor: colors.pitch500 },
  // A carried-over value is outlined, not filled - it reads as "assumed", not "recorded".
  cellCarried: {
    backgroundColor: colors.pitch900,
    borderColor: colors.pitch500,
    borderWidth: 2,
  },
  lineLabels: {
    flexDirection: 'row',
    paddingLeft: 92,
    marginTop: 4,
  },
  lineLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 8,
    color: colors.inkMuted,
  },
  readout: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
    color: colors.pitch400,
  },
  readoutEmpty: { color: colors.inkMuted, fontWeight: '400' },
});
