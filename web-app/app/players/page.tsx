import PlayerStatsDashboard from '@/components/PlayerStatsDashboard';

export default function PlayersPage({
  searchParams,
}: {
  searchParams: { playerId?: string };
}) {
  return <PlayerStatsDashboard playerId={searchParams.playerId} />;
}
