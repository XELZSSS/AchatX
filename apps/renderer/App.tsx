import { useAppController } from '@/presentation/hooks/app/useAppController';
import Sidebar from '@/presentation/components/Sidebar';
import ChatMain from '@/presentation/components/ChatMain';
import TitleBar from '@/presentation/components/TitleBar';
import SettingsModal from '@/presentation/components/SettingsModal';

function App() {
  const { language, settingsModalProps, sidebarProps, chatMainProps } = useAppController();

  return (
    <div className="app-shell flex h-screen text-[var(--ink-1)] overflow-hidden">
      <TitleBar language={language} />

      {/* Settings Modal */}
      <SettingsModal {...settingsModalProps} />

      {/* Sidebar */}
      <Sidebar {...sidebarProps} />

      <ChatMain {...chatMainProps} />
    </div>
  );
}

export default App;
