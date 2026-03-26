import {
  Conversation, RetrievedSource, User,
  OverviewStats, DailyActivityPoint, AuditEvent,
  LoginAttempt, SessionActivity, TokenUsagePoint,
  TokenByUser, SecurityAlert, HeatmapCell,
} from '../types';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';
let historyInFlight: Promise<Conversation[]> | null = null;

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('resolve_session_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    headers['X-Device-Info'] = JSON.stringify({
      screen: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      platform: navigator.platform,
    });
  } catch {}
  return headers;
}

// ── Existing API functions (now with auth) ──────────────────

export async function generateResponse(
  query: string,
  customPrompt?: string
): Promise<{ response: string; reasoning: string | null; sources: RetrievedSource[]; conversation: Conversation }> {
  const res = await fetch(`${API_BASE}/api/generate`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify({ query, customPrompt: customPrompt || null }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || 'Failed to generate response');
  }

  const data = await res.json();
  return {
    response: data.response,
    reasoning: data.reasoning || null,
    sources: data.sources || [],
    conversation: data.conversation,
  };
}

export async function fetchHistory(): Promise<Conversation[]> {
  if (historyInFlight) return historyInFlight;

  historyInFlight = (async () => {
    const res = await fetch(`${API_BASE}/api/history`, {
      headers: authHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to fetch history');
    return res.json();
  })();

  try {
    return await historyInFlight;
  } finally {
    historyInFlight = null;
  }
}

export async function updateHistoryItem(id: string, response: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/history/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify({ response }),
  });
  if (!res.ok) throw new Error('Failed to update conversation');
}

export async function deleteHistoryItem(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/history/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to delete conversation');
}

export async function clearAllHistory(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/history`, {
    method: 'DELETE',
    headers: authHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to clear history');
}

// ── Auth API functions ──────────────────────────────────────

export async function checkEmail(email: string): Promise<{ email: string; requires_password: boolean; user_name: string }> {
  const res = await fetch(`${API_BASE}/api/auth/check-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || 'Failed to check email');
  }
  return res.json();
}

export async function loginUser(email: string, password?: string): Promise<{ user: User; token: string }> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password: password || null }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || 'Login failed');
  }
  return res.json();
}

export async function fetchCurrentUser(): Promise<User> {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: authHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Not authenticated');
  return res.json();
}

export async function logoutUser(): Promise<void> {
  await fetch(`${API_BASE}/api/auth/logout`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include',
  });
}

// ── User Management API functions ───────────────────────────

export async function fetchUsers(): Promise<User[]> {
  const res = await fetch(`${API_BASE}/api/users`, {
    headers: authHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

export async function createUserApi(data: {
  email: string;
  name: string;
  role: string;
  password?: string;
}): Promise<User> {
  const res = await fetch(`${API_BASE}/api/users`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || 'Failed to create user');
  }
  return res.json();
}

export async function updateUserApi(
  userId: string,
  data: { name?: string; role?: string; password?: string; is_active?: boolean }
): Promise<User> {
  const res = await fetch(`${API_BASE}/api/users/${userId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || 'Failed to update user');
  }
  return res.json();
}

export async function deleteUserApi(userId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/users/${userId}`, {
    method: 'DELETE',
    headers: authHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to delete user');
}

// ── Analytics API functions ─────────────────────────────────

export async function fetchOverviewStats(): Promise<OverviewStats> {
  const res = await fetch(`${API_BASE}/api/analytics/overview`, {
    headers: authHeaders(), credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch overview stats');
  return res.json();
}

export async function fetchDailyActivity(days: number = 30): Promise<DailyActivityPoint[]> {
  const res = await fetch(`${API_BASE}/api/analytics/daily-activity?days=${days}`, {
    headers: authHeaders(), credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch daily activity');
  return res.json();
}

export async function fetchAuditLog(params: {
  page?: number; limit?: number; event_type?: string;
  user_id?: string; from_ts?: number; to_ts?: number;
}): Promise<{ items: AuditEvent[]; total: number; page: number; limit: number }> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.event_type) qs.set('event_type', params.event_type);
  if (params.user_id) qs.set('user_id', params.user_id);
  if (params.from_ts) qs.set('from_ts', String(params.from_ts));
  if (params.to_ts) qs.set('to_ts', String(params.to_ts));
  const res = await fetch(`${API_BASE}/api/analytics/audit-log?${qs}`, {
    headers: authHeaders(), credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch audit log');
  return res.json();
}

export async function fetchLoginAttempts(params: {
  page?: number; limit?: number; success?: boolean;
  from_ts?: number; to_ts?: number;
}): Promise<{ items: LoginAttempt[]; total: number; page: number; limit: number }> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.success !== undefined) qs.set('success', String(params.success));
  if (params.from_ts) qs.set('from_ts', String(params.from_ts));
  if (params.to_ts) qs.set('to_ts', String(params.to_ts));
  const res = await fetch(`${API_BASE}/api/analytics/login-attempts?${qs}`, {
    headers: authHeaders(), credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch login attempts');
  return res.json();
}

export async function fetchSessions(): Promise<SessionActivity[]> {
  const res = await fetch(`${API_BASE}/api/analytics/sessions`, {
    headers: authHeaders(), credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch sessions');
  return res.json();
}

export async function fetchTokenUsage(params: {
  from_ts?: number; to_ts?: number; group_by?: 'day' | 'hour';
}): Promise<TokenUsagePoint[]> {
  const qs = new URLSearchParams();
  if (params.from_ts) qs.set('from_ts', String(params.from_ts));
  if (params.to_ts) qs.set('to_ts', String(params.to_ts));
  if (params.group_by) qs.set('group_by', params.group_by);
  const res = await fetch(`${API_BASE}/api/analytics/token-usage?${qs}`, {
    headers: authHeaders(), credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch token usage');
  return res.json();
}

export async function fetchTokenByUser(): Promise<TokenByUser[]> {
  const res = await fetch(`${API_BASE}/api/analytics/token-by-user`, {
    headers: authHeaders(), credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch token by user');
  return res.json();
}

export async function fetchSecurityAlerts(): Promise<SecurityAlert[]> {
  const res = await fetch(`${API_BASE}/api/analytics/security-alerts`, {
    headers: authHeaders(), credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch security alerts');
  return res.json();
}

export async function fetchUsageHeatmap(): Promise<HeatmapCell[]> {
  const res = await fetch(`${API_BASE}/api/analytics/usage-heatmap`, {
    headers: authHeaders(), credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch usage heatmap');
  return res.json();
}

export async function sendHeartbeat(active: boolean): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/analytics/heartbeat`, {
      method: 'POST',
      headers: authHeaders(),
      credentials: 'include',
      body: JSON.stringify({ active }),
    });
  } catch {}
}
