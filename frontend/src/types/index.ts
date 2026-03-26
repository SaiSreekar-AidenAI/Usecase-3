export interface RetrievedSource {
  category: string;
  description: string;
  response: string;
  relevance_score: number;
}

export interface Conversation {
  id: string;
  query: string;
  response: string;
  reasoning?: string | null;
  sources?: RetrievedSource[] | null;
  customPrompt?: string;
  timestamp: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'associate';
  is_active?: boolean;
}

export interface AppState {
  query: string;
  response: string;
  editedResponse: string;
  customPrompt: string;
  promptModeEnabled: boolean;
  isLoading: boolean;
  reasoning: string | null;
  sources: RetrievedSource[];
  history: Conversation[];
  selectedConversationId: string | null;
  view: 'generate' | 'history' | 'user-management' | 'analytics';
}

export type AppAction =
  | { type: 'SET_QUERY'; payload: string }
  | { type: 'SET_CUSTOM_PROMPT'; payload: string }
  | { type: 'TOGGLE_PROMPT_MODE' }
  | { type: 'GENERATE_START' }
  | { type: 'GENERATE_SUCCESS'; payload: { response: string; reasoning?: string | null; sources?: RetrievedSource[]; conversation: Conversation } }
  | { type: 'SET_EDITED_RESPONSE'; payload: string }
  | { type: 'CLEAR_RESPONSE' }
  | { type: 'LOAD_HISTORY'; payload: Conversation[] }
  | { type: 'UPDATE_CONVERSATION_RESPONSE'; payload: { id: string; response: string } }
  | { type: 'DELETE_HISTORY_ITEM'; payload: string }
  | { type: 'CLEAR_ALL_HISTORY' }
  | { type: 'SELECT_CONVERSATION'; payload: string }
  | { type: 'NEW_QUERY' }
  | { type: 'NAVIGATE_USER_MANAGEMENT' }
  | { type: 'NAVIGATE_ANALYTICS' };

// ── Analytics types ────────────────────────────────────────

export interface OverviewStats {
  total_users: number;
  active_users_24h: number;
  active_sessions: number;
  total_queries: number;
  total_tokens: number;
  queries_today: number;
  tokens_today: number;
}

export interface DailyActivityPoint {
  date: string;
  logins: number;
  queries: number;
  tokens: number;
}

export interface AuditEvent {
  id: string;
  event_type: string;
  user_email: string | null;
  user_role: string | null;
  ip_address: string | null;
  resource_type: string | null;
  resource_id: string | null;
  metadata_json: string | null;
  timestamp: number;
}

export interface LoginAttempt {
  id: string;
  user_email: string;
  success: boolean;
  ip_address: string | null;
  country: string | null;
  city: string | null;
  browser: string | null;
  os: string | null;
  device_type: string | null;
  failure_reason: string | null;
  timestamp: number;
}

export interface SessionActivity {
  session_id: string;
  user_id: string;
  user_email: string | null;
  started_at: number;
  last_activity_at: number;
  active_duration_ms: number;
  idle_duration_ms: number;
  actions_count: number;
  is_active: boolean;
}

export interface TokenUsagePoint {
  date: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  request_count: number;
}

export interface TokenByUser {
  user_id: string;
  user_email: string | null;
  total_tokens: number;
  request_count: number;
  avg_tokens_per_request: number;
}

export interface SecurityAlert {
  alert_type: string;
  severity: 'low' | 'medium' | 'high';
  user_email: string | null;
  description: string;
  details: Record<string, any>;
  timestamp: number;
}

export interface HeatmapCell {
  day_of_week: number;
  hour: number;
  count: number;
}
