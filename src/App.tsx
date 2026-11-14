import {useCallback, useEffect, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {
  Activity,
  BarChart3,
  Bot,
  Flame,
  Gamepad2,
  Globe,
  X,
} from 'lucide-react';
import {AiAssistantView} from './components/AiAssistantView';
import {DeviceDashboard} from './components/DeviceDashboard';
import {GamesStorageView} from './components/GamesStorageView';
import {NetworkCheckerView} from './components/NetworkCheckerView';
import {SessionsThermalView} from './components/SessionsThermalView';
import {translations} from './i18n/translations';
import {getDeviceSnapshot, measureRealPing} from './services/androidBridge';
import {loadGameProfiles} from './services/gameProfilesStorage';
import type {DeviceSnapshot, GameProfile, NavTabId, PingMeasurement} from './types/gamemind';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTabId>('dashboard');

  const [snapshot, setSnapshot] = useState<DeviceSnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);

  const [ping, setPing] = useState<PingMeasurement | null>(null);
  const [pingLoading, setPingLoading] = useState(false);
  const [pingError, setPingError] = useState<string | null>(null);

  const [thermalAlert, setThermalAlert] = useState<string | null>(null);
  const [pendingProfile, setPendingProfile] = useState<GameProfile | null>(null);
  const [logoError, setLogoError] = useState(false);

  const refreshSnapshot = useCallback(async () => {
    setSnapshotLoading(true);
    setSnapshotError(null);
    try {
      const data = await getDeviceSnapshot();
      setSnapshot(data);
    } catch (err) {
      setSnapshotError(
        err instanceof Error ? err.message : 'تعذر قراءة بيانات الجهاز حالياً، جرب تحديث القراءة.',
      );
    } finally {
      setSnapshotLoading(false);
    }
  }, []);

  const handleMeasurePing = useCallback(async () => {
    setPingLoading(true);
    setPingError(null);
    try {
      const result = await measureRealPing(5);
      setPing(result);
    } catch (err) {
      setPingError(err instanceof Error ? err.message : 'فشل قياس البنق الحقيقي.');
    } finally {
      setPingLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSnapshot();
  }, [refreshSnapshot]);

  function handleStartSmartSessionFromHome() {
    const first = loadGameProfiles()[0] ?? null;
    setPendingProfile(first);
    setActiveTab('sessions');
  }

  function handleStartSessionForProfile(profile: GameProfile) {
    setPendingProfile(profile);
    setActiveTab('sessions');
  }

  const navItems: Array<{id: NavTabId; label: string; icon: typeof Activity}> = [
    {id: 'dashboard', label: translations.nav.dashboard, icon: Activity},
    {id: 'network', label: translations.nav.network, icon: Globe},
    {id: 'games', label: translations.nav.games, icon: Gamepad2},
    {id: 'assistant', label: translations.nav.assistant, icon: Bot},
    {id: 'sessions', label: translations.nav.sessions, icon: BarChart3},
  ];

  return (
    <div dir="rtl" className="min-h-dvh text-slate-100">
      {/* Sleek Glass Top Bar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07080F]/75 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-2.5 text-right"
          >
            {!logoError ? (
              <img
                src="/src/assets/images/gamemind_app_icon_1794674350490.jpg"
                alt="GameMind"
                referrerPolicy="no-referrer"
                onError={() => setLogoError(true)}
                className="h-9 w-9 rounded-xl border border-violet-400/30 object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-sky-500 text-white">
                <Bot className="h-5 w-5" />
              </div>
            )}
            <div>
              <span className="font-brand text-lg font-extrabold tracking-tight text-white">
                {translations.appName}
              </span>
              <span className="mr-2 hidden text-xs text-slate-400 sm:inline">
                {translations.appTagline}
              </span>
            </div>
          </button>

          <div className="text-xs font-semibold text-sky-300">
            {snapshot?.platform === 'android-native' ? 'Android أصلي' : 'وضع المتصفح'}
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:pb-32">
        {/* Global Thermal Warning Banner */}
        {thermalAlert && (
          <motion.div
            initial={{opacity: 0, y: -8}}
            animate={{opacity: 1, y: 0}}
            className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-rose-500/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-100 backdrop-blur-md"
          >
            <div className="flex items-center gap-2.5">
              <Flame className="h-5 w-5 shrink-0 text-rose-400" />
              <span>{thermalAlert}</span>
            </div>
            <button
              type="button"
              onClick={() => setThermalAlert(null)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-white/10"
              aria-label="إغلاق التنبيه"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{opacity: 0, y: 10}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, y: -8}}
            transition={{duration: 0.18, ease: [0.16, 1, 0.3, 1]}}
          >
            {activeTab === 'dashboard' && (
              <DeviceDashboard
                snapshot={snapshot}
                snapshotLoading={snapshotLoading}
                snapshotError={snapshotError}
                ping={ping}
                pingLoading={pingLoading}
                pingError={pingError}
                onRefreshSnapshot={refreshSnapshot}
                onMeasurePing={handleMeasurePing}
                onStartSmartSession={handleStartSmartSessionFromHome}
                onNavigate={setActiveTab}
              />
            )}

            {activeTab === 'network' && (
              <NetworkCheckerView
                snapshot={snapshot}
                ping={ping}
                pingLoading={pingLoading}
                pingError={pingError}
                onMeasurePing={handleMeasurePing}
              />
            )}

            {activeTab === 'games' && (
              <GamesStorageView
                snapshot={snapshot}
                onStartSessionForGame={handleStartSessionForProfile}
              />
            )}

            {activeTab === 'assistant' && <AiAssistantView snapshot={snapshot} ping={ping} />}

            {activeTab === 'sessions' && (
              <SessionsThermalView
                snapshot={snapshot}
                pendingProfileToStart={pendingProfile}
                onClearPendingProfile={() => setPendingProfile(null)}
                onThermalAlertChange={setThermalAlert}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Glassmorphic Bottom Navigation Bar (Mobile & Desktop Dock) */}
      <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-40 flex justify-center sm:bottom-4 sm:px-4">
        <nav
          aria-label="شريط التنقل السفلي"
          className="glass-dock pointer-events-auto grid w-full max-w-xl grid-cols-5 items-center sm:rounded-3xl"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <motion.button
                key={item.id}
                type="button"
                whileTap={{scale: 0.92}}
                onClick={() => setActiveTab(item.id)}
                className={`relative flex min-h-[60px] flex-col items-center justify-center gap-1 px-1 py-2 transition-colors ${
                  active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="gamemind-active-nav"
                    transition={{type: 'spring', stiffness: 420, damping: 32}}
                    className="absolute inset-x-2 inset-y-1.5 -z-10 rounded-2xl bg-gradient-to-l from-violet-600/35 to-sky-500/35 border border-sky-400/35"
                  />
                )}
                <Icon className={`h-5 w-5 ${active ? 'text-sky-300' : ''}`} />
                <span className="text-[11px] font-bold whitespace-nowrap">{item.label}</span>
              </motion.button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
