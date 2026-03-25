import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppProvider, useAppState } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import { IntroProvider } from './context/IntroContext';
import { Layout } from './components/Layout/Layout';
import { GenerateView } from './components/GenerateView/GenerateView';
import { ConversationDetail } from './components/ConversationDetail/ConversationDetail';
import { HistorySidebar } from './components/HistorySidebar/HistorySidebar';
import './App.css';

function MainContent() {
  const { view, selectedConversationId, history } = useAppState();
  const selectedConv = history.find((c) => c.id === selectedConversationId);

  return (
    <AnimatePresence mode="wait">
      {view === 'generate' || !selectedConv ? (
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
  return (
    <Layout sidebar={<HistorySidebar />}>
      <MainContent />
    </Layout>
  );
}

function App() {
  return (
    <ThemeProvider>
      <IntroProvider>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </IntroProvider>
    </ThemeProvider>
  );
}

export default App;
