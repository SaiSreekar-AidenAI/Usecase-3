import { Conversation, RetrievedSource } from '../types';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

export async function generateResponse(
  query: string,
  customPrompt?: string
): Promise<{ response: string; reasoning: string | null; sources: RetrievedSource[]; conversation: Conversation }> {
  const res = await fetch(`${API_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  const res = await fetch(`${API_BASE}/api/history`);
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
}

export async function updateHistoryItem(id: string, response: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/history/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ response }),
  });
  if (!res.ok) throw new Error('Failed to update conversation');
}

export async function deleteHistoryItem(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/history/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete conversation');
}

export async function clearAllHistory(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/history`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to clear history');
}
