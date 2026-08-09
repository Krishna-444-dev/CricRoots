// shared/api/apiClient.ts
// Shared API client for both web and mobile applications

import { User, Team, Match, Player, Product, Tournament, Message, ChatGroup } from '../types';

// Base API URL - would be different in production vs development
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.cricsync.com/v1'
  : 'http://localhost:3000/api';

// Generic fetch wrapper with error handling
async function fetchAPI<T>(
  endpoint: string, 
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any,
  headers?: HeadersInit
): Promise<T> {
  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      ...(body && { body: JSON.stringify(body) }),
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API request failed: ${endpoint}`, error);
    throw error;
  }
}

// Auth API
export const authAPI = {
  login: (email: string, password: string) => 
    fetchAPI<{ user: User; token: string }>('/auth/login', 'POST', { email, password }),
  
  register: (userData: Partial<User>, password: string) => 
    fetchAPI<{ user: User; token: string }>('/auth/register', 'POST', { ...userData, password }),
  
  logout: () => 
    fetchAPI<{ success: boolean }>('/auth/logout', 'POST'),
  
  getCurrentUser: (token: string) => 
    fetchAPI<User>('/auth/me', 'GET', undefined, { 'Authorization': `Bearer ${token}` }),
};

// Teams API
export const teamsAPI = {
  getTeams: () => 
    fetchAPI<Team[]>('/teams'),
  
  getTeamById: (teamId: string) => 
    fetchAPI<Team>(`/teams/${teamId}`),
  
  createTeam: (teamData: Partial<Team>) => 
    fetchAPI<Team>('/teams', 'POST', teamData),
  
  updateTeam: (teamId: string, teamData: Partial<Team>) => 
    fetchAPI<Team>(`/teams/${teamId}`, 'PUT', teamData),
  
  deleteTeam: (teamId: string) => 
    fetchAPI<{ success: boolean }>(`/teams/${teamId}`, 'DELETE'),
  
  getTeamMembers: (teamId: string) => 
    fetchAPI<Player[]>(`/teams/${teamId}/members`),
  
  addTeamMember: (teamId: string, playerId: string) => 
    fetchAPI<{ success: boolean }>(`/teams/${teamId}/members`, 'POST', { playerId }),
  
  removeTeamMember: (teamId: string, playerId: string) => 
    fetchAPI<{ success: boolean }>(`/teams/${teamId}/members/${playerId}`, 'DELETE'),
};

// Matches API
export const matchesAPI = {
  getMatches: () => 
    fetchAPI<Match[]>('/matches'),
  
  getMatchById: (matchId: string) => 
    fetchAPI<Match>(`/matches/${matchId}`),
  
  createMatch: (matchData: Partial<Match>) => 
    fetchAPI<Match>('/matches', 'POST', matchData),
  
  updateMatch: (matchId: string, matchData: Partial<Match>) => 
    fetchAPI<Match>(`/matches/${matchId}`, 'PUT', matchData),
  
  deleteMatch: (matchId: string) => 
    fetchAPI<{ success: boolean }>(`/matches/${matchId}`, 'DELETE'),
  
  getMatchScoring: (matchId: string) => 
    fetchAPI<any>(`/matches/${matchId}/scoring`),
  
  updateMatchScoring: (matchId: string, scoringData: any) => 
    fetchAPI<any>(`/matches/${matchId}/scoring`, 'PUT', scoringData),
};

// Players API
export const playersAPI = {
  getPlayers: () => 
    fetchAPI<Player[]>('/players'),
  
  getPlayerById: (playerId: string) => 
    fetchAPI<Player>(`/players/${playerId}`),
  
  createPlayer: (playerData: Partial<Player>) => 
    fetchAPI<Player>('/players', 'POST', playerData),
  
  updatePlayer: (playerId: string, playerData: Partial<Player>) => 
    fetchAPI<Player>(`/players/${playerId}`, 'PUT', playerData),
  
  deletePlayer: (playerId: string) => 
    fetchAPI<{ success: boolean }>(`/players/${playerId}`, 'DELETE'),
  
  getPlayerStats: (playerId: string) => 
    fetchAPI<any>(`/players/${playerId}/stats`),
};

// Products API
export const productsAPI = {
  getProducts: () => 
    fetchAPI<Product[]>('/products'),
  
  getProductById: (productId: string) => 
    fetchAPI<Product>(`/products/${productId}`),
  
  getProductsByCategory: (category: string) => 
    fetchAPI<Product[]>(`/products/category/${category}`),
  
  searchProducts: (query: string) => 
    fetchAPI<Product[]>(`/products/search?q=${encodeURIComponent(query)}`),
};

// Cart API
export const cartAPI = {
  getCart: () => 
    fetchAPI<any>('/cart'),
  
  addToCart: (productId: string, quantity: number) => 
    fetchAPI<any>('/cart/items', 'POST', { productId, quantity }),
  
  updateCartItem: (itemId: string, quantity: number) => 
    fetchAPI<any>(`/cart/items/${itemId}`, 'PUT', { quantity }),
  
  removeFromCart: (itemId: string) => 
    fetchAPI<{ success: boolean }>(`/cart/items/${itemId}`, 'DELETE'),
  
  clearCart: () => 
    fetchAPI<{ success: boolean }>('/cart', 'DELETE'),
  
  checkout: (paymentInfo: any) => 
    fetchAPI<any>('/cart/checkout', 'POST', paymentInfo),
};

// Tournaments API
export const tournamentsAPI = {
  getTournaments: () => 
    fetchAPI<Tournament[]>('/tournaments'),
  
  getTournamentById: (tournamentId: string) => 
    fetchAPI<Tournament>(`/tournaments/${tournamentId}`),
  
  createTournament: (tournamentData: Partial<Tournament>) => 
    fetchAPI<Tournament>('/tournaments', 'POST', tournamentData),
  
  updateTournament: (tournamentId: string, tournamentData: Partial<Tournament>) => 
    fetchAPI<Tournament>(`/tournaments/${tournamentId}`, 'PUT', tournamentData),
  
  deleteTournament: (tournamentId: string) => 
    fetchAPI<{ success: boolean }>(`/tournaments/${tournamentId}`, 'DELETE'),
  
  getTournamentMatches: (tournamentId: string) => 
    fetchAPI<Match[]>(`/tournaments/${tournamentId}/matches`),
  
  getTournamentTeams: (tournamentId: string) => 
    fetchAPI<Team[]>(`/tournaments/${tournamentId}/teams`),
};

// Messaging API
export const messagingAPI = {
  getMessages: (userId: string) => 
    fetchAPI<Message[]>(`/messages/user/${userId}`),
  
  getMessagesBetweenUsers: (userId1: string, userId2: string) => 
    fetchAPI<Message[]>(`/messages/between/${userId1}/${userId2}`),
  
  sendMessage: (message: Partial<Message>) => 
    fetchAPI<Message>('/messages', 'POST', message),
  
  markMessageAsRead: (messageId: string) => 
    fetchAPI<{ success: boolean }>(`/messages/${messageId}/read`, 'PUT'),
  
  getChatGroups: (userId: string) => 
    fetchAPI<ChatGroup[]>(`/chat-groups/user/${userId}`),
  
  getChatGroupMessages: (groupId: string) => 
    fetchAPI<Message[]>(`/chat-groups/${groupId}/messages`),
  
  createChatGroup: (groupData: Partial<ChatGroup>) => 
    fetchAPI<ChatGroup>('/chat-groups', 'POST', groupData),
  
  addUserToChatGroup: (groupId: string, userId: string) => 
    fetchAPI<{ success: boolean }>(`/chat-groups/${groupId}/members`, 'POST', { userId }),
  
  removeUserFromChatGroup: (groupId: string, userId: string) => 
    fetchAPI<{ success: boolean }>(`/chat-groups/${groupId}/members/${userId}`, 'DELETE'),
};

// Export all APIs as a single object
export const api = {
  auth: authAPI,
  teams: teamsAPI,
  matches: matchesAPI,
  players: playersAPI,
  products: productsAPI,
  cart: cartAPI,
  tournaments: tournamentsAPI,
  messaging: messagingAPI,
};

export default api;
