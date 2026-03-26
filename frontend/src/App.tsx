import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppProvider, useAppState } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import { IntroProvider } from './context/IntroContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout/Layout';
import { GenerateView } from './components/GenerateView/GenerateView';
import { ConversationDetail } from './components/ConversationDetail/ConversationDetail';
import { HistorySidebar } from './components/HistorySidebar/HistorySidebar';
import { LoginPage } from './components/LoginPage/LoginPage';
import { UserManagement } from './components/UserManagement/UserManagement';
import { AnalyticsDashboard } from './components/AnalyticsDashboard/AnalyticsDashboard';
import { useHeartbeat } from './hooks/useHeartbeat';
import './App.css';

function MainContent() {
  const { view, selectedConversationId, history } = useAppState();
  const { isAdmin } = useAuth();
  const selectedConv = history.find((c) => c.id === selectedConversationId);

  return (
    <AnimatePresence mode="wait">
      {view === 'analytics' && isAdmin ? (
        <motion.div
          key="analytics"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <AnalyticsDashboard />
        </motion.div>
      ) : view === 'user-management' && isAdmin ? (
        <motion.div
          key="user-mgmt"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <UserManagement />
        </motion.div>
      ) : view === 'generate' || !selectedConv ? (
        <motion.div
          key="generate"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <GenerateView />
        </motion.div>
      ) : (
        <motion.div
          key={selectedConv.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <ConversationDetail conversation={selectedConv} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AppContent() {
  useHeartbeat();
  return (
    <Layout sidebar={<HistorySidebar />}>
      <MainContent />
    </Layout>
  );
}

function AuthGate() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--color-bg-void)',
      }}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          style={{
            color: 'var(--color-text-tertiary)',
            font: 'var(--text-body)',
          }}
        >
          Loading...
        </motion.div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <LoginPage />;
  }

  return (
    <IntroProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </IntroProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
