'use client';

import { useSearchParams } from 'next/navigation';
import TournamentManager from '@/components/TournamentManager';

export default function TournamentsPage() {
  const searchParams = useSearchParams();
  const tournamentId = searchParams.get('tournamentId') || undefined;
  const initialLeagueId = searchParams.get('leagueId') || undefined;

  return <TournamentManager tournamentId={tournamentId} initialLeagueId={initialLeagueId} />;
}
