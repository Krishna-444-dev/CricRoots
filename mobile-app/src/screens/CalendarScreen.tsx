// Calendar screen (HomeStack -> "Calendar") - a month-view grid of scheduled matches and
// tournament date ranges, mirroring web-app/app/calendar/page.tsx's day-cell logic
// (a match counts as "on" a day when its scheduledDate falls on that day; a tournament counts
// as "on" a day when the day falls within its startDate-endDate range, inclusive) but built
// with plain View/Text/TouchableOpacity since React Native has no native month-grid component
// and no calendar library is in this app's dependencies - same "hand-build with RN primitives"
// approach as the Manhattan/Worm charts in MatchDetailScreen.tsx.
//
// There's no dedicated calendar backend endpoint on either platform - both derive the grid
// client-side from the same matches/tournaments list data already used elsewhere in this app.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';
import { Match, Tournament } from '../shared/types';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface DayCell {
  date: Date;
  inMonth: boolean;
}

/** Strips time-of-day so date-only comparisons are safe regardless of timezone offsets. */
function toDateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Builds a 7-column (Sun-Sat) grid of day cells for the given month, padded with leading days
 * from the previous month and trailing days from the next month so the total cell count is
 * always a multiple of 7 (4-6 rows depending on the month) - same algorithm as web's
 * buildMonthGrid in app/calendar/page.tsx.
 */
function buildMonthGrid(year: number, month: number): DayCell[] {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: DayCell[] = [];

  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, daysInPrevMonth - i), inMonth: false });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true });
  }

  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false });
  }

  return cells;
}

function chunkIntoWeeks(cells: DayCell[]): DayCell[][] {
  const weeks: DayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function teamName(team: Match['team1'] | undefined): string {
  if (!team) return 'TBD';
  return typeof team === 'string' ? 'TBD' : team.name;
}

function matchDotColor(status: Match['status']): string {
  switch (status) {
    case 'Live':
      return colors.pitch400;
    case 'Completed':
      return colors.info;
    case 'Cancelled':
      return colors.wicket500;
    default:
      return colors.inkSecondary; // Scheduled
  }
}

export default function CalendarScreen({ navigation }: any) {
  const today = useMemo(() => toDateOnly(new Date()), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [matches, setMatches] = useState<Match[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const load = useCallback(() => {
    Promise.all([api.matches.getMatches(), api.tournaments.getTournaments()])
      .then(([matchesRes, tournamentsRes]) => {
        setMatches(matchesRes.matches);
        setTournaments(tournamentsRes.tournaments);
      })
      .catch(() => {
        setMatches([]);
        setTournaments([]);
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const weeks = useMemo(() => chunkIntoWeeks(buildMonthGrid(viewYear, viewMonth)), [viewYear, viewMonth]);

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
    setSelectedDate(null);
  };

  const goToToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDate(today);
  };

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const matchesOn = useCallback(
    (date: Date) => matches.filter((m) => m.scheduledDate && isSameDay(new Date(m.scheduledDate), date)),
    [matches]
  );

  const tournamentsOn = useCallback(
    (date: Date) =>
      tournaments.filter((t) => {
        if (!t.startDate || !t.endDate) return false;
        const start = toDateOnly(new Date(t.startDate));
        const end = toDateOnly(new Date(t.endDate));
        return date >= start && date <= end;
      }),
    [tournaments]
  );

  const selectedMatches = selectedDate ? matchesOn(selectedDate) : [];
  const selectedTournaments = selectedDate ? tournamentsOn(selectedDate) : [];
  const hasAnyData = matches.length > 0 || tournaments.length > 0;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.pitch400} />}
      >
        <View style={styles.monthNavRow}>
          <TouchableOpacity style={styles.navBtn} onPress={goToPrevMonth}>
            <Text style={styles.navBtnText}>← Prev</Text>
          </TouchableOpacity>
          <View style={styles.monthLabelWrap}>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <TouchableOpacity onPress={goToToday}>
              <Text style={styles.todayLink}>Today</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.navBtn} onPress={goToNextMonth}>
            <Text style={styles.navBtnText}>Next →</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <Text style={styles.muted}>Loading...</Text>
        ) : !hasAnyData ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyTitle}>Nothing scheduled yet</Text>
            <Text style={styles.muted}>Matches and tournaments will show up here once they're created.</Text>
          </View>
        ) : (
          <>
            <View style={styles.weekdayRow}>
              {WEEKDAY_LABELS.map((label, i) => (
                <View key={`${label}-${i}`} style={styles.weekdayCell}>
                  <Text style={styles.weekdayText}>{label}</Text>
                </View>
              ))}
            </View>

            {weeks.map((week, wi) => (
              <View key={wi} style={styles.weekRow}>
                {week.map(({ date, inMonth }) => {
                  const dayMatches = matchesOn(date);
                  const dayTournaments = tournamentsOn(date);
                  const isToday = isSameDay(date, today);
                  const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
                  const hasEvents = dayMatches.length > 0 || dayTournaments.length > 0;

                  return (
                    <TouchableOpacity
                      key={date.toISOString()}
                      style={[styles.dayCell, !inMonth && styles.dayCellOutside, isSelected && styles.dayCellSelected]}
                      activeOpacity={hasEvents ? 0.6 : 1}
                      disabled={!hasEvents}
                      onPress={() => setSelectedDate(date)}
                    >
                      <View style={[styles.dayNumberWrap, isToday && styles.dayNumberToday]}>
                        <Text
                          style={[
                            styles.dayNumberText,
                            !inMonth && styles.dayNumberTextOutside,
                            isToday && styles.dayNumberTextToday,
                          ]}
                        >
                          {date.getDate()}
                        </Text>
                      </View>
                      {hasEvents && (
                        <View style={styles.dotsRow}>
                          {dayTournaments.length > 0 && <View style={[styles.dot, styles.dotTournament]} />}
                          {dayMatches.slice(0, 3).map((m) => (
                            <View key={m._id} style={[styles.dot, { backgroundColor: matchDotColor(m.status) }]} />
                          ))}
                          {dayMatches.length > 3 && <Text style={styles.dotOverflow}>+{dayMatches.length - 3}</Text>}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.dot, styles.dotTournament]} />
                <Text style={styles.legendText}>Tournament</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: colors.pitch400 }]} />
                <Text style={styles.legendText}>Live</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: colors.inkSecondary }]} />
                <Text style={styles.legendText}>Scheduled</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: colors.info }]} />
                <Text style={styles.legendText}>Completed</Text>
              </View>
            </View>

            {selectedDate && (
              <View style={styles.selectedSection}>
                <Text style={styles.selectedTitle}>
                  {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                </Text>

                {selectedTournaments.length === 0 && selectedMatches.length === 0 ? (
                  <Text style={styles.muted}>Nothing scheduled on this day.</Text>
                ) : (
                  <>
                    {selectedTournaments.map((t) => (
                      <TouchableOpacity
                        key={t._id}
                        style={styles.eventCard}
                        onPress={() =>
                          navigation.navigate('Tournaments', {
                            screen: 'TournamentDetail',
                            params: { tournamentId: t._id },
                          })
                        }
                      >
                        <View style={[styles.eventTag, styles.eventTagTournament]}>
                          <Text style={styles.eventTagText}>TOURNAMENT</Text>
                        </View>
                        <Text style={styles.eventTitle} numberOfLines={1}>
                          {t.name}
                        </Text>
                        <Text style={styles.eventMeta} numberOfLines={1}>
                          {t.venue}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {selectedMatches.map((m) => {
                      const dotColor = matchDotColor(m.status);
                      return (
                        <TouchableOpacity
                          key={m._id}
                          style={styles.eventCard}
                          onPress={() =>
                            navigation.navigate('Matches', {
                              screen: 'MatchDetail',
                              params: { matchId: m._id },
                            })
                          }
                        >
                          <View style={[styles.eventTag, { backgroundColor: dotColor + '26', borderColor: dotColor }]}>
                            <Text style={[styles.eventTagText, { color: dotColor }]}>{m.status.toUpperCase()}</Text>
                          </View>
                          <Text style={styles.eventTitle} numberOfLines={1}>
                            {teamName(m.team1)} vs {teamName(m.team2)}
                          </Text>
                          <Text style={styles.eventMeta} numberOfLines={1}>
                            {m.venue}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 16, paddingBottom: 32 },
  muted: { color: colors.inkMuted, fontSize: 13, lineHeight: 18 },

  monthNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  navBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  navBtnText: { color: colors.inkSecondary, fontSize: 12, fontWeight: '600' },
  monthLabelWrap: { alignItems: 'center' },
  monthLabel: { color: colors.ink, fontSize: 16, fontWeight: 'bold' },
  todayLink: { color: colors.pitch400, fontSize: 12, fontWeight: '600', marginTop: 2 },

  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyTitle: { color: colors.ink, fontSize: 15, fontWeight: '700', marginBottom: 6 },

  weekdayRow: { flexDirection: 'row', marginBottom: 4 },
  weekdayCell: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  weekdayText: { color: colors.inkMuted, fontSize: 11, fontWeight: '700' },

  weekRow: { flexDirection: 'row' },
  dayCell: {
    flex: 1,
    minHeight: 54,
    borderWidth: 0.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 4,
  },
  dayCellOutside: { backgroundColor: colors.background },
  dayCellSelected: { backgroundColor: colors.surfaceAlt, borderColor: colors.pitch500, borderWidth: 1 },
  dayNumberWrap: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dayNumberToday: { backgroundColor: colors.pitch500 },
  dayNumberText: { color: colors.inkSecondary, fontSize: 12, fontWeight: '600' },
  dayNumberTextOutside: { color: colors.inkMuted },
  dayNumberTextToday: { color: colors.background, fontWeight: '800' },

  dotsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 3, marginTop: 5, maxWidth: 40 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotTournament: { backgroundColor: colors.gold500 },
  dotOverflow: { color: colors.inkMuted, fontSize: 9, fontWeight: '700' },

  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendText: { color: colors.inkMuted, fontSize: 11, fontWeight: '600' },

  selectedSection: { marginTop: 18 },
  selectedTitle: { color: colors.ink, fontSize: 15, fontWeight: '700', marginBottom: 10 },
  eventCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
  },
  eventTag: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6,
  },
  eventTagTournament: { backgroundColor: colors.gold500 + '26', borderColor: colors.gold500 },
  eventTagText: { fontSize: 10, fontWeight: '800', color: colors.gold500, letterSpacing: 0.4 },
  eventTitle: { color: colors.ink, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  eventMeta: { color: colors.inkMuted, fontSize: 12 },
});
