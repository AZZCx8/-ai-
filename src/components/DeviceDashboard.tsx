import {motion} from 'motion/react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Flame,
  HardDrive,
  Info,
  Play,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Sun,
  Smartphone,
  BatteryCharging,
} from 'lucide-react';
import {RadialGauge} from './RadialGauge';
import {translations} from '../i18n/translations';
import type {DeviceSnapshot, NavTabId, PingMeasurement} from '../types/gamemind';

interface DeviceDashboardProps {
  snapshot: DeviceSnapshot | null;
  snapshotLoading: boolean;
  snapshotError: string | null;
  ping: PingMeasurement | null;
  pingLoading: boolean;
  pingError: string | null;
  onRefreshSnapshot: () => void;
  onMeasurePing: () => void;
  onStartSmartSession: () => void;
  onNavigate: (tab: NavTabId) => void;
}

function getThermalAssessment(snapshot: DeviceSnapshot | null): {
  status: 'safe' | 'early-warning' | 'throttling' | 'unavailable';
  title: string;
  desc: string;
  accent: 'emerald' | 'amber' | 'rose' | 'purple';
  gaugePercent: number | null;
} {
  if (!snapshot || !snapshot.thermal.supported) {
    return {
      status: 'unavailable',
      title: 'حساس الحرارة غير مكشوف بالمتصفح',
      desc: 'قراءة الحرارة التلقائية وكشف الاختناق الفوري يشتغلون تلقائياً في نسخة Android. لو حسّيت الجوال يحتر، طبّق خطوات التبريد الحقيقية تحت.',
      accent: 'purple',
      gaugePercent: null,
    };
  }

  const temp = snapshot.thermal.temperatureC;
  const state = snapshot.thermal.thermalState;

  if (state === 'severe' || state === 'critical' || (temp !== null && temp >= 42)) {
    return {
      status: 'throttling',
      title: 'تحذير: اختناق حراري محتمل أو نشط!',
      desc: `الحرارة ${temp !== null ? `${temp.toFixed(1)}°C` : 'مرتفعة جداً'} — المعالج قد يقلل السرعة (Throttling) وتنزل الفريمات. نفّذ خطوات التبريد الحين.`,
      accent: 'rose',
      gaugePercent: temp !== null ? Math.min(100, Math.round((temp / 50) * 100)) : 88,
    };
  }

  if (state === 'moderate' || state === 'light' || (temp !== null && temp >= 39)) {
    return {
      status: 'early-warning',
      title: 'تنبيه مبكر: الحرارة بدت ترتفع',
      desc: `الحرارة ${temp !== null ? `${temp.toFixed(1)}°C` : 'دافئة'} — خفف الظلال أو شيل الكفر قبل ما يبدأ هبوط الأداء.`,
      accent: 'amber',
      gaugePercent: temp !== null ? Math.min(100, Math.round((temp / 50) * 100)) : 65,
    };
  }

  return {
    status: 'safe',
    title: 'الحرارة ممتازة ومستقرة',
    desc: `الحرارة ${temp !== null ? `${temp.toFixed(1)}°C` : 'طبيعية'} — الجهاز جاهز لأعلى أداء بدون اختناق حراري.`,
    accent: 'emerald',
    gaugePercent: temp !== null ? Math.min(100, Math.round((temp / 50) * 100)) : 35,
  };
}

export function DeviceDashboard({
  snapshot,
  snapshotLoading,
  snapshotError,
  ping,
  pingLoading,
  pingError,
  onRefreshSnapshot,
  onMeasurePing,
  onStartSmartSession,
  onNavigate,
}: DeviceDashboardProps) {
  const isWeb = snapshot?.platform !== 'android-native';
  const thermalInfo = getThermalAssessment(snapshot);

  const ramPercent =
    snapshot?.ram.usedMb && snapshot?.ram.totalMb
      ? Math.round((snapshot.ram.usedMb / snapshot.ram.totalMb) * 100)
      : snapshot?.ram.totalMb
        ? 50
        : null;

  const ramValueText =
    snapshot?.ram.usedMb && snapshot?.ram.totalMb
      ? `${ramPercent}%`
      : snapshot?.ram.totalMb
        ? `~${Math.round(snapshot.ram.totalMb / 1024)}GB`
        : '—';

  const ramSubText =
    snapshot?.ram.availableMb !== null && snapshot?.ram.availableMb !== undefined
      ? `متاح ${(snapshot.ram.availableMb / 1024).toFixed(1)} GB`
      : snapshot?.ram.supported
        ? 'سعة تقريبية من المتصفح'
        : 'متاح بنسخة الجوال';

  const batteryPercent = snapshot?.battery.levelPercent ?? null;
  const batteryValueText = batteryPercent !== null ? `${batteryPercent}%` : '—';
  const batterySubText =
    batteryPercent !== null
      ? snapshot?.battery.isCharging
        ? 'يشحن حالياً'
        : 'على البطارية'
      : 'غير مدعوم بالمتصفح';

  const pingPercent = ping ? Math.min(100, Math.max(8, Math.round((ping.avgMs / 200) * 100))) : null;
  const pingValueText = ping ? `${ping.avgMs}ms` : '—';
  const pingSubText = ping ? `رعشة ${ping.jitterMs}ms · فقد ${ping.packetLossPercent}%` : 'اضغط فحص البنق';

  const tempValueText =
    snapshot?.thermal.temperatureC !== null && snapshot?.thermal.temperatureC !== undefined
      ? `${snapshot.thermal.temperatureC.toFixed(1)}°`
      : '—';

  return (
    <div className="space-y-6">
      {/* Hero Launch Card */}
      <section className="glass-card relative overflow-hidden rounded-3xl p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-sky-300">
              <Cpu className="h-4 w-4" />
              <span>
                {snapshot ? `${snapshot.device.manufacturer} ${snapshot.device.model}` : 'جاري قراءة الجهاز...'}
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-slate-400">
                {snapshot?.platform === 'android-native'
                  ? translations.platform.androidBadge
                  : translations.platform.webBadge}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              لوحة الأداء المباشرة
            </h1>
            <p className="max-w-xl text-sm text-slate-300">
              قراءات حقيقية من جهازك وشبكتك بالوقت الفعلي. ابدأ جلسة لعب ذكية لتسجيل الحرارة والبطارية كل 10 ثواني.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <motion.button
              type="button"
              whileTap={{scale: 0.97}}
              onClick={onStartSmartSession}
              className="inline-flex min-h-[54px] items-center justify-center gap-3 rounded-2xl bg-gradient-to-l from-violet-600 via-fuchsia-600 to-sky-500 px-7 py-3.5 text-base font-extrabold text-white shadow-lg shadow-violet-600/30 transition-opacity hover:opacity-95 whitespace-nowrap shrink-0"
            >
              <Play className="h-5 w-5 fill-current" />
              <span>{translations.dashboard.startSessionBig}</span>
            </motion.button>

            <div className="flex items-center gap-2">
              <motion.button
                type="button"
                whileTap={{scale: 0.97}}
                onClick={onRefreshSnapshot}
                disabled={snapshotLoading}
                className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-100 hover:border-sky-400/50 disabled:opacity-50 whitespace-nowrap"
              >
                <RefreshCw className={`h-4 w-4 text-sky-400 ${snapshotLoading ? 'animate-spin' : ''}`} />
                <span>{snapshotLoading ? translations.dashboard.refreshing : translations.dashboard.refreshBtn}</span>
              </motion.button>

              <motion.button
                type="button"
                whileTap={{scale: 0.97}}
                onClick={onMeasurePing}
                disabled={pingLoading}
                className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl border border-violet-400/30 bg-violet-500/15 px-4 py-2.5 text-xs font-bold text-violet-200 hover:bg-violet-500/25 disabled:opacity-50 whitespace-nowrap"
              >
                <Activity className={`h-4 w-4 text-violet-300 ${pingLoading ? 'animate-pulse' : ''}`} />
                <span>{pingLoading ? translations.dashboard.pinging : translations.dashboard.pingBtn}</span>
              </motion.button>
            </div>
          </div>
        </div>
      </section>

      {/* Live 4 Telemetry Gauges */}
      <section className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <RadialGauge
          label={translations.dashboard.tempGauge}
          valueText={tempValueText}
          subText={snapshot?.thermal.supported ? thermalInfo.title : 'يتطلب نسخة Android'}
          percent={thermalInfo.gaugePercent}
          accent={thermalInfo.accent}
        />
        <RadialGauge
          label={translations.dashboard.ramGauge}
          valueText={ramValueText}
          subText={ramSubText}
          percent={ramPercent}
          accent="purple"
        />
        <RadialGauge
          label={translations.dashboard.batteryGauge}
          valueText={batteryValueText}
          subText={batterySubText}
          percent={batteryPercent}
          accent={batteryPercent !== null && batteryPercent <= 20 ? 'amber' : 'emerald'}
        />
        <RadialGauge
          label={translations.dashboard.pingGauge}
          valueText={pingValueText}
          subText={pingSubText}
          percent={pingPercent}
          accent={ping && ping.avgMs > 110 ? 'rose' : 'blue'}
        />
      </section>

      {/* Errors */}
      {(snapshotError || pingError) && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-500/35 bg-rose-500/10 p-4 text-sm text-rose-200">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
          <span>{snapshotError || pingError}</span>
        </div>
      )}

      {/* Browser Limitation Honest Notice */}
      {snapshot && isWeb && (
        <div className="glass-card flex items-start gap-3 rounded-2xl border-amber-400/25 p-4 text-sm">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="space-y-1">
            <p className="font-bold text-amber-300">{translations.platform.webBannerTitle}</p>
            <p className="leading-relaxed text-slate-300">{translations.platform.webBannerDesc}</p>
          </div>
        </div>
      )}

      {/* Thermal Throttling Detector & Real Cooling Steps */}
      <section className="glass-card rounded-3xl p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                thermalInfo.status === 'throttling'
                  ? 'bg-rose-500/20 text-rose-400'
                  : thermalInfo.status === 'early-warning'
                    ? 'bg-amber-500/20 text-amber-400'
                    : thermalInfo.status === 'safe'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-violet-500/20 text-violet-300'
              }`}
            >
              {thermalInfo.status === 'safe' ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : thermalInfo.status === 'throttling' ? (
                <ShieldAlert className="h-5 w-5" />
              ) : (
                <Flame className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-white">{translations.dashboard.thermalTitle}</h2>
              <p className="mt-0.5 text-sm font-semibold text-slate-200">{thermalInfo.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{thermalInfo.desc}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('assistant')}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-sky-400/30 bg-sky-500/15 px-4 py-2 text-xs font-bold text-sky-200 hover:bg-sky-500/25 whitespace-nowrap shrink-0"
          >
            <Sparkles className="h-4 w-4" />
            <span>استشارة المساعد الذكي</span>
          </button>
        </div>

        {/* Real Actionable Cooling Steps */}
        <div className="grid grid-cols-1 gap-3 border-t border-white/10 pt-4 sm:grid-cols-3">
          <div className="flex items-start gap-2.5 rounded-2xl bg-black/25 p-3.5">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
            <div>
              <div className="text-xs font-bold text-slate-100">فك غطاء الجوال (الكفر)</div>
              <p className="mt-0.5 text-[11px] text-slate-400">الغلاف يحبس الحرارة ويرفع المعالج للاختناق بسرعة.</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-2xl bg-black/25 p-3.5">
            <Sun className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
            <div>
              <div className="text-xs font-bold text-slate-100">خفض سطوع الشاشة لـ 55%</div>
              <p className="mt-0.5 text-[11px] text-slate-400">السطوع العالي يزيد حرارة الشاشة ويستنزف البطارية.</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-2xl bg-black/25 p-3.5">
            <BatteryCharging className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div>
              <div className="text-xs font-bold text-slate-100">إيقاف الشحن وقت اللعب</div>
              <p className="mt-0.5 text-[11px] text-slate-400">الشحن السريع مع الألعاب يضاعف حرارة البطارية.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Shortcuts Row */}
      <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onNavigate('network')}
          className="glass-card flex items-center justify-between rounded-2xl p-4 text-right transition-colors hover:border-sky-400/40"
        >
          <div>
            <div className="text-sm font-bold text-white">مقارنة سرعة DNS وفحص الـ Jitter</div>
            <div className="mt-0.5 text-xs text-slate-400">اعرف أسرع خادم DNS لشبكتك الحالية</div>
          </div>
          <Activity className="h-5 w-5 text-sky-400" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('games')}
          className="glass-card flex items-center justify-between rounded-2xl p-4 text-right transition-colors hover:border-violet-400/40"
        >
          <div>
            <div className="text-sm font-bold text-white">ملفات الألعاب ومدير المساحة</div>
            <div className="mt-0.5 text-xs text-slate-400">
              {snapshot?.storage.supported && snapshot.storage.availableGb !== null
                ? `المساحة المتاحة: ${snapshot.storage.availableGb} GB (${snapshot.storage.scopeLabel})`
                : 'إدارة إعدادات الألعاب وفحص المساحة'}
            </div>
          </div>
          <HardDrive className="h-5 w-5 text-violet-400" />
        </button>
      </section>
    </div>
  );
}
