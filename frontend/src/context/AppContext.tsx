import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { AppState, AppAction } from '../types';

const STORAGE_KEY = 'resolve_app_state';

function loadPersistedState(): Partial<AppState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function persistState(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      selectedConversationId: state.selectedConversationId,
      view: state.view,
    }));
  } catch {}
}

const persisted = loadPersistedState();

const initialState: AppState = {
  query: '',
  response: '',
  editedResponse: '',
  customPrompt: '',
  promptModeEnabled: false,
  isLoading: false,
  reasoning: null,
  sources: [],
  history: [],
  selectedConversationId: persisted.selectedConversationId ?? null,
  view: persisted.view ?? 'generate',
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_QUERY':
      return { ...state, query: action.payload };
    case 'SET_CUSTOM_PROMPT':
      return { ...state, customPrompt: action.payload };
    case 'TOGGLE_PROMPT_MODE':
      return { ...state, promptModeEnabled: !state.promptModeEnabled };
    case 'GENERATE_START':
      return { ...state, isLoading: true, response: '', editedResponse: '', reasoning: null, sources: [] };
    case 'GENERATE_SUCCESS':
      return {
        ...state,
        isLoading: false,
        response: action.payload.response,
        editedResponse: action.payload.response,
        reasoning: action.payload.reasoning || null,
        sources: action.payload.sources || [],
        history: [action.payload.conversation, ...state.history],
        selectedConversationId: action.payload.conversation.id,
        view: 'history',
      };
    case 'SET_EDITED_RESPONSE':
      return { ...state, editedResponse: action.payload };
    case 'CLEAR_RESPONSE':
      return { ...state, response: '', editedResponse: '', query: '', reasoning: null, sources: [] };
    case 'LOAD_HISTORY': {
      const existingIds = new Set(state.history.map((c) => c.id));
      const newEntries = action.payload.filter((c) => !existingIds.has(c.id));
      return { ...state, history: [...state.history, ...newEntries] };
    }
    case 'UPDATE_CONVERSATION_RESPONSE': {
      const updatedHistory = state.history.map((c) =>
        c.id === action.payload.id ? { ...c, response: action.payload.response } : c
      );
      return { ...state, history: updatedHistory };
    }
    case 'DELETE_HISTORY_ITEM': {
      const newHistory = state.history.filter((c) => c.id !== action.payload);
      const wasSelected = state.selectedConversationId === action.payload;
      return {
        ...state,
        history: newHistory,
        selectedConversationId: wasSelected ? null : state.selectedConversationId,
        view: wasSelected ? 'generate' : state.view,
      };
    }
    case 'CLEAR_ALL_HISTORY':
      return { ...state, history: [], selectedConversationId: null, view: 'generate' };
    case 'SELECT_CONVERSATION':
      return { ...state, selectedConversationId: action.payload, view: 'history' };
    case 'NEW_QUERY':
      return {
        ...state,
        selectedConversationId: null,
        view: 'generate',
        query: '',
        response: '',
        editedResponse: '',
        customPrompt: '',
        reasoning: null,
        sources: [],
      };
    case 'NAVIGATE_USER_MANAGEMENT':
      return { ...state, view: 'user-management', selectedConversationId: null };
    case 'NAVIGATE_ANALYTICS':
      return { ...state, view: 'analytics', selectedConversationId: null };
    default:
      return state;
  }
}

const AppStateContext = createContext<AppState>(initialState);
const AppDispatchContext = createContext<React.Dispatch<AppAction>>(() => {});

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    persistState(state);
  }, [state.selectedConversationId, state.view]);

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        {children}
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppState {
  return useContext(AppStateContext);
}

export function useAppDispatch(): React.Dispatch<AppAction> {
  return useContext(AppDispatchContext);
}
