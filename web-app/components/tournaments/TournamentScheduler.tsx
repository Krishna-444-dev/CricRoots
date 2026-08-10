'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Match {
  id: string;
  team1: string;
  team2: string;
  date: string;
  time: string;
  venue: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  result?: string;
}

interface Tournament {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  format: string;
  teams: string[];
  matches: Match[];
}

interface TournamentSchedulerProps {
  tournament: Tournament;
  onScheduleUpdate: (updatedTournament: Tournament) => void;
}

const TournamentScheduler: React.FC<TournamentSchedulerProps> = ({
  tournament,
  onScheduleUpdate
}) => {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>(tournament.matches);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'in-progress' | 'completed' | 'cancelled'>('all');
  const [isGeneratingSchedule, setIsGeneratingSchedule] = useState(false);
  const [venueOptions, setVenueOptions] = useState<string[]>([
    'Main Stadium',
    'Practice Ground A',
    'Practice Ground B',
    'Community Field',
    'University Ground'
  ]);

  // Filter matches based on status
  const filteredMatches = filter === 'all' 
    ? matches 
    : matches.filter(match => match.status === filter);

  // Group matches by date for better organization
  const matchesByDate = filteredMatches.reduce((groups, match) => {
    const date = match.date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(match);
    return groups;
  }, {} as Record<string, Match[]>);

  // Sort dates chronologically
  const sortedDates = Object.keys(matchesByDate).sort((a, b) => 
    new Date(a).getTime() - new Date(b).getTime()
  );

  const handleEditMatch = (match: Match) => {
    setEditingMatch({...match});
    setShowEditModal(true);
  };

  const handleSaveMatch = () => {
    if (!editingMatch) return;
    
    const updatedMatches = matches.map(match => 
      match.id === editingMatch.id ? editingMatch : match
    );
    
    setMatches(updatedMatches);
    onScheduleUpdate({
      ...tournament,
      matches: updatedMatches
    });
    
    setShowEditModal(false);
    setEditingMatch(null);
  };

  const handleGenerateSchedule = async () => {
    setIsGeneratingSchedule(true);
    
    try {
      // In a real implementation, this would call an API
      // For now, we'll simulate a schedule generation
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const teams = tournament.teams;
      const newMatches: Match[] = [];
      
      // Generate a round-robin schedule
      for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
          // Calculate a date within the tournament period
          const tournamentStart = new Date(tournament.startDate);
          const tournamentEnd = new Date(tournament.endDate);
          const dayRange = Math.floor((tournamentEnd.getTime() - tournamentStart.getTime()) / (1000 * 60 * 60 * 24));
          
          const randomDayOffset = Math.floor(Math.random() * dayRange);
          const matchDate = new Date(tournamentStart);
          matchDate.setDate(matchDate.getDate() + randomDayOffset);
          
          // Format date as YYYY-MM-DD
          const formattedDate = matchDate.toISOString().split('T')[0];
          
          // Random time between 9 AM and 7 PM
          const hour = 9 + Math.floor(Math.random() * 10);
          const minute = Math.random() > 0.5 ? '00' : '30';
          const formattedTime = `${hour}:${minute}`;
          
          // Random venue
          const randomVenue = venueOptions[Math.floor(Math.random() * venueOptions.length)];
          
          newMatches.push({
            id: `match-${i}-${j}`,
            team1: teams[i],
            team2: teams[j],
            date: formattedDate,
            time: formattedTime,
            venue: randomVenue,
            status: 'scheduled'
          });
        }
      }
      
      setMatches(newMatches);
      onScheduleUpdate({
        ...tournament,
        matches: newMatches
      });
      
    } catch (error) {
      console.error('Error generating schedule:', error);
      alert('Failed to generate schedule. Please try again.');
    } finally {
      setIsGeneratingSchedule(false);
    }
  };

  const handleClearSchedule = () => {
    if (window.confirm('Are you sure you want to clear the entire schedule? This cannot be undone.')) {
      setMatches([]);
      onScheduleUpdate({
        ...tournament,
        matches: []
      });
    }
  };

  const handleDeleteMatch = (matchId: string) => {
    if (window.confirm('Are you sure you want to delete this match?')) {
      const updatedMatches = matches.filter(match => match.id !== matchId);
      setMatches(updatedMatches);
      onScheduleUpdate({
        ...tournament,
        matches: updatedMatches
      });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4 sm:mb-0">{tournament.name} Schedule</h2>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button
            onClick={handleGenerateSchedule}
            disabled={isGeneratingSchedule}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed touch-manipulation"
          >
            {isGeneratingSchedule ? 'Generating...' : 'Generate Schedule'}
          </button>
          
          <button
            onClick={handleClearSchedule}
            disabled={matches.length === 0}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed touch-manipulation"
          >
            Clear Schedule
          </button>
        </div>
      </div>
      
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {(['all', 'scheduled', 'in-progress', 'completed', 'cancelled'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1 rounded-full text-sm font-medium touch-manipulation ${
                filter === status
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>
      
      {matches.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 mb-4">No matches scheduled yet.</p>
          <p className="text-gray-500">Click "Generate Schedule" to create a round-robin tournament schedule.</p>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No matches found with the selected filter.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {sortedDates.map(date => (
            <div key={date} className="border-b border-gray-200 pb-6 last:border-b-0 last:pb-0">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 sticky top-0 bg-white py-2">
                {new Date(date).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </h3>
              
              <div className="grid grid-cols-1 gap-4">
                {matchesByDate[date].map(match => (
                  <div 
                    key={match.id} 
                    className={`border rounded-lg p-4 ${
                      match.status === 'completed' ? 'bg-green-50 border-green-200' :
                      match.status === 'in-progress' ? 'bg-yellow-50 border-yellow-200' :
                      match.status === 'cancelled' ? 'bg-red-50 border-red-200' :
                      'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3">
                      <div className="mb-2 sm:mb-0">
                        <span className="text-sm font-medium text-gray-500">{match.time}</span>
                        <span className="mx-2 text-gray-300">|</span>
                        <span className="text-sm font-medium text-gray-500">{match.venue}</span>
                      </div>
                      
                      <div>
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                          match.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                          match.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                          match.status === 'completed' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {match.status.charAt(0).toUpperCase() + match.status.slice(1)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-3">
                      <div className="flex flex-col items-center sm:items-start mb-3 sm:mb-0">
                        <span className="text-lg font-bold text-gray-800">{match.team1}</span>
                      </div>
                      
                      <div className="text-center mb-3 sm:mb-0">
                        <span className="text-xl font-bold text-gray-500">vs</span>
                      </div>
                      
                      <div className="flex flex-col items-center sm:items-end">
                        <span className="text-lg font-bold text-gray-800">{match.team2}</span>
                      </div>
                    </div>
                    
                    {match.status === 'completed' && match.result && (
                      <div className="bg-green-100 text-green-800 p-2 rounded-md text-sm mb-3">
                        {match.result}
                      </div>
                    )}
                    
                    <div className="flex flex-wrap justify-end gap-2 mt-3">
                      <button
                        onClick={() => handleEditMatch(match)}
                        className="px-3 py-1 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 text-sm touch-manipulation"
                      >
                        Edit
                      </button>
                      
                      <button
                        onClick={() => handleDeleteMatch(match.id)}
                        className="px-3 py-1 bg-red-100 text-red-800 rounded-md hover:bg-red-200 text-sm touch-manipulation"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Edit Match Modal */}
      {showEditModal && editingMatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Edit Match</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Team 1
                </label>
                <select
                  value={editingMatch.team1}
                  onChange={(e) => setEditingMatch({...editingMatch, team1: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  {tournament.teams.map(team => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Team 2
                </label>
                <select
                  value={editingMatch.team2}
                  onChange={(e) => setEditingMatch({...editingMatch, team2: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  {tournament.teams.map(team => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={editingMatch.date}
                  onChange={(e) => setEditingMatch({...editingMatch, date: e.target.value})}
                  min={tournament.startDate}
                  max={tournament.endDate}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time
                </label>
                <input
                  type="time"
                  value={editingMatch.time}
                  onChange={(e) => setEditingMatch({...editingMatch, time: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Venue
                </label>
                <select
                  value={editingMatch.venue}
                  onChange={(e) => setEditingMatch({...editingMatch, venue: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  {venueOptions.map(venue => (
                    <option key={venue} value={venue}>{venue}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={editingMatch.status}
                  onChange={(e) => setEditingMatch({
                    ...editingMatch, 
                    status: e.target.value as 'scheduled' | 'in-progress' | 'completed' | 'cancelled'
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {editingMatch.status === 'completed' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Result
                  </label>
                  <input
                    type="text"
                    value={editingMatch.result || ''}
                    onChange={(e) => setEditingMatch({ ...editingMatch, result: e.target.value })}
                    placeholder="e.g. Team A won by 5 wickets"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingMatch(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 touch-manipulation"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMatch}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 touch-manipulation"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentScheduler;