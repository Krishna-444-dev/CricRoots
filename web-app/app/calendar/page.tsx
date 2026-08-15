'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Badge, { BadgeVariant } from '@/components/ui/Badge';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { buttonVariants } from '@/components/ui/buttonStyles';

interface Match {
  _id: string;
  title: string;
  team1: { _id: string; name: string };
  team2: { _id: string; name: string };
  status: string;
  venue: string;
  scheduledDate: string;
}

interface Tournament {
  _id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
}

interface DayCell {
  date: Date;
  inMonth: boolean;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MATCH_STATUS_VARIANT: Record<string, BadgeVariant> = {
  Live: 'live',
  Completed: 'success',
  Cancelled: 'danger',
  Scheduled: 'neutral',
};

/** Strips time-of-day so date-only comparisons are safe regardless of timezone offsets. */
function toDateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Builds a 7-column (Sun-Sat) grid of day cells for the given month, padded with
 * leading days from the previous month and trailing days from the next month so
 * the total cell count is always a multiple of 7 (5 or 6 rows depending on the month).
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

export default function CalendarPage() {
  const today = useMemo(() => toDateOnly(new Date()), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [matches, setMatches] = useState<Match[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/matches').then(res => res.json()),
      fetch('/api/tournaments').then(res => res.json()),
    ])
      .then(([matchesData, tournamentsData]) => {
        if (matchesData.success) setMatches(matchesData.matches);
        if (tournamentsData.success) setTournaments(tournamentsData.tournaments);
      })
      .finally(() => setLoading(false));
  }, []);

  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const goToToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const hasAnyData = matches.length > 0 || tournaments.length > 0;

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <PageHeader
        title="Calendar"
        description="Scheduled matches and tournament date ranges at a glance."
      />

      {loading ? (
        <p className="text-ink-secondary">Loading...</p>
      ) : !hasAnyData ? (
        <EmptyState
          icon="📅"
          title="Nothing scheduled yet"
          description="Matches and tournaments will show up here once they're created."
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 mb-4">
            <button onClick={goToPrevMonth} className={buttonVariants('outline', 'sm')} aria-label="Previous month">
              ← Prev
            </button>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-ink">{monthLabel}</h2>
              <button onClick={goToToday} className={buttonVariants('ghost', 'sm')}>
                Today
              </button>
            </div>
            <button onClick={goToNextMonth} className={buttonVariants('outline', 'sm')} aria-label="Next month">
              Next →
            </button>
          </div>

          {/* Month grid - desktop/tablet only. A 7-column grid has no honest way to reflow to a
              narrow screen (shrinking cells just makes every label unreadable), so below the sm
              breakpoint this is replaced entirely by the agenda list below, rather than left
              horizontally scrollable with no visible affordance to swipe. */}
          <div className="hidden sm:block overflow-x-auto">
            <div className="min-w-[700px]">
              <div className="grid grid-cols-7 border-t border-l border-border rounded-t-xl overflow-hidden">
                {WEEKDAY_LABELS.map(label => (
                  <div
                    key={label}
                    className="bg-surface-alt border-r border-b border-border px-2 py-2 text-xs font-semibold text-ink-secondary text-center"
                  >
                    {label}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 border-l border-border">
                {grid.map(({ date, inMonth }) => {
                  const dayMatches = matches.filter(m => isSameDay(new Date(m.scheduledDate), date));
                  const dayTournaments = tournaments.filter(t => {
                    const start = toDateOnly(new Date(t.startDate));
                    const end = toDateOnly(new Date(t.endDate));
                    return date >= start && date <= end;
                  });
                  const isToday = isSameDay(date, today);

                  return (
                    <div
                      key={date.toISOString()}
                      className={`min-h-[100px] sm:min-h-[120px] border-r border-b border-border p-1.5 flex flex-col gap-1 ${
                        inMonth ? 'bg-surface' : 'bg-surface-alt/40'
                      }`}
                    >
                      <span
                        className={`text-xs font-semibold ${
                          isToday
                            ? 'w-5 h-5 flex items-center justify-center rounded-full bg-pitch-500 text-[#06170D]'
                            : inMonth
                            ? 'text-ink-secondary'
                            : 'text-ink-muted'
                        }`}
                      >
                        {date.getDate()}
                      </span>

                      <div className="flex flex-col gap-1 overflow-y-auto max-h-[90px]">
                        {dayTournaments.map(t => (
                          <Link
                            key={t._id}
                            href="/tournaments"
                            title={t.name}
                            className="block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gold-500/15 text-gold-400 border border-gold-500/30 truncate hover:bg-gold-500/25 transition-colors"
                          >
                            {t.name}
                          </Link>
                        ))}
                        {dayMatches.map(m => (
                          <Link key={m._id} href={`/match/${m._id}`} title={`${m.team1?.name} vs ${m.team2?.name}`}>
                            <Badge
                              variant={MATCH_STATUS_VARIANT[m.status] ?? 'neutral'}
                              pulse={m.status === 'Live'}
                              className="!inline-flex w-full !justify-start truncate"
                            >
                              <span className="truncate">
                                {m.team1?.name} vs {m.team2?.name}
                              </span>
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Agenda list - mobile only. Same underlying grid/data, just re-rendered as a vertical
              list of days-with-events (empty days skipped, since scrolling past 20 blank days to
              find the next fixture is worse than the grid it replaces). Team names are shown in
              full - nothing here needs the grid's truncate-to-fit treatment. */}
          <div className="sm:hidden flex flex-col gap-3">
            {grid
              .filter(({ inMonth }) => inMonth)
              .map(({ date }) => {
                const dayMatches = matches.filter(m => isSameDay(new Date(m.scheduledDate), date));
                const dayTournaments = tournaments.filter(t => {
                  const start = toDateOnly(new Date(t.startDate));
                  const end = toDateOnly(new Date(t.endDate));
                  return date >= start && date <= end;
                });
                if (dayMatches.length === 0 && dayTournaments.length === 0) return null;
                const isToday = isSameDay(date, today);

                return (
                  <div key={date.toISOString()} className="bg-surface border border-border rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                          isToday ? 'bg-pitch-500 text-[#06170D]' : 'text-ink-secondary'
                        }`}
                      >
                        {date.getDate()}
                      </span>
                      <span className="text-xs font-semibold text-ink-secondary">
                        {date.toLocaleDateString(undefined, { weekday: 'long' })}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {dayTournaments.map(t => (
                        <Link
                          key={t._id}
                          href="/tournaments"
                          className="block text-xs font-semibold px-2 py-1 rounded bg-gold-500/15 text-gold-400 border border-gold-500/30"
                        >
                          {t.name}
                        </Link>
                      ))}
                      {dayMatches.map(m => (
                        <Link key={m._id} href={`/match/${m._id}`}>
                          <Badge variant={MATCH_STATUS_VARIANT[m.status] ?? 'neutral'} pulse={m.status === 'Live'} className="!inline-flex w-full !justify-start">
                            <span>{m.team1?.name} vs {m.team2?.name}</span>
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </>
      )}
    </main>
  );
}
