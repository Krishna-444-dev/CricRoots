// shared/api/apiClient.ts
// Fetch wrapper + typed route groups matching the REAL CricRoots backend (backend/src/routes/*),
// not an imagined API surface - every path here corresponds to an actual mounted route as of
// this pass. See backend/src/index.js for the full mount list.

import { Platform } from 'react-native';
import type { Prediction, LeaderboardEntry, Conversation, DirectMessage, Group, GroupMessage } from '../types';

// Single source of truth for the backend base URL. `EXPO_PUBLIC_*` env vars are inlined by
// Metro at build time automatically (Expo SDK 49+) - no app.config.js or extra package needed.
// Set EXPO_PUBLIC_API_URL when testing on a physical device (it needs the host machine's real
// LAN IP; localhost/10.0.2.2 only work for simulators/emulators running on the same machine).
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;

  if (__DEV__) {
    // The Android emulator cannot reach the host machine via `localhost` - 10.0.2.2 is the
    // documented alias for the host loopback interface. The iOS simulator can use localhost
    // directly since it shares the host's network namespace.
    return Platform.OS === 'android' ? 'http://10.0.2.2:5000/api' : 'http://localhost:5000/api';
  }

  return 'https://api.cricroots.com/api';
}

export const API_BASE_URL = resolveBaseUrl();

// In-memory auth token, kept in sync by useAuth after it hydrates from SecureStore (SecureStore
// access is async, so unlike web's synchronous localStorage read, the token can't be looked up
// fresh on every single request the way web-app's apiFetch does).
let currentToken: string | null = null;
export function setAuthToken(token: string | null) {
  currentToken = token;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  [key: string]: any;
}

async function apiFetch<T = any>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;

  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    method,
    headers,
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

  // Includes the URL and status in the fallback message on purpose - "Invalid server response"
  // alone gives no clue whether the request hit the wrong host entirely vs. a real backend bug,
  // which was genuinely hard to diagnose during early pilot testing.
  const data = await response.json().catch(() => ({
    success: false,
    message: `Invalid server response from ${url} (status ${response.status})`
  }));

  if (!response.ok || data.success === false) {
    throw new Error(data.message || `Request failed: ${response.status}`);
  }

  return data as T;
}

// --- Auth (backend/src/routes/authRoutes.js) ---
export const authAPI = {
  register: (name: string, email: string, password: string, role = 'player') =>
    apiFetch<{ success: true; token: string; user: { id: string; name: string; email: string; role: string } }>(
      '/auth/register', 'POST', { name, email, password, role }
    ),
  login: (email: string, password: string) =>
    apiFetch<{ success: true; token: string; user: { id: string; name: string; email: string; role: string } }>(
      '/auth/login', 'POST', { email, password }
    ),
  // There is no /auth/logout on the backend - logging out is purely a client-side token clear.
  getCurrentUser: () => apiFetch<{ success: true; user: any }>('/auth/me'),
};

// --- Users / network (backend/src/routes/userRoutes.js) ---
export const usersAPI = {
  getProfile: (userId: string) => apiFetch<{ success: true; user: any }>(`/users/${userId}`),
  getFollowers: (userId: string) => apiFetch<{ success: true; followers: any[] }>(`/users/${userId}/followers`),
  getFollowing: (userId: string) => apiFetch<{ success: true; following: any[] }>(`/users/${userId}/following`),
  follow: (userId: string) => apiFetch(`/users/${userId}/follow`, 'POST'),
  unfollow: (userId: string) => apiFetch(`/users/${userId}/follow`, 'DELETE'),
};

// --- Players (backend/src/routes/playerRoutes.js) ---
export const playersAPI = {
  getPlayers: () => apiFetch<{ success: true; players: any[] }>('/players'),
  getPlayerById: (playerId: string) => apiFetch<{ success: true; player: any }>(`/players/${playerId}`),
  register: (data: { user: string; specialization: string; battingStyle: string; bowlingStyle?: string }) =>
    apiFetch<{ success: true; player: any }>('/players/register', 'POST', data),
  update: (playerId: string, data: any) => apiFetch(`/players/${playerId}`, 'PUT', data),
  getMyProfile: () => apiFetch<{ success: true; player: any }>('/players/me/profile'),
};

// --- Player stats (backend/src/routes/playerStatsRoutes.js) - career stats, wagon wheel,
//     wicketkeeper stats, and achievement badges, all computed live from match data ---
export const playerStatsAPI = {
  getStats: (playerId: string) => apiFetch<{ success: true; stats: any }>(`/player-stats/${playerId}`),
  getTopBatsmen: (limit = 10) => apiFetch<{ success: true; batsmen: any[] }>(`/player-stats/rankings/batsmen?limit=${limit}`),
  getTopBowlers: (limit = 10) => apiFetch<{ success: true; bowlers: any[] }>(`/player-stats/rankings/bowlers?limit=${limit}`),
};

// --- Teams (backend/src/routes/teamRoutes.js) ---
export const teamsAPI = {
  getTeams: () => apiFetch<{ success: true; teams: any[] }>('/teams'),
  getTeamById: (teamId: string) => apiFetch<{ success: true; team: any }>(`/teams/${teamId}`),
  createTeam: (data: { name: string; description?: string; city: string }) =>
    apiFetch<{ success: true; team: any }>('/teams', 'POST', data),
  updateTeam: (teamId: string, data: any) => apiFetch(`/teams/${teamId}`, 'PUT', data),
  deleteTeam: (teamId: string) => apiFetch(`/teams/${teamId}`, 'DELETE'),
  addPlayer: (teamId: string, playerId: string) => apiFetch(`/teams/${teamId}/add-player`, 'POST', { playerId }),
  removePlayer: (teamId: string, playerId: string) => apiFetch(`/teams/${teamId}/remove-player/${playerId}`, 'DELETE'),
  getMessages: (teamId: string) => apiFetch<{ success: true; messages: any[] }>(`/teams/${teamId}/messages`),
  postMessage: (teamId: string, text: string) => apiFetch(`/teams/${teamId}/messages`, 'POST', { text }),
};

// --- Matches (backend/src/routes/matchRoutes.js) ---
export const matchesAPI = {
  getMatches: () => apiFetch<{ success: true; matches: any[] }>('/matches'),
  getMatchById: (matchId: string) => apiFetch<{ success: true; match: any }>(`/matches/${matchId}`),
  createMatch: (data: { title: string; team1Id: string; team2Id: string; matchType?: string; venue: string; scheduledDate: string; pitchType?: string; tournamentId?: string }) =>
    apiFetch<{ success: true; match: any }>('/matches', 'POST', data),
  updateMatch: (matchId: string, data: any) => apiFetch<{ success: true; match: any }>(`/matches/${matchId}`, 'PUT', data),
  recordBall: (matchId: string, ballEvent: any) => apiFetch(`/matches/${matchId}/record-ball`, 'POST', ballEvent),
  getScorecard: (matchId: string) => apiFetch<{ success: true; scorecard: any; aiInsights: any }>(`/matches/${matchId}/scorecard`),
  getAIInsights: (matchId: string) => apiFetch(`/matches/${matchId}/ai-insights`),
  getCharts: (matchId: string) => apiFetch<{ success: true; innings: any[] }>(`/matches/${matchId}/charts`),
  getKeyMoments: (matchId: string) => apiFetch<{ success: true; keyMoments: any[] }>(`/matches/${matchId}/key-moments`),
};

// --- Tournaments (backend/src/routes/tournamentRoutes.js) ---
export const tournamentsAPI = {
  getTournaments: () => apiFetch<{ success: true; tournaments: any[] }>('/tournaments'),
  getTournamentById: (tournamentId: string) => apiFetch<{ success: true; tournament: any }>(`/tournaments/${tournamentId}`),
  createTournament: (data: any) => apiFetch<{ success: true; tournament: any }>('/tournaments', 'POST', data),
  updateTournament: (tournamentId: string, data: any) => apiFetch(`/tournaments/${tournamentId}`, 'PUT', data),
  registerTeam: (tournamentId: string, teamId: string) => apiFetch(`/tournaments/${tournamentId}/register-team`, 'POST', { teamId }),
  getStandings: (tournamentId: string) => apiFetch<{ success: true; standings: any[] }>(`/tournaments/${tournamentId}/standings`),
  getTournamentMatches: (tournamentId: string) => apiFetch<{ success: true; matches: any[] }>(`/tournaments/${tournamentId}/matches`),
  getStatistics: (tournamentId: string) => apiFetch(`/tournaments/${tournamentId}/statistics`),
  generateFixtures: (tournamentId: string, format?: 'round-robin' | 'knockout') =>
    apiFetch(`/tournaments/${tournamentId}/generate-fixtures`, 'POST', format ? { format } : {}),
  computeAwards: (tournamentId: string) => apiFetch(`/tournaments/${tournamentId}/compute-awards`, 'POST'),
  getMessages: (tournamentId: string) => apiFetch<{ success: true; messages: any[] }>(`/tournaments/${tournamentId}/messages`),
  postMessage: (tournamentId: string, text: string) => apiFetch(`/tournaments/${tournamentId}/messages`, 'POST', { text }),
};

// --- Tactical insights (backend/src/routes/insightsRoutes.js) ---
export const insightsAPI = {
  getShotAdvice: (playerId: string) => apiFetch(`/insights/batsman/${playerId}/shot-advice`),
  getBowlingPlan: (playerId: string) => apiFetch(`/insights/batsman/${playerId}/bowling-plan`),
  getFieldingPlan: (playerId: string) => apiFetch(`/insights/batsman/${playerId}/fielding-plan`),
  getBowlerScouting: (teamId: string) => apiFetch(`/insights/teams/${teamId}/bowler-scouting`),
};

// --- Edtech lessons (backend/src/routes/lessonRoutes.js) ---
export const lessonsAPI = {
  getLessons: () => apiFetch<{ success: true; lessons: any[] }>('/lessons'),
  getLessonById: (lessonId: string) => apiFetch<{ success: true; lesson: any }>(`/lessons/${lessonId}`),
  createLesson: (data: any) => apiFetch('/lessons', 'POST', data),
  // Personalized recommendations matched against the logged-in player's own weak line/length
  // buckets (falls back to a generic set - source distinguishes the two).
  getForMe: () =>
    apiFetch<{ success: true; source: 'own-data' | 'generic'; reason: string; lessons: any[] }>('/lessons/for-me'),
};

// --- News (backend/src/routes/newsRoutes.js) ---
export const newsAPI = {
  getPosts: () => apiFetch<{ success: true; posts: any[] }>('/news'),
  getPostById: (postId: string) => apiFetch<{ success: true; post: any }>(`/news/${postId}`),
  createPost: (data: any) => apiFetch('/news', 'POST', data),
  // Personalized "for you" feed - general news plus match-report articles for every tournament
  // the logged-in user's Player profile is registered in.
  getFeed: () =>
    apiFetch<{ success: true; count: number; posts: any[]; myTournaments: string[] }>('/news/feed'),
};

// --- Marketplace products (backend/src/routes/productRoutes.js) ---
export const productsAPI = {
  getProducts: (category?: string) => apiFetch<{ success: true; products: any[] }>(`/products${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  getProductById: (productId: string) => apiFetch<{ success: true; product: any }>(`/products/${productId}`),
  createProduct: (data: any) => apiFetch('/products', 'POST', data),
};

// --- Orders (backend/src/routes/orderRoutes.js) - there is no server-side "cart" resource;
//     the cart is client-side state (see CartContext) and only submitted as an order at checkout ---
export const ordersAPI = {
  createOrder: (data: { items: any[]; totalAmount: number; paymentMethod: string }) => apiFetch('/orders', 'POST', data),
  getMyOrders: () => apiFetch<{ success: true; orders: any[] }>('/orders/my'),
  getSellingOrders: () => apiFetch<{ success: true; orders: any[] }>('/orders/selling'),
  updateOrderStatus: (orderId: string, status: string) => apiFetch(`/orders/${orderId}/status`, 'PUT', { status }),
};

// --- Match predictions (backend/src/routes/predictionRoutes.js) - a free, points-based
//     predict-the-winner game, NOT real-money betting. Predictions lock once a match goes Live
//     and settle automatically server-side when a match completes. ---
export const predictionsAPI = {
  submit: (matchId: string, predictedWinnerId: string, predictedMotmId?: string) =>
    apiFetch<{ success: true; prediction: Prediction }>('/predictions', 'POST', {
      matchId,
      predictedWinnerId,
      ...(predictedMotmId && { predictedMotmId }),
    }),
  getForMatch: (matchId: string) =>
    apiFetch<{
      success: true;
      mine: Prediction | null;
      totalPredictions: number;
      communitySplit: Record<string, number>;
    }>(`/predictions/match/${matchId}`),
  getMine: () =>
    apiFetch<{ success: true; predictions: Prediction[]; totalPoints: number }>('/predictions/me'),
  getLeaderboard: (limit = 50) =>
    apiFetch<{ success: true; leaderboard: LeaderboardEntry[] }>(`/predictions/leaderboard?limit=${limit}`),
};

// --- Direct 1:1 messages (backend/src/routes/directMessageRoutes.js, mounted at /api/messages) -
//     separate from the Team/Tournament group chat above. Fetching a thread marks the other
//     person's messages to you as read server-side; there's no separate mark-as-read endpoint. ---
export const messagesAPI = {
  getConversations: () => apiFetch<{ success: true; conversations: Conversation[] }>('/messages/conversations'),
  getUnreadCount: () => apiFetch<{ success: true; count: number }>('/messages/unread-count'),
  getThread: (userId: string) => apiFetch<{ success: true; messages: DirectMessage[] }>(`/messages/${userId}`),
  sendMessage: (userId: string, text: string) =>
    apiFetch<{ success: true; message: DirectMessage }>(`/messages/${userId}`, 'POST', { text }),
};

// --- Team group chat (backend/src/routes/groupRoutes.js, mounted at /api/groups) - WhatsApp-
//     style groups with text/poll/image/video messages. Separate from both direct messages
//     (messagesAPI) and the simple Team/Tournament announcement chat (teamsAPI.getMessages /
//     tournamentsAPI.getMessages) above. ---

// Attachment URLs come back as a path relative to the backend's origin (e.g.
// "/uploads/group-attachments/xyz.png"), not the /api-suffixed API_BASE_URL - strip the /api
// suffix to get the real host to load images/videos from.
export function resolveAttachmentUrl(relativeUrl: string): string {
  return `${API_BASE_URL.replace(/\/api$/, '')}${relativeUrl}`;
}

// Multipart upload can't reuse apiFetch's JSON-only body handling - FormData needs its own
// auto-generated multipart boundary Content-Type, which fetch sets itself as long as we don't
// override it by hand.
async function apiUpload<T = any>(path: string, file: { uri: string; name: string; type: string }): Promise<T> {
  const formData = new FormData();
  // React Native's fetch accepts this {uri,name,type} shape as a Blob-like value for FormData,
  // even though it doesn't match the DOM File type - hence the `any` cast.
  formData.append('file', { uri: file.uri, name: file.name, type: file.type } as any);

  const headers: Record<string, string> = {};
  if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;

  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, { method: 'POST', headers, body: formData });

  const data = await response.json().catch(() => ({
    success: false,
    message: `Invalid server response from ${url} (status ${response.status})`
  }));

  if (!response.ok || data.success === false) {
    throw new Error(data.message || `Request failed: ${response.status}`);
  }

  return data as T;
}

export const groupsAPI = {
  getGroups: () => apiFetch<{ success: true; groups: Group[] }>('/groups'),
  createGroup: (data: { name: string; teamId?: string; memberIds?: string[] }) =>
    apiFetch<{ success: true; group: Group }>('/groups', 'POST', data),
  getGroup: (groupId: string) => apiFetch<{ success: true; group: Group }>(`/groups/${groupId}`),
  updateGroup: (groupId: string, data: { name?: string; addMemberIds?: string[]; removeMemberIds?: string[] }) =>
    apiFetch<{ success: true; group: Group }>(`/groups/${groupId}`, 'PUT', data),
  leaveGroup: (groupId: string) => apiFetch<{ success: true; message: string }>(`/groups/${groupId}/leave`, 'POST'),
  deleteGroup: (groupId: string) => apiFetch<{ success: true; message: string }>(`/groups/${groupId}`, 'DELETE'),
  getMessages: (groupId: string) => apiFetch<{ success: true; messages: GroupMessage[] }>(`/groups/${groupId}/messages`),
  postMessage: (groupId: string, text: string) =>
    apiFetch<{ success: true; message: GroupMessage }>(`/groups/${groupId}/messages`, 'POST', { text }),
  createPoll: (groupId: string, data: { question: string; options: string[]; allowMultiple?: boolean }) =>
    apiFetch<{ success: true; message: GroupMessage }>(`/groups/${groupId}/polls`, 'POST', data),
  vote: (groupId: string, messageId: string, optionId: string) =>
    apiFetch<{ success: true; message: GroupMessage }>(`/groups/${groupId}/polls/${messageId}/vote`, 'POST', { optionId }),
  postAttachment: (groupId: string, file: { uri: string; name: string; type: string }) =>
    apiUpload<{ success: true; message: GroupMessage }>(`/groups/${groupId}/attachments`, file),
};

export const api = {
  auth: authAPI,
  users: usersAPI,
  players: playersAPI,
  playerStats: playerStatsAPI,
  teams: teamsAPI,
  matches: matchesAPI,
  tournaments: tournamentsAPI,
  insights: insightsAPI,
  lessons: lessonsAPI,
  news: newsAPI,
  products: productsAPI,
  orders: ordersAPI,
  predictions: predictionsAPI,
  messages: messagesAPI,
  groups: groupsAPI,
};

export default api;
