import {useState} from 'react';
import {motion} from 'motion/react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Gamepad2,
  HardDrive,
  Info,
  Play,
  Plus,
  RefreshCw,
  Sliders,
  Trash2,
} from 'lucide-react';
import {
  getInstalledGamesStorage,
  openDeviceStorageSettings,
  toggleDoNotDisturb,
} from '../services/androidBridge';
import {
  deleteGameProfile,
  loadGameProfiles,
  saveGameProfile,
} from '../services/gameProfilesStorage';
import {translations} from '../i18n/translations';
import type {DeviceSnapshot, GameProfile, InstalledGameStorage} from '../types/gamemind';

interface GamesStorageViewProps {
  snapshot: DeviceSnapshot | null;
  onStartSessionForGame: (profile: GameProfile) => void;
}

export function GamesStorageView({snapshot, onStartSessionForGame}: GamesStorageViewProps) {
  const [profiles, setProfiles] = useState<GameProfile[]>(() => loadGameProfiles());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Add / Edit form state
  const [formName, setFormName] = useState('');
  const [formPackage, setFormPackage] = useState('');
  const [formGraphics, setFormGraphics] = useState('سلسة (Smooth)');
  const [formFps, setFormFps] = useState('60 FPS');
  const [formSens, setFormSens] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Apply profile feedback
  const [appliedProfile, setAppliedProfile] = useState<GameProfile | null>(null);
  const [applyFeedback, setApplyFeedback] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Storage Manager state
  const [installedGames, setInstalledGames] = useState<InstalledGameStorage[]>([]);
  const [storageScanNote, setStorageScanNote] = useState<string | null>(null);
  const [scanningGames, setScanningGames] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

  const storagePercent =
    snapshot?.storage.usedGb && snapshot?.storage.totalGb
      ? Math.min(100, Math.round((snapshot.storage.usedGb / snapshot.storage.totalGb) * 100))
      : null;

  async function handleScanInstalledGames() {
    setScanningGames(true);
    setStorageScanNote(null);
    try {
      const res = await getInstalledGamesStorage();
      setInstalledGames(res.games);
      setStorageScanNote(res.note);
    } catch {
      setStorageScanNote('تعذر فحص الألعاب المثبتة حالياً.');
    } finally {
      setScanningGames(false);
    }
  }

  async function handleOpenStorageSettings() {
    setSettingsMsg(null);
    const res = await openDeviceStorageSettings();
    setSettingsMsg(res.message);
  }

  function startCreate() {
    setEditingId(null);
    setFormName('');
    setFormPackage('');
    setFormGraphics('سلسة (Smooth)');
    setFormFps('60 FPS');
    setFormSens('');
    setFormNotes('');
    setShowAddForm(true);
  }

  function startEdit(profile: GameProfile) {
    setEditingId(profile.id);
    setFormName(profile.name);
    setFormPackage(profile.packageName);
    setFormGraphics(profile.graphicsQuality);
    setFormFps(profile.targetFps);
    setFormSens(profile.sensitivitySummary);
    setFormNotes(profile.notes);
    setShowAddForm(true);
  }

  function handleSaveForm(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) return;

    const record: GameProfile = {
      id: editingId || `game_${Date.now()}`,
      name: formName.trim(),
      packageName: formPackage.trim() || 'custom.game.package',
      graphicsQuality: formGraphics.trim() || 'متوسطة',
      targetFps: formFps.trim() || '60 FPS',
      sensitivitySummary: formSens.trim() || 'قياسية متوازنة',
      notes: formNotes.trim(),
      updatedAt: new Date().toISOString(),
    };

    const next = saveGameProfile(record);
    setProfiles(next);
    setShowAddForm(false);
    setEditingId(null);
  }

  function handleDeleteProfile(id: string) {
    setProfiles(deleteGameProfile(id));
    if (appliedProfile?.id === id) {
      setAppliedProfile(null);
    }
  }

  async function handleApplyProfile(profile: GameProfile) {
    setAppliedProfile(profile);
    const dnd = await toggleDoNotDisturb(true);
    if (dnd.applied) {
      setApplyFeedback('تم تفعيل عدم الإزعاج على النظام وحفظ الملف. طبّق إعدادات الرسومات والحساسية بالأسفل داخل اللعبة يدوياً لأن النظام يحمي ملفات الألعاب.');
    } else {
      setApplyFeedback('تم اعتماد الملف في GameMind. لأن النظام لا يسمح بتعديل إعدادات داخل ملفات اللعبة تلقائياً، طبّق القيم بالأسفل يدوياً داخل إعدادات اللعبة.');
    }
  }

  async function handleCopyProfile(profile: GameProfile) {
    const text = [
      `إعدادات ${profile.name}:`,
      `- الرسومات: ${profile.graphicsQuality}`,
      `- الفريمات: ${profile.targetFps}`,
      `- الحساسية: ${profile.sensitivitySummary}`,
      profile.notes ? `- ملاحظات: ${profile.notes}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(profile.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setApplyFeedback('المتصفح منع النسخ التلقائي — انسخ الإعدادات يدوياً.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white">{translations.games.title}</h1>
        <p className="mt-1 text-sm text-slate-400">{translations.games.subtitle}</p>
      </div>

      {/* Storage Manager Section */}
      <section className="glass-card rounded-3xl p-5 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500/20 text-sky-300">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">مدير المساحة والألعاب المثبتة</h2>
              <p className="mt-0.5 text-xs text-slate-400">
                {snapshot?.storage.supported && snapshot.storage.availableGb !== null
                  ? `المساحة الحرة: ${snapshot.storage.availableGb} GB من أصل ${snapshot.storage.totalGb} GB (${snapshot.storage.scopeLabel})`
                  : snapshot?.storage.note ?? 'جاري قراءة مساحة التخزين...'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <motion.button
              type="button"
              whileTap={{scale: 0.97}}
              onClick={handleScanInstalledGames}
              disabled={scanningGames}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold text-slate-100 hover:border-sky-400/50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 text-sky-400 ${scanningGames ? 'animate-spin' : ''}`} />
              <span>{scanningGames ? 'جاري الفحص...' : translations.games.scanGamesBtn}</span>
            </motion.button>

            <motion.button
              type="button"
              whileTap={{scale: 0.97}}
              onClick={handleOpenStorageSettings}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-gradient-to-l from-violet-600 to-sky-500 px-4 py-2 text-xs font-bold text-white"
            >
              <ExternalLink className="h-4 w-4" />
              <span>{translations.games.openStorageBtn}</span>
            </motion.button>
          </div>
        </div>

        {storagePercent !== null && (
          <div className="space-y-1.5">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-l from-violet-500 to-sky-400 transition-all"
                style={{width: `${storagePercent}%`}}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-400 font-mono-num">
              <span>مستخدم: {snapshot?.storage.usedGb} GB</span>
              <span>حر: {snapshot?.storage.availableGb} GB</span>
            </div>
          </div>
        )}

        {storageScanNote && (
          <div className="flex items-start gap-2 rounded-2xl bg-black/30 p-3 text-xs text-slate-300">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
            <span>{storageScanNote}</span>
          </div>
        )}

        {settingsMsg && (
          <div className="flex items-start gap-2 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <span>{settingsMsg}</span>
          </div>
        )}

        {installedGames.length > 0 && (
          <div className="grid grid-cols-1 gap-2.5 pt-2 sm:grid-cols-2 lg:grid-cols-3">
            {installedGames.map((g) => (
              <div key={g.packageName} className="flex items-center justify-between rounded-2xl bg-black/30 p-3 text-xs">
                <div className="min-w-0">
                  <div className="truncate font-bold text-white">{g.name}</div>
                  <div className="truncate font-mono-num text-[10px] text-slate-400">{g.packageName}</div>
                </div>
                <span className="font-mono-num font-bold text-sky-300 shrink-0">{g.apkSizeMb} MB</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Applied Profile Honest Manual Checklist */}
      {appliedProfile && (
        <section className="glass-card rounded-3xl border-violet-400/35 p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              <div>
                <h3 className="text-sm font-bold text-white">توصيات التطبيق اليدوي — {appliedProfile.name}</h3>
                <p className="mt-0.5 text-xs text-slate-300">{applyFeedback}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleCopyProfile(appliedProfile)}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15 shrink-0"
            >
              {copiedId === appliedProfile.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedId === appliedProfile.id ? 'نُسخ' : 'نسخ'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 text-xs">
            <div className="rounded-xl bg-black/30 p-3">
              <div className="text-slate-400">1. الرسومات داخل اللعبة</div>
              <div className="mt-1 font-bold text-sky-300">{appliedProfile.graphicsQuality}</div>
            </div>
            <div className="rounded-xl bg-black/30 p-3">
              <div className="text-slate-400">2. معدل الإطارات (FPS)</div>
              <div className="mt-1 font-bold text-violet-300">{appliedProfile.targetFps}</div>
            </div>
            <div className="rounded-xl bg-black/30 p-3">
              <div className="text-slate-400">3. الحساسية المحفوظة</div>
              <div className="mt-1 font-bold text-emerald-300">{appliedProfile.sensitivitySummary}</div>
            </div>
          </div>
        </section>
      )}

      {/* Per-Game Profiles Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-white">ملفات إعدادات الألعاب ({profiles.length})</h2>
        <motion.button
          type="button"
          whileTap={{scale: 0.97}}
          onClick={startCreate}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-2xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-500"
        >
          <Plus className="h-4 w-4" />
          <span>إضافة ملف لعبة</span>
        </motion.button>
      </div>

      {/* Add / Edit Modal Form Inline */}
      {showAddForm && (
        <form onSubmit={handleSaveForm} className="glass-card rounded-3xl p-5 space-y-4">
          <h3 className="text-base font-bold text-white">
            {editingId ? 'تعديل ملف اللعبة' : 'إضافة ملف لعبة جديد'}
          </h3>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">اسم اللعبة</label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="مثلاً: Valorant Mobile"
                className="min-h-[42px] w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white focus:border-sky-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">اسم الحزمة في Android (اختياري)</label>
              <input
                type="text"
                value={formPackage}
                onChange={(e) => setFormPackage(e.target.value)}
                placeholder="مثلاً: com.tencent.ig"
                className="min-h-[42px] w-full rounded-xl border border-white/10 bg-black/40 px-3 font-mono-num text-sm text-white focus:border-sky-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">جودة الرسومات</label>
              <input
                type="text"
                value={formGraphics}
                onChange={(e) => setFormGraphics(e.target.value)}
                className="min-h-[42px] w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white focus:border-sky-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">معدل الإطارات المستهدف (FPS)</label>
              <input
                type="text"
                value={formFps}
                onChange={(e) => setFormFps(e.target.value)}
                className="min-h-[42px] w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white focus:border-sky-400 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">إعدادات الحساسية</label>
            <input
              type="text"
              value={formSens}
              onChange={(e) => setFormSens(e.target.value)}
              placeholder="مثال: كاميرا 105% · ADS 95% · جيرو 220%"
              className="min-h-[42px] w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white focus:border-sky-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">ملاحظاتك الخاصة</label>
            <input
              type="text"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="مثال: إغلاق الظلال وقت الحر"
              className="min-h-[42px] w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white focus:border-sky-400 focus:outline-none"
            />
          </div>
          <div className="flex gap-2.5">
            <button
              type="submit"
              className="min-h-[42px] rounded-xl bg-sky-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400"
            >
              حفظ الملف
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="min-h-[42px] rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300"
            >
              إلغاء
            </button>
          </div>
        </form>
      )}

      {/* Profiles Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {profiles.map((profile) => (
          <article key={profile.id} className="glass-card flex flex-col justify-between rounded-3xl p-5 space-y-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600/30 to-sky-500/30 text-sky-300">
                    <Gamepad2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">{profile.name}</h3>
                    <div className="font-mono-num text-[11px] text-slate-400">{profile.packageName}</div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(profile)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-slate-300 hover:text-white"
                    aria-label={`تعديل ${profile.name}`}
                  >
                    <Sliders className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteProfile(profile.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-slate-400 hover:text-rose-400"
                    aria-label={`حذف ${profile.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-black/30 p-2.5">
                  <div className="text-slate-400">الرسومات</div>
                  <div className="mt-0.5 font-bold text-slate-100">{profile.graphicsQuality}</div>
                </div>
                <div className="rounded-xl bg-black/30 p-2.5">
                  <div className="text-slate-400">الفريمات</div>
                  <div className="mt-0.5 font-mono-num font-bold text-sky-300">{profile.targetFps}</div>
                </div>
              </div>

              <div className="text-xs text-slate-300">
                <span className="font-semibold text-violet-300">الحساسية: </span>
                {profile.sensitivitySummary}
              </div>

              {profile.notes && (
                <p className="text-xs leading-relaxed text-slate-400">{profile.notes}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
              <motion.button
                type="button"
                whileTap={{scale: 0.97}}
                onClick={() => onStartSessionForGame(profile)}
                className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-violet-600 to-sky-500 px-3 py-2 text-xs font-bold text-white"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>ابدأ اللعب بالملف</span>
              </motion.button>

              <button
                type="button"
                onClick={() => handleApplyProfile(profile)}
                className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-bold text-slate-200 hover:border-sky-400/40"
              >
                تطبيق الإعدادات
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
