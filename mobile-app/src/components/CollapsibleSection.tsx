import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

// A ledger heading that opens and closes.
//
// The match screen stacks everything it has vertically - Charts renders EIGHT charts in one
// scroll, Info renders six sections including a 22-player squad list - so the tab is a wall and
// the thing you came for is somewhere in the middle of it.
//
// Two rules this follows, rather than collapsing everything by reflex:
//
//   1. A collapsed section still has to inform. `summary` shows on the header ("6 runs · 1 wkt",
//      "12 players"), so closing a section hides the detail, not the fact.
//   2. Something is open by default. A screen of nothing but closed rows is a menu, not a page -
//      so the first/most relevant section of each tab stays expanded.
//
// Uses the same small-caps-on-a-hairline heading as the rest of the scorebook grammar, so an
// openable section reads as the same kind of thing as a fixed one.

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  title: string;
  summary?: string | null;
  defaultOpen?: boolean;
  children: React.ReactNode;
  dense?: boolean;
}

export default function CollapsibleSection({ title, summary, defaultOpen = false, children, dense = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.create(160, 'easeInEaseOut', 'opacity'));
    setOpen((o) => !o);
  };

  return (
    <View style={dense ? s.wrapDense : s.wrap}>
      <TouchableOpacity style={s.header} onPress={toggle} activeOpacity={0.7}>
        <Text style={[s.title, dense && s.titleDense]} numberOfLines={1}>{title}</Text>
        <View style={s.rule} />
        {!!summary && <Text style={s.summary} numberOfLines={1}>{summary}</Text>}
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={colors.inkMuted} />
      </TouchableOpacity>
      {open && <View style={dense ? s.bodyDense : s.body}>{children}</View>}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 18 },
  wrapDense: { marginTop: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: colors.inkMuted,
    textTransform: 'uppercase',
  },
  titleDense: {
    fontSize: 13,
    letterSpacing: 0.2,
    textTransform: 'none',
    color: colors.ink,
    fontWeight: '600',
  },
  rule: { flex: 1, height: 1, backgroundColor: colors.border },
  summary: {
    fontSize: 11,
    color: colors.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  body: { paddingTop: 2 },
  bodyDense: { paddingTop: 0 },
});
