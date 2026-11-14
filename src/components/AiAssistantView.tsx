import {useState} from 'react';
import {motion} from 'motion/react';
import {
  AlertTriangle,
  BookmarkCheck,
  Check,
  Copy,
  Cpu,
  Crosshair,
  Send,
  Sliders,
  Sparkles,
} from 'lucide-react';
import {
  requestAiDiagnosis,
  requestProGraphicsConfig,
  requestSensitivityCoach,
} from '../services/aiService';
import {loadGameProfiles, saveGameProfile} from '../services/gameProfilesStorage';
import {useSubscription} from '../state/subscriptionStore';
import {translations} from '../i18n/translations';
import type {
  AiDiagnosisResponse,
  DeviceSnapshot,
  PingMeasurement,
  ProGraphicsConfig,
  SensitivityCoachResult,
} from '../types/gamemind';

interface AiAssistantViewProps {
  snapshot: DeviceSnapshot | null;
  ping: PingMeasurement | null;
}

const POPULAR_GAMES = [
  'PUBG Mobile',
  'Call of Duty Mobile',
  'Free Fire',
  'Fortnite',
  'Genshin Impact',
  'Valorant Mobile',
];

const QUICK_PROBLEMS = [
  'ببجي يقطع وقت الفايت مع إن النت شغال',
  'البنق يرتفع فجأة واللعب يصير فيه تأخير',
  'الجوال يحتر وبعد 15 دقيقة تنزل الفريمات',
  'اللعبة تخرج فجأة أو تهنّق في اللوبي',
];

const PRIORITIES = ['أعلى فريمات ثابتة بدون تقطيع', 'توازن حرارة وأداء طويل', 'أفضل دقة ووضوح بصري'];
const PLAYSTYLES = ['هجوم قريب (CQC / Rush)', 'قنص وبعيد (Sniper)', 'لعب متوازن'];
const GYRO_MODES = ['جيروسكوب كامل (Always On)', 'مع المنظار فقط (Scope On)', 'بدون جيروسكوب'];
const AIM_ISSUES = [
  'السكوب يرتفع فوق الهدف وقت الرش',
  'الأيم بطيء عند الالتفاف السريع',
  'اهتزاز في السكوبات البعيدة (4x / 6x)',
  'أبي حساسية ثابتة للتدريب من الصفر',
];

export function AiAssistantView({snapshot, ping}: AiAssistantViewProps) {
  // التحقق المركزي من حالة isPro (حالياً يرجع true دائماً لفتح كل الميزات مجاناً)
  const {isPro} = useSubscription();

  const [subTab, setSubTab] = useState<'diagnose' | 'graphics' | 'sensitivity'>('diagnose');

  // Diagnose state
  const [selectedGame, setSelectedGame] = useState('PUBG Mobile');
  const [problem, setProblem] = useState('');
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagError, setDiagError] = useState<string | null>(null);
  const [diagResult, setDiagResult] = useState<AiDiagnosisResponse | null>(null);
  const [diagCopied, setDiagCopied] = useState(false);

  // Graphics generator state
  const [gfxGame, setGfxGame] = useState('PUBG Mobile');
  const [gfxPriority, setGfxPriority] = useState(PRIORITIES[0]);
  const [gfxLoading, setGfxLoading] = useState(false);
  const [gfxError, setGfxError] = useState<string | null>(null);
  const [gfxResult, setGfxResult] = useState<ProGraphicsConfig | null>(null);
  const [gfxSavedNotice, setGfxSavedNotice] = useState<string | null>(null);

  // Sensitivity coach state
  const [sensGame, setSensGame] = useState('PUBG Mobile');
  const [playstyle, setPlaystyle] = useState(PLAYSTYLES[0]);
  const [gyroMode, setGyroMode] = useState(GYRO_MODES[1]);
  const [aimIssue, setAimIssue] = useState(AIM_ISSUES[0]);
  const [sensLoading, setSensLoading] = useState(false);
  const [sensError, setSensError] = useState<string | null>(null);
  const [sensResult, setSensResult] = useState<SensitivityCoachResult | null>(null);
  const [sensSavedNotice, setSensSavedNotice] = useState<string | null>(null);

  async function handleDiagnose(e: React.FormEvent) {
    e.preventDefault();
    if (!isPro) return;
    setDiagError(null);
    if (problem.trim().length < 4) {
      setDiagError('اكتب وصف واضح للمشكلة عشان يقدر المساعد الذكي يحللها صح.');
      return;
    }

    setDiagLoading(true);
    setDiagCopied(false);
    try {
      const response = await requestAiDiagnosis({
        game: selectedGame,
        problem: problem.trim(),
        deviceSnapshot: snapshot,
        ping,
      });
      setDiagResult(response);
    } catch (err) {
      setDiagError(err instanceof Error ? err.message : 'تعذر الاتصال بالمساعد الذكي.');
    } finally {
      setDiagLoading(false);
    }
  }

  async function handleCopyDiagnosis() {
    if (!diagResult) return;
    const text = [
      `تحليل GameMind للعبة ${selectedGame}:`,
      `السبب المحتمل: ${diagResult.probableCause}`,
      `خطوات الحل:\n${diagResult.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`,
      `إعدادات الرسومات: ${diagResult.suggestedGraphics.quality} | ${diagResult.suggestedGraphics.fpsTarget}`,
      `ملاحظة: ${diagResult.honestHardwareNote}`,
    ].join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      setDiagCopied(true);
      window.setTimeout(() => setDiagCopied(false), 2000);
    } catch {
      setDiagError('المتصفح منع النسخ التلقائي — حدد النص وانسخه يدوياً.');
    }
  }

  async function handleGenerateGraphics() {
    if (!isPro) return;
    setGfxError(null);
    setGfxSavedNotice(null);
    setGfxLoading(true);
    try {
      const res = await requestProGraphicsConfig({
        game: gfxGame,
        priority: gfxPriority,
        deviceSnapshot: snapshot,
      });
      setGfxResult(res);
    } catch (err) {
      setGfxError(err instanceof Error ? err.message : 'تعذر توليد الإعدادات.');
    } finally {
      setGfxLoading(false);
    }
  }

  function handleSaveGraphicsToProfile() {
    if (!gfxResult) return;
    const existing = loadGameProfiles().find((p) => p.name.toLowerCase() === gfxGame.toLowerCase());
    saveGameProfile({
      id: existing?.id ?? `game_${Date.now()}`,
      name: gfxGame,
      packageName: existing?.packageName ?? 'custom.game.package',
      graphicsQuality: gfxResult.graphicsQuality,
      targetFps: gfxResult.frameRateSetting,
      sensitivitySummary: existing?.sensitivitySummary ?? 'قياسية',
      notes: gfxResult.thermalWarning,
      updatedAt: new Date().toISOString(),
    });
    setGfxSavedNotice(`تم تحديث ملف ${gfxGame} بالإعدادات الجديدة.`);
  }

  async function handleGenerateSensitivity() {
    if (!isPro) return;
    setSensError(null);
    setSensSavedNotice(null);
    setSensLoading(true);
    try {
      const res = await requestSensitivityCoach({
        game: sensGame,
        playstyle,
        gyroMode,
        aimIssue,
        deviceSnapshot: snapshot,
      });
      setSensResult(res);
    } catch (err) {
      setSensError(err instanceof Error ? err.message : 'تعذر الاتصال بمدرب الحساسية.');
    } finally {
      setSensLoading(false);
    }
  }

  function handleSaveSensitivityToProfile() {
    if (!sensResult) return;
    const existing = loadGameProfiles().find((p) => p.name.toLowerCase() === sensGame.toLowerCase());
    const c = sensResult.cameraSensitivity;
    const g = sensResult.gyroSensitivity;
    saveGameProfile({
      id: existing?.id ?? `game_${Date.now()}`,
      name: sensGame,
      packageName: existing?.packageName ?? 'custom.game.package',
      graphicsQuality: existing?.graphicsQuality ?? 'سلسة',
      targetFps: existing?.targetFps ?? '60 FPS',
      sensitivitySummary: `كاميرا ${c.noScope}% · RedDot ${c.redDot}% · ADS ${sensResult.adsSensitivity.redDot}% · جيرو ${g.redDot}%`,
      notes: sensResult.coachSummary,
      updatedAt: new Date().toISOString(),
    });
    setSensSavedNotice(`تم حفظ الحساسية في ملف ${sensGame}.`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">{translations.assistant.title}</h1>
          <p className="mt-1 text-sm text-slate-400">{translations.assistant.subtitle}</p>
        </div>

        {/* Sub-Tabs */}
        <div className="inline-flex rounded-2xl border border-white/10 bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setSubTab('diagnose')}
            className={`min-h-[40px] rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors whitespace-nowrap ${
              subTab === 'diagnose'
                ? 'bg-gradient-to-l from-violet-600 to-sky-500 text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            تشخيص المشكلة
          </button>
          <button
            type="button"
            onClick={() => setSubTab('graphics')}
            className={`min-h-[40px] rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors whitespace-nowrap ${
              subTab === 'graphics'
                ? 'bg-gradient-to-l from-violet-600 to-sky-500 text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            الرسومات وFPS
          </button>
          <button
            type="button"
            onClick={() => setSubTab('sensitivity')}
            className={`min-h-[40px] rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors whitespace-nowrap ${
              subTab === 'sensitivity'
                ? 'bg-gradient-to-l from-violet-600 to-sky-500 text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            مدرب الحساسية
          </button>
        </div>
      </div>

      {/* SubTab 1: Problem Diagnosis */}
      {subTab === 'diagnose' && (
        <div className="space-y-5">
          <form onSubmit={handleDiagnose} className="glass-card rounded-3xl p-5 space-y-4">
            <div>
              <label className="mb-2 block text-xs font-bold text-slate-300">اللعبة</label>
              <div className="flex flex-wrap gap-2">
                {POPULAR_GAMES.map((game) => (
                  <button
                    key={game}
                    type="button"
                    onClick={() => setSelectedGame(game)}
                    className={`min-h-[38px] rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors ${
                      selectedGame === game
                        ? 'bg-sky-500 text-slate-950'
                        : 'border border-white/10 bg-white/5 text-slate-300 hover:border-sky-400/40'
                    }`}
                  >
                    {game}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="ai-problem-input" className="mb-2 block text-xs font-bold text-slate-300">
                اوصف مشكلتك بالتفصيل
              </label>
              <textarea
                id="ai-problem-input"
                rows={4}
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                placeholder="مثال: ببجي يقطع وقت الفايت مع إن النت عندي سريع..."
                className="w-full rounded-2xl border border-white/10 bg-black/40 p-3.5 text-sm text-white placeholder:text-slate-500 focus:border-violet-400 focus:outline-none"
              />
              <div className="mt-2.5 flex flex-wrap gap-2">
                {QUICK_PROBLEMS.map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => setProblem(sample)}
                    className="min-h-[34px] rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 hover:border-violet-400/50"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3 text-xs text-slate-400">
              <Cpu className="h-4 w-4 text-sky-400" />
              <span>يرسل مع طلبك:</span>
              <span>{snapshot ? `${snapshot.device.manufacturer} ${snapshot.device.model}` : 'جهاز غير مفحوص'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num">{ping ? `بنق ${ping.avgMs}ms` : 'البنق لم يُفحص'}</span>
            </div>

            {diagError && (
              <div className="flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-sm text-rose-200">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{diagError}</span>
              </div>
            )}

            <motion.button
              type="submit"
              whileTap={{scale: 0.97}}
              disabled={diagLoading}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-violet-600 to-sky-500 px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {diagLoading ? <Sparkles className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span>{diagLoading ? 'جاري التحليل بالذكاء الاصطناعي...' : 'حلّل المشكلة الحين'}</span>
            </motion.button>
          </form>

          {diagResult && (
            <section className="glass-card rounded-3xl border-sky-400/30 p-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                <h2 className="text-lg font-bold text-white">تشخيص GameMind — {selectedGame}</h2>
                <button
                  type="button"
                  onClick={handleCopyDiagnosis}
                  className="inline-flex min-h-[38px] items-center gap-2 rounded-xl bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-white/15"
                >
                  {diagCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-sky-400" />}
                  <span>{diagCopied ? 'تم النسخ!' : 'نسخ الرد'}</span>
                </button>
              </div>

              <div>
                <h3 className="text-sm font-bold text-sky-300">السبب المحتمل</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-200">{diagResult.probableCause}</p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-violet-300">خطوات الحل المرتبة</h3>
                <ol className="mt-2.5 space-y-2">
                  {diagResult.steps.map((s, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-200">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-500/20 font-mono-num text-xs font-bold text-violet-300">
                        {idx + 1}
                      </span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 text-xs">
                <div className="rounded-2xl bg-black/30 p-3">
                  <div className="text-slate-400">جودة الرسومات</div>
                  <div className="mt-1 font-bold text-white">{diagResult.suggestedGraphics.quality}</div>
                </div>
                <div className="rounded-2xl bg-black/30 p-3">
                  <div className="text-slate-400">الفريمات المستهدفة</div>
                  <div className="mt-1 font-bold text-sky-300">{diagResult.suggestedGraphics.fpsTarget}</div>
                </div>
                <div className="rounded-2xl bg-black/30 p-3">
                  <div className="text-slate-400">الظلال والتعرج</div>
                  <div className="mt-1 font-bold text-white">
                    {diagResult.suggestedGraphics.shadows} · {diagResult.suggestedGraphics.antiAliasing}
                  </div>
                </div>
              </div>

              <p className="border-t border-white/10 pt-3 text-xs text-slate-400">
                <span className="font-bold text-slate-200">ملاحظة صريحة: </span>
                {diagResult.honestHardwareNote}
              </p>
            </section>
          )}
        </div>
      )}

      {/* SubTab 2: Graphics & FPS Generator */}
      {subTab === 'graphics' && (
        <div className="space-y-5">
          <section className="glass-card rounded-3xl p-5 space-y-4">
            <div>
              <label className="mb-2 block text-xs font-bold text-slate-300">اختر اللعبة</label>
              <div className="flex flex-wrap gap-2">
                {POPULAR_GAMES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGfxGame(g)}
                    className={`min-h-[38px] rounded-xl px-3.5 py-1.5 text-xs font-bold ${
                      gfxGame === g ? 'bg-sky-500 text-slate-950' : 'border border-white/10 bg-white/5 text-slate-300'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold text-slate-300">أولوية الإعدادات</label>
              <div className="flex flex-wrap gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setGfxPriority(p)}
                    className={`min-h-[38px] rounded-xl px-3.5 py-1.5 text-xs font-bold ${
                      gfxPriority === p
                        ? 'bg-violet-500 text-white'
                        : 'border border-white/10 bg-white/5 text-slate-300'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {gfxError && (
              <div className="flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{gfxError}</span>
              </div>
            )}

            <motion.button
              type="button"
              whileTap={{scale: 0.97}}
              onClick={handleGenerateGraphics}
              disabled={gfxLoading}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-gradient-to-l from-violet-600 to-sky-500 px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              <Sliders className={`h-4 w-4 ${gfxLoading ? 'animate-spin' : ''}`} />
              <span>{gfxLoading ? 'جاري توليد الإعدادات...' : 'ولّد إعدادات الرسومات وFPS'}</span>
            </motion.button>
          </section>

          {gfxResult && (
            <section className="glass-card rounded-3xl border-violet-400/30 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {gfxResult.gameName} — {gfxResult.presetTitle}
                  </h2>
                  <div className="text-xs font-bold text-emerald-400">
                    الفريمات الواقعية المتوقعة: {gfxResult.expectedStableFps}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSaveGraphicsToProfile}
                  className="inline-flex min-h-[38px] items-center gap-2 rounded-xl bg-emerald-500 px-4 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                >
                  <BookmarkCheck className="h-4 w-4" />
                  <span>حفظ في ملف اللعبة</span>
                </button>
              </div>

              {gfxSavedNotice && (
                <div className="rounded-xl bg-emerald-500/15 px-3.5 py-2 text-xs font-semibold text-emerald-300">
                  {gfxSavedNotice}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 text-xs">
                <div className="rounded-2xl bg-black/30 p-3">
                  <div className="text-slate-400">الجودة</div>
                  <div className="mt-1 font-bold text-white">{gfxResult.graphicsQuality}</div>
                </div>
                <div className="rounded-2xl bg-black/30 p-3">
                  <div className="text-slate-400">معدل الإطارات</div>
                  <div className="mt-1 font-bold text-sky-300">{gfxResult.frameRateSetting}</div>
                </div>
                <div className="rounded-2xl bg-black/30 p-3">
                  <div className="text-slate-400">دقة العرض</div>
                  <div className="mt-1 font-bold text-white">{gfxResult.resolutionScale}</div>
                </div>
                <div className="rounded-2xl bg-black/30 p-3">
                  <div className="text-slate-400">الظلال</div>
                  <div className="mt-1 font-bold text-white">{gfxResult.shadows}</div>
                </div>
                <div className="rounded-2xl bg-black/30 p-3">
                  <div className="text-slate-400">مانع التعرج</div>
                  <div className="mt-1 font-bold text-white">{gfxResult.antiAliasing}</div>
                </div>
                <div className="rounded-2xl bg-black/30 p-3">
                  <div className="text-slate-400">التعديل التلقائي</div>
                  <div className="mt-1 font-bold text-white">{gfxResult.autoAdjustGraphics}</div>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-amber-300">{gfxResult.thermalWarning}</p>
              <p className="text-xs leading-relaxed text-slate-300">{gfxResult.reasoning}</p>
            </section>
          )}
        </div>
      )}

      {/* SubTab 3: Sensitivity Coach */}
      {subTab === 'sensitivity' && (
        <div className="space-y-5">
          <section className="glass-card rounded-3xl p-5 space-y-4">
            <div className="flex flex-wrap gap-2">
              {POPULAR_GAMES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setSensGame(g)}
                  className={`min-h-[38px] rounded-xl px-3.5 py-1.5 text-xs font-bold ${
                    sensGame === g ? 'bg-sky-500 text-slate-950' : 'border border-white/10 bg-white/5 text-slate-300'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-300">أسلوب اللعب</label>
                <div className="space-y-1.5">
                  {PLAYSTYLES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPlaystyle(item)}
                      className={`min-h-[40px] w-full rounded-xl px-3 text-right text-xs font-bold ${
                        playstyle === item ? 'bg-violet-500 text-white' : 'bg-white/5 text-slate-300'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-300">الجيروسكوب</label>
                <div className="space-y-1.5">
                  {GYRO_MODES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setGyroMode(item)}
                      className={`min-h-[40px] w-full rounded-xl px-3 text-right text-xs font-bold ${
                        gyroMode === item ? 'bg-violet-500 text-white' : 'bg-white/5 text-slate-300'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-300">مشكلة الأيم</label>
              <div className="flex flex-wrap gap-2">
                {AIM_ISSUES.map((issue) => (
                  <button
                    key={issue}
                    type="button"
                    onClick={() => setAimIssue(issue)}
                    className={`min-h-[38px] rounded-xl px-3 py-1.5 text-xs font-bold ${
                      aimIssue === issue ? 'bg-sky-500 text-slate-950' : 'bg-white/5 text-slate-300'
                    }`}
                  >
                    {issue}
                  </button>
                ))}
              </div>
            </div>

            {sensError && (
              <div className="flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{sensError}</span>
              </div>
            )}

            <motion.button
              type="button"
              whileTap={{scale: 0.97}}
              onClick={handleGenerateSensitivity}
              disabled={sensLoading}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-gradient-to-l from-violet-600 to-sky-500 px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              <Crosshair className={`h-4 w-4 ${sensLoading ? 'animate-spin' : ''}`} />
              <span>{sensLoading ? 'جاري ضبط الحساسية...' : 'احسب أرقام الحساسية والتمرين'}</span>
            </motion.button>
          </section>

          {sensResult && (
            <section className="glass-card rounded-3xl border-sky-400/30 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                <h2 className="text-lg font-bold text-white">أرقام الحساسية — {sensGame}</h2>
                <button
                  type="button"
                  onClick={handleSaveSensitivityToProfile}
                  className="inline-flex min-h-[38px] items-center gap-2 rounded-xl bg-emerald-500 px-4 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                >
                  <BookmarkCheck className="h-4 w-4" />
                  <span>حفظ في ملف اللعبة</span>
                </button>
              </div>

              {sensSavedNotice && (
                <div className="rounded-xl bg-emerald-500/15 px-3.5 py-2 text-xs font-semibold text-emerald-300">
                  {sensSavedNotice}
                </div>
              )}

              <p className="text-sm leading-relaxed text-slate-200">{sensResult.coachSummary}</p>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 text-xs">
                <div className="rounded-2xl bg-black/30 p-4 space-y-2">
                  <div className="font-bold text-sky-300">حساسية الكاميرا</div>
                  <div className="flex justify-between"><span>النظرة الحرة</span><span className="font-mono-num font-bold">{sensResult.cameraSensitivity.freeLook}%</span></div>
                  <div className="flex justify-between"><span>بدون منظار</span><span className="font-mono-num font-bold">{sensResult.cameraSensitivity.noScope}%</span></div>
                  <div className="flex justify-between"><span>Red Dot</span><span className="font-mono-num font-bold">{sensResult.cameraSensitivity.redDot}%</span></div>
                  <div className="flex justify-between"><span>2x / 4x / 6x</span><span className="font-mono-num font-bold">{sensResult.cameraSensitivity.scope2x}% / {sensResult.cameraSensitivity.scope4x}% / {sensResult.cameraSensitivity.scope6x}%</span></div>
                </div>
                <div className="rounded-2xl bg-black/30 p-4 space-y-2">
                  <div className="font-bold text-violet-300">حساسية الإطلاق (ADS)</div>
                  <div className="flex justify-between"><span>بدون منظار</span><span className="font-mono-num font-bold">{sensResult.adsSensitivity.noScope}%</span></div>
                  <div className="flex justify-between"><span>Red Dot</span><span className="font-mono-num font-bold">{sensResult.adsSensitivity.redDot}%</span></div>
                  <div className="flex justify-between"><span>2x</span><span className="font-mono-num font-bold">{sensResult.adsSensitivity.scope2x}%</span></div>
                  <div className="flex justify-between"><span>4x / 6x</span><span className="font-mono-num font-bold">{sensResult.adsSensitivity.scope4x}% / {sensResult.adsSensitivity.scope6x}%</span></div>
                </div>
                <div className="rounded-2xl bg-black/30 p-4 space-y-2">
                  <div className="font-bold text-emerald-300">الجيروسكوب ({sensResult.gyroSensitivity.enabledNote})</div>
                  <div className="flex justify-between"><span>بدون منظار</span><span className="font-mono-num font-bold">{sensResult.gyroSensitivity.noScope}%</span></div>
                  <div className="flex justify-between"><span>Red Dot</span><span className="font-mono-num font-bold">{sensResult.gyroSensitivity.redDot}%</span></div>
                  <div className="flex justify-between"><span>4x</span><span className="font-mono-num font-bold">{sensResult.gyroSensitivity.scope4x}%</span></div>
                  <div className="flex justify-between"><span>6x</span><span className="font-mono-num font-bold">{sensResult.gyroSensitivity.scope6x}%</span></div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-300">تمرين 10 دقائق في ساحة التدريب</h3>
                <ol className="mt-2 space-y-1.5 text-xs text-slate-300">
                  {sensResult.trainingDrill.map((step, i) => (
                    <li key={i}>{i + 1}. {step}</li>
                  ))}
                </ol>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
