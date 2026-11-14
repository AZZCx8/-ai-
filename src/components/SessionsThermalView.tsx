import {useEffect, useMemo, useState} from 'react';
import {motion} from 'motion/react';
import {
  AlertTriangle,
  BarChart3,
  Battery,
  BellOff,
  Flame,
  Play,
  Sparkles,
  Square,
  Thermometer,
  Trash2,
} from 'lucide-react';
import {
  getDeviceSnapshot,
  launchGameApp,
  measureRealPing,
  toggleDoNotDisturb,
} from '../services/androidBridge';
import {requestSessionAnalysis} from '../services/aiService';
import {loadGameProfiles, saveGameProfile} from '../services/gameProfilesStorage';
import {
  deleteSessionRecord,
  getThermalAlertThreshold,
  loadSavedSessions,
  saveSessionRecord,
  setThermalAlertThreshold,
} from '../services/sessionStorage';
import {translations} from '../i18n/translations';
import type {
  DeviceSnapshot,
  GameProfile,
  GameSessionRecord,
  SessionAiAnalysis,
  SessionTelemetrySample,
} from '../types/gamemind';

interface SessionsThermalViewProps {
  snapshot: DeviceSnapshot | null;
  pendingProfileToStart: GameProfile | null;
  onClearPendingProfile: () => void;
  onThermalAlertChange: (alertMessage: string | null) => void;
}

export function SessionsThermalView({
  snapshot,
  pendingProfileToStart,
  onClearPendingProfile,
  onThermalAlertChange,
}: SessionsThermalViewProps) {
  const [profiles] = useState<GameProfile[]>(() => loadGameProfiles());
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    () => pendingProfileToStart?.id ?? profiles[0]?.id ?? '',
  );

  const [sessions, setSessions] = useState<GameSessionRecord[]>(() => loadSavedSessions());
  const [thresholdC, setThresholdC] = useState<number>(() => getThermalAlertThreshold());
  const [chartMetric, setChartMetric] = useState<'temp' | 'battery' | 'ping'>('temp');

  // Active Smart Session state
  const [activeStartTime, setActiveStartTime] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [prePingMs, setPrePingMs] = useState<number | null>(null);
  const [batteryStart, setBatteryStart] = useState<number | null>(null);
  const [samples, setSamples] = useState<SessionTelemetrySample[]>([]);
  const [dndActive, setDndActive] = useState(false);
  const [sessionStatusNotes, setSessionStatusNotes] = useState<string[]>([]);
  const [throttlingDetected, setThrottlingDetected] = useState(false);

  // Finish session inputs
  const [stabilityScore, setStabilityScore] = useState(4);
  const [manualTempInput, setManualTempInput] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // End-of-session report + AI analysis
  const [latestReport, setLatestReport] = useState<GameSessionRecord | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<SessionAiAnalysis | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [profileUpdatedToast, setProfileUpdatedToast] = useState<string | null>(null);

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId) ?? profiles[0] ?? null,
    [profiles, selectedProfileId],
  );

  // Auto-select and start when launched from Dashboard or Games tab
  useEffect(() => {
    if (pendingProfileToStart) {
      setSelectedProfileId(pendingProfileToStart.id);
      onClearPendingProfile();
    }
  }, [pendingProfileToStart, onClearPendingProfile]);

  // 1-second timer + 10-second real battery & temperature sampling loop
  useEffect(() => {
    if (!activeStartTime) return;

    const timer = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - activeStartTime) / 1000));
    }, 1000);

    const sampler = window.setInterval(async () => {
      try {
        const snap = await getDeviceSnapshot();
        const elapsed = Math.floor((Date.now() - activeStartTime) / 1000);
        const sample: SessionTelemetrySample = {
          timestamp: new Date().toISOString(),
          elapsedSec: elapsed,
          temperatureC: snap.thermal.temperatureC,
          batteryPercent: snap.battery.levelPercent,
          thermalState: snap.thermal.thermalState,
        };
        setSamples((prev) => [...prev, sample]);

        const hitThrottle =
          snap.thermal.thermalState === 'moderate' ||
          snap.thermal.thermalState === 'severe' ||
          snap.thermal.thermalState === 'critical' ||
          (snap.thermal.temperatureC !== null && snap.thermal.temperatureC >= thresholdC);

        if (hitThrottle) {
          setThrottlingDetected(true);
          onThermalAlertChange(
            `تنبيه اختناق حراري: وصلت الحرارة ${
              snap.thermal.temperatureC !== null ? `${snap.thermal.temperatureC.toFixed(1)}°C` : 'لمستوى مرتفع'
            }. فك الغطاء وخفف السطوع قبل نزول الفريمات.`,
          );
        }
      } catch {
        // Keep session alive even if a sample fails
      }
    }, 10000);

    return () => {
      window.clearInterval(timer);
      window.clearInterval(sampler);
    };
  }, [activeStartTime, thresholdC, onThermalAlertChange]);

  async function handleStartSmartSession() {
    if (!selectedProfile) return;
    setSessionBusy(true);
    setSessionError(null);
    setLatestReport(null);
    setAiAnalysis(null);
    setSessionStatusNotes([]);
    setThrottlingDetected(false);

    try {
      const notes: string[] = [];

      // 1) Try DND
      const dndRes = await toggleDoNotDisturb(true);
      setDndActive(dndRes.applied);
      notes.push(dndRes.message);

      // 2) Try launching the game on Android
      const launchRes = await launchGameApp(selectedProfile.packageName);
      notes.push(launchRes.message);

      // 3) Measure real initial ping & snapshot
      let initialPing: number | null = null;
      try {
        const p = await measureRealPing(3);
        initialPing = p.avgMs;
      } catch {
        initialPing = null;
      }

      const initialSnap = await getDeviceSnapshot();
      const firstSample: SessionTelemetrySample = {
        timestamp: new Date().toISOString(),
        elapsedSec: 0,
        temperatureC: initialSnap.thermal.temperatureC,
        batteryPercent: initialSnap.battery.levelPercent,
        thermalState: initialSnap.thermal.thermalState,
      };

      setSessionStatusNotes(notes);
      setPrePingMs(initialPing);
      setBatteryStart(initialSnap.battery.levelPercent);
      setSamples([firstSample]);
      setElapsedSec(0);
      setActiveStartTime(Date.now());
    } catch {
      setSessionError('تعذر بدء الجلسة الذكية، تأكد من صلاحيات الجهاز وجرب مرة ثانية.');
    } finally {
      setSessionBusy(false);
    }
  }

  async function handleFinishSmartSession() {
    if (!activeStartTime || !selectedProfile) return;
    setSessionBusy(true);
    setSessionError(null);

    try {
      // Restore DND if it was enabled
      if (dndActive) {
        await toggleDoNotDisturb(false);
        setDndActive(false);
      }

      let postPingMs: number | null = null;
      try {
        const p = await measureRealPing(3);
        postPingMs = p.avgMs;
      } catch {
        postPingMs = null;
      }

      const finalSnap = await getDeviceSnapshot();
      const finalSample: SessionTelemetrySample = {
        timestamp: new Date().toISOString(),
        elapsedSec,
        temperatureC: finalSnap.thermal.temperatureC,
        batteryPercent: finalSnap.battery.levelPercent,
        thermalState: finalSnap.thermal.thermalState,
      };
      const allSamples = [...samples, finalSample];

      const sampleTemps = allSamples
        .map((s) => s.temperatureC)
        .filter((t): t is number => typeof t === 'number');

      const parsedManual = manualTempInput.trim() ? Number(manualTempInput) : null;
      const validManual =
        parsedManual !== null && Number.isFinite(parsedManual) && parsedManual >= 20 && parsedManual <= 60
          ? parsedManual
          : null;

      const peakTempC = sampleTemps.length > 0 ? Math.max(...sampleTemps) : validManual;
      const batteryEnd = finalSnap.battery.levelPercent;
      const batteryDrainPercent =
        batteryStart !== null && batteryEnd !== null ? Math.max(0, batteryStart - batteryEnd) : null;

      const thermalAlertTriggered = peakTempC !== null && peakTempC >= thresholdC;
      const finalThrottling = throttlingDetected || thermalAlertTriggered;

      const record: GameSessionRecord = {
        id: `gm_${Date.now()}`,
        game: selectedProfile.name,
        packageName: selectedProfile.packageName,
        startedAt: new Date(activeStartTime).toISOString(),
        endedAt: new Date().toISOString(),
        durationMinutes: Math.max(1, Math.round((Date.now() - activeStartTime) / 60000)),
        prePingMs,
        postPingMs,
        batteryStartPercent: batteryStart,
        batteryEndPercent: batteryEnd,
        batteryDrainPercent,
        peakTempC,
        stabilityScore,
        thermalAlertTriggered,
        thermalThrottlingDetected: finalThrottling,
        dndActivated: dndActive,
        samples: allSamples,
        notes: sessionNotes.trim(),
      };

      const updated = saveSessionRecord(record);
      setSessions(updated);
      setLatestReport(record);
      setActiveStartTime(null);
      setElapsedSec(0);
      setManualTempInput('');
      setSessionNotes('');
    } catch {
      setSessionError('تعذر إنهاء وحفظ الجلسة، جرب مرة ثانية.');
    } finally {
      setSessionBusy(false);
    }
  }

  async function handleAnalyzeReport(session: GameSessionRecord) {
    setAiAnalyzing(true);
    setAiError(null);
    setProfileUpdatedToast(null);
    setLatestReport(session);
    try {
      const matchingProfile =
        profiles.find((p) => p.name.toLowerCase() === session.game.toLowerCase()) ?? null;
      const res = await requestSessionAnalysis({
        session,
        profile: matchingProfile,
        deviceSnapshot: snapshot,
      });
      setAiAnalysis(res);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'تعذر تحليل تقرير الجلسة.');
    } finally {
      setAiAnalyzing(false);
    }
  }

  function handleApplyAiProfileSuggestion() {
    if (!aiAnalysis || !latestReport) return;
    const existing = profiles.find((p) => p.name.toLowerCase() === latestReport.game.toLowerCase());
    saveGameProfile({
      id: existing?.id ?? `game_${Date.now()}`,
      name: latestReport.game,
      packageName: existing?.packageName ?? latestReport.packageName,
      graphicsQuality: aiAnalysis.suggestedProfileUpdates.graphicsQuality,
      targetFps: aiAnalysis.suggestedProfileUpdates.targetFps,
      sensitivitySummary: existing?.sensitivitySummary ?? 'متوازنة',
      notes: aiAnalysis.suggestedProfileUpdates.reason,
      updatedAt: new Date().toISOString(),
    });
    setProfileUpdatedToast(`تم تحديث ملف ${latestReport.game} بتوصية الذكاء الاصطناعي.`);
  }

  const chartSessions = useMemo(() => [...sessions].slice(0, 8).reverse(), [sessions]);
  const maxChartVal = useMemo(() => {
    if (chartMetric === 'temp') return 55;
    if (chartMetric === 'battery') {
      return Math.max(10, ...chartSessions.map((s) => s.batteryDrainPercent ?? 0));
    }
    return Math.max(80, ...chartSessions.map((s) => s.postPingMs ?? s.prePingMs ?? 0));
  }, [chartMetric, chartSessions]);

  const formattedTimer = `${String(Math.floor(elapsedSec / 60)).padStart(2, '0')}:${String(elapsedSec % 60).padStart(2, '0')}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white">{translations.sessions.title}</h1>
        <p className="mt-1 text-sm text-slate-400">{translations.sessions.subtitle}</p>
      </div>

      {/* Smart Session Launcher / Active Monitor */}
      <section className="glass-card rounded-3xl p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Flame className="h-5 w-5 text-violet-400" />
            <h2 className="text-base font-bold text-white">وضع الجلسة الذكي (تسجيل كل 10 ثواني)</h2>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">حد تنبيه الحرارة:</span>
            {[39, 41, 43, 45].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setThresholdC(setThermalAlertThreshold(t))}
                className={`min-h-[34px] rounded-lg px-2.5 font-mono-num font-bold ${
                  thresholdC === t ? 'bg-amber-400 text-slate-950' : 'bg-white/5 text-slate-300'
                }`}
              >
                {t}°
              </button>
            ))}
          </div>
        </div>

        {!activeStartTime ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {profiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProfileId(p.id)}
                  className={`min-h-[40px] rounded-xl px-4 py-1.5 text-xs font-bold transition-colors ${
                    selectedProfile?.id === p.id
                      ? 'bg-sky-500 text-slate-950'
                      : 'border border-white/10 bg-white/5 text-slate-300'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <motion.button
              type="button"
              whileTap={{scale: 0.97}}
              onClick={handleStartSmartSession}
              disabled={sessionBusy || !selectedProfile}
              className="inline-flex min-h-[50px] items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-l from-violet-600 via-fuchsia-600 to-sky-500 px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-violet-600/25 disabled:opacity-50"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>
                {sessionBusy
                  ? 'جاري تفعيل عدم الإزعاج وبدء المراقبة...'
                  : `ابدأ الجلسة الذكية (${selectedProfile?.name ?? ''})`}
              </span>
            </motion.button>
          </div>
        ) : (
          <div className="space-y-4 rounded-2xl border border-violet-400/30 bg-black/35 p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-sky-300">جلسة نشطة — {selectedProfile?.name}</div>
                <div className="mt-1 font-mono-num text-3xl font-extrabold text-white">{formattedTimer}</div>
              </div>
              <div className="space-y-1 text-left text-xs text-slate-300 font-mono-num">
                <div>قراءات مسجلة (كل 10 ثواني): {samples.length}</div>
                <div>بنق البداية: {prePingMs !== null ? `${prePingMs} ms` : '—'}</div>
                <div>بطارية البداية: {batteryStart !== null ? `${batteryStart}%` : '—'}</div>
              </div>
            </div>

            {sessionStatusNotes.length > 0 && (
              <div className="space-y-1 rounded-xl bg-white/5 p-3 text-xs text-slate-300">
                {sessionStatusNotes.map((n, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <BellOff className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                    <span>{n}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-300">
                  ثبات الأداء الملاحظ (1 ضعيف — 5 ممتاز)
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => setStabilityScore(score)}
                      className={`min-h-[40px] flex-1 rounded-xl font-mono-num text-sm font-bold ${
                        stabilityScore === score ? 'bg-sky-500 text-slate-950' : 'bg-white/5 text-slate-300'
                      }`}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>

              {!snapshot?.thermal.supported && (
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-300">
                    حرارة الجوال الملاحظة °C (اختياري بالمتصفح)
                  </label>
                  <input
                    type="number"
                    min={20}
                    max={60}
                    step="0.5"
                    value={manualTempInput}
                    onChange={(e) => setManualTempInput(e.target.value)}
                    placeholder="مثلاً: 40.5"
                    className="min-h-[40px] w-full rounded-xl border border-white/10 bg-black/50 px-3 font-mono-num text-sm text-white focus:border-sky-400 focus:outline-none"
                  />
                </div>
              )}
            </div>

            <input
              type="text"
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder="ملاحظة سريعة عن الجلسة (اختياري)..."
              className="min-h-[40px] w-full rounded-xl border border-white/10 bg-black/50 px-3 text-sm text-white focus:border-sky-400 focus:outline-none"
            />

            <button
              type="button"
              onClick={handleFinishSmartSession}
              disabled={sessionBusy}
              className="inline-flex min-h-[46px] items-center gap-2 rounded-2xl bg-sky-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
            >
              <Square className="h-4 w-4 fill-current" />
              <span>{sessionBusy ? 'جاري إعداد التقرير...' : 'إنهاء الجلسة وعرض التقرير'}</span>
            </button>
          </div>
        )}

        {sessionError && (
          <div className="flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{sessionError}</span>
          </div>
        )}
      </section>

      {/* End-of-Session Report & AI Report Analysis */}
      {latestReport && (
        <section className="glass-card rounded-3xl border-sky-400/35 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div>
              <h2 className="text-lg font-extrabold text-white">تقرير الجلسة — {latestReport.game}</h2>
              <p className="text-xs text-slate-400 font-mono-num">
                المدة: {latestReport.durationMinutes} دقيقة · العينات المسجلة: {latestReport.samples.length}
              </p>
            </div>
            <motion.button
              type="button"
              whileTap={{scale: 0.97}}
              onClick={() => handleAnalyzeReport(latestReport)}
              disabled={aiAnalyzing}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-gradient-to-l from-violet-600 to-sky-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              <Sparkles className={`h-4 w-4 ${aiAnalyzing ? 'animate-spin' : ''}`} />
              <span>{aiAnalyzing ? 'جاري التحليل...' : 'تحليل التقرير بالمساعد الذكي'}</span>
            </motion.button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
            <div className="rounded-2xl bg-black/30 p-3.5">
              <div className="text-slate-400">أعلى حرارة مسجلة</div>
              <div className="mt-1 font-mono-num text-xl font-bold text-amber-300">
                {latestReport.peakTempC !== null ? `${latestReport.peakTempC.toFixed(1)}°C` : 'غير متاح بالويب'}
              </div>
            </div>
            <div className="rounded-2xl bg-black/30 p-3.5">
              <div className="text-slate-400">استهلاك البطارية</div>
              <div className="mt-1 font-mono-num text-xl font-bold text-emerald-300">
                {latestReport.batteryDrainPercent !== null ? `${latestReport.batteryDrainPercent}%` : 'غير متاح'}
              </div>
            </div>
            <div className="rounded-2xl bg-black/30 p-3.5">
              <div className="text-slate-400">البنق (بداية ← نهاية)</div>
              <div className="mt-1 font-mono-num text-base font-bold text-sky-300">
                {latestReport.prePingMs ?? '—'} ← {latestReport.postPingMs ?? '—'} ms
              </div>
            </div>
            <div className="rounded-2xl bg-black/30 p-3.5">
              <div className="text-slate-400">تقليل أداء بسبب الحرارة؟</div>
              <div
                className={`mt-1 text-sm font-bold ${
                  latestReport.thermalThrottlingDetected ? 'text-rose-400' : 'text-emerald-300'
                }`}
              >
                {latestReport.peakTempC === null && !snapshot?.thermal.supported
                  ? 'غير مقاس بالمتصفح'
                  : latestReport.thermalThrottlingDetected
                    ? 'نعم — تم رصد ارتفاع حراري'
                    : 'لا — الأداء مستقر'}
              </div>
            </div>
          </div>

          {aiError && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
              {aiError}
            </div>
          )}

          {aiAnalysis && (
            <div className="space-y-3 rounded-2xl border border-violet-400/30 bg-black/35 p-4 text-xs leading-relaxed">
              <div className="text-sm font-bold text-sky-300">{aiAnalysis.verdict}</div>
              <p className="text-slate-200">{aiAnalysis.thermalAndBatteryInsight}</p>
              <p className="text-slate-300">{aiAnalysis.networkInsight}</p>
              <ul className="list-inside list-disc space-y-1 text-slate-300">
                {aiAnalysis.nextSessionRecommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
                <div>
                  <span className="font-bold text-violet-300">تحديث مقترح لملف اللعبة: </span>
                  <span className="text-white">
                    {aiAnalysis.suggestedProfileUpdates.graphicsQuality} · {aiAnalysis.suggestedProfileUpdates.targetFps}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleApplyAiProfileSuggestion}
                  className="min-h-[36px] rounded-xl bg-emerald-500 px-3.5 py-1.5 font-bold text-slate-950 hover:bg-emerald-400"
                >
                  حفظ التحديث على ملف {latestReport.game}
                </button>
              </div>
              {profileUpdatedToast && (
                <div className="font-bold text-emerald-300">{profileUpdatedToast}</div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Session History & Multi-Metric Charts */}
      <section className="glass-card rounded-3xl p-5 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-sky-400" />
            <h2 className="text-base font-bold text-white">سجل الجلسات والرسوم البيانية ({sessions.length})</h2>
          </div>

          <div className="inline-flex rounded-xl bg-black/35 p-1 text-xs">
            <button
              type="button"
              onClick={() => setChartMetric('temp')}
              className={`min-h-[34px] rounded-lg px-3 font-bold ${
                chartMetric === 'temp' ? 'bg-amber-400 text-slate-950' : 'text-slate-300'
              }`}
            >
              الحرارة
            </button>
            <button
              type="button"
              onClick={() => setChartMetric('battery')}
              className={`min-h-[34px] rounded-lg px-3 font-bold ${
                chartMetric === 'battery' ? 'bg-emerald-400 text-slate-950' : 'text-slate-300'
              }`}
            >
              البطارية
            </button>
            <button
              type="button"
              onClick={() => setChartMetric('ping')}
              className={`min-h-[34px] rounded-lg px-3 font-bold ${
                chartMetric === 'ping' ? 'bg-sky-400 text-slate-950' : 'text-slate-300'
              }`}
            >
              البنق
            </button>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-black/25 p-8 text-center">
            <p className="font-bold text-slate-200">ما سجلت أي جلسة لعب للحين</p>
            <p className="mt-1 text-xs text-slate-400">
              اضغط «ابدأ الجلسة الذكية» فوق عشان نسجل الحرارة والبطارية والبنق ونعرضها بالرسم البياني.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-black/35 p-4 overflow-x-auto">
              <svg
                viewBox={`0 0 ${Math.max(360, chartSessions.length * 74)} 175`}
                className="h-44 w-full min-w-[340px]"
                role="img"
                aria-label="رسم بياني لسجل الجلسات"
              >
                <line x1="0" y1="138" x2={Math.max(360, chartSessions.length * 74)} y2="138" stroke="rgba(255,255,255,0.12)" />
                {chartSessions.map((item, idx) => {
                  const x = idx * 74 + 22;
                  const val =
                    chartMetric === 'temp'
                      ? item.peakTempC ?? 0
                      : chartMetric === 'battery'
                        ? item.batteryDrainPercent ?? 0
                        : item.postPingMs ?? item.prePingMs ?? 0;

                  const barHeight = val > 0 ? Math.max(8, Math.round((val / maxChartVal) * 110)) : 4;
                  const color =
                    chartMetric === 'temp' ? '#F59E0B' : chartMetric === 'battery' ? '#10B981' : '#38BDF8';
                  const unit = chartMetric === 'temp' ? '°' : chartMetric === 'battery' ? '%' : 'ms';

                  return (
                    <g key={item.id}>
                      <rect x={x} y={138 - barHeight} width="30" height={barHeight} rx="6" fill={color} />
                      <text
                        x={x + 15}
                        y={132 - barHeight}
                        textAnchor="middle"
                        fill="#E2E8F0"
                        fontSize="10"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {val > 0 ? `${val}${unit}` : '—'}
                      </text>
                      <text x={x + 15} y="156" textAnchor="middle" fill="#94A3B8" fontSize="9">
                        {item.game.slice(0, 8)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="divide-y divide-white/10">
              {sessions.map((s) => (
                <div key={s.id} className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-white">{s.game}</span>
                      <span className="text-slate-600">·</span>
                      <span className="font-mono-num text-xs text-slate-400">
                        {new Date(s.endedAt).toLocaleDateString('ar-SA')} ({s.durationMinutes} د)
                      </span>
                      {s.thermalThrottlingDetected && (
                        <>
                          <span className="text-slate-600">·</span>
                          <span className="text-xs font-bold text-rose-400">ارتفاع حراري</span>
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono-num">
                      <span className="inline-flex items-center gap-1">
                        <Thermometer className="h-3.5 w-3.5 text-amber-400" />
                        {s.peakTempC !== null ? `${s.peakTempC.toFixed(1)}°C` : '—'}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Battery className="h-3.5 w-3.5 text-emerald-400" />
                        {s.batteryDrainPercent !== null ? `-${s.batteryDrainPercent}%` : '—'}
                      </span>
                      <span>بنق: {s.prePingMs ?? '—'} ← {s.postPingMs ?? '—'} ms</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAnalyzeReport(s)}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-violet-500/20 px-3 py-1.5 text-xs font-bold text-violet-200 hover:bg-violet-500/30"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>تحليل AI</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSessions(deleteSessionRecord(s.id))}
                      className="flex h-[38px] w-[38px] items-center justify-center rounded-xl bg-white/5 text-slate-400 hover:text-rose-400"
                      aria-label={`حذف جلسة ${s.game}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
