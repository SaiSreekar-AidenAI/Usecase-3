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
  view: 'generate' | 'history';
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
  | { type: 'NEW_QUERY' };
