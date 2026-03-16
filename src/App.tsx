/**
 * @file App.tsx
 * @description Composes the persistent shell, view router, and modal layer for the God-Mode dashboard.
 * @ai_context This is the frontend entry surface for the ZeroClaw operator experience and will remain the visual shell during backend integration.
 */
import { memo } from 'react';
import { TopBar } from './components/layout/TopBar';
import { LeftSidebar } from './components/layout/LeftSidebar';
import { SocietyHub } from './features/society-hub/SocietyHub';
import { MarketAnalytics } from './features/analytics/MarketAnalytics';
import { WorldMap } from './features/world-map/WorldMap';
import { Citizens } from './features/citizens/Citizens';
import { SeedModal } from './components/modals/SeedModal';
import { useWorldStore } from './store/useWorldStore';

const MainCanvas = memo(function MainCanvas() {
  const currentView = useWorldStore((s) => s.currentView);

  return (
    <main className="flex-1 ml-16 relative overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900 to-black">
      <div className="h-full flex flex-col">
        {currentView === 'hub' && <SocietyHub />}
        {currentView === 'analytics' && <MarketAnalytics />}
        {currentView === 'map' && <WorldMap />}
        {currentView === 'citizens' && <Citizens />}
        {currentView === 'settings' && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center font-mono">
              <div className="text-zinc-700 text-lg tracking-[0.3em] uppercase">Settings Panel</div>
              <div className="text-zinc-800 text-xs mt-2 animate-pulse">{'> Configuration module loading...'}</div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
});

function App() {
  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-zinc-950 text-zinc-100">
      <TopBar />

      <div className="flex flex-1 overflow-hidden mt-14">
        <LeftSidebar />
        <MainCanvas />
      </div>

      <SeedModal />
    </div>
  );
}

export default App;
