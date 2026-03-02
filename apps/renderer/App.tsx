import React from 'react';
import { useAppController } from './hooks/useAppController';
import Sidebar from './components/Sidebar';
import ChatMain from './components/ChatMain';
import TitleBar from './components/TitleBar';
import SettingsModal from './components/SettingsModal';

function App() {
  const { settingsModalProps, sidebarProps, chatMainProps } = useAppController();

  return (
    <div className="app-shell flex h-screen text-[var(--ink-1)] overflow-hidden">
      <TitleBar />

      {/* Settings Modal */}
      <SettingsModal {...settingsModalProps} />

      {/* Sidebar */}
      <Sidebar {...sidebarProps} />

      <ChatMain {...chatMainProps} />
    </div>
  );
}

export default App;
