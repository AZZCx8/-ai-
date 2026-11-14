import {useState} from 'react';
import {motion} from 'motion/react';
import {
  Activity,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Globe,
  RefreshCw,
  Wifi,
} from 'lucide-react';
import {benchmarkDnsServers} from '../services/androidBridge';
import {translations} from '../i18n/translations';
import type {DeviceSnapshot, DnsBenchmarkResult, PingMeasurement} from '../types/gamemind';

interface NetworkCheckerViewProps {
  snapshot: DeviceSnapshot | null;
  ping: PingMeasurement | null;
  pingLoading: boolean;
  pingError: string | null;
  onMeasurePing: () => void;
}

export function NetworkCheckerView({
  snapshot,
  ping,
  pingLoading,
  pingError,
  onMeasurePing,
}: NetworkCheckerViewProps) {
  const [dnsResult, setDnsResult] = useState<DnsBenchmarkResult | null>(null);
  const [dnsLoading, setDnsLoading] = useState(false);
  const [dnsError, setDnsError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showDnsGuide, setShowDnsGuide] = useState(false);

  async function handleRunDnsBenchmark() {
    setDnsLoading(true);
    setDnsError(null);
    try {
      const res = await benchmarkDnsServers();
      setDnsResult(res);
    } catch (err) {
      setDnsError(err instanceof Error ? err.message : 'تعذر اختبار خوادم الـ DNS.');
    } finally {
      setDnsLoading(false);
    }
  }

  async function handleCopyText(id: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setDnsError('المتصفح منع النسخ التلقائي — انسخ العنوان يدوياً.');
    }
  }

  const bestDns = dnsResult?.items.find((i) => i.id === dnsResult.recommendedId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white">{translations.network.title}</h1>
        <p className="mt-1 text-sm text-slate-400">{translations.network.subtitle}</p>
      </div>

      {/* Real Ping / Jitter / Packet Loss */}
      <section className="glass-card rounded-3xl p-5 space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/20 text-sky-300">
              <Wifi className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">فحص الاتصال الفعلي (5 عينات)</h2>
              <p className="text-xs text-slate-400">
                الشبكة الحالية:{' '}
                {snapshot?.network.connected
                  ? `${snapshot.network.type.toUpperCase()} ${snapshot.network.effectiveType ? `(${snapshot.network.effectiveType})` : ''}`
                  : 'غير متصل'}
              </p>
            </div>
          </div>

          <motion.button
            type="button"
            whileTap={{scale: 0.97}}
            onClick={onMeasurePing}
            disabled={pingLoading}
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-sky-500 to-violet-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Activity className={`h-4 w-4 ${pingLoading ? 'animate-pulse' : ''}`} />
            <span>{pingLoading ? 'جاري فحص العينات...' : translations.network.testPingBtn}</span>
          </motion.button>
        </div>

        {pingError && (
          <div className="flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-sm text-rose-200">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{pingError}</span>
          </div>
        )}

        {ping ? (
          <div className="space-y-4 border-t border-white/10 pt-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl bg-black/30 p-3.5">
                <div className="text-xs text-slate-400">متوسط البنق</div>
                <div className="mt-1 font-mono-num text-2xl font-bold text-sky-300">{ping.avgMs} ms</div>
              </div>
              <div className="rounded-2xl bg-black/30 p-3.5">
                <div className="text-xs text-slate-400">التذبذب (Jitter)</div>
                <div
                  className={`mt-1 font-mono-num text-2xl font-bold ${
                    ping.jitterMs <= 15 ? 'text-emerald-300' : 'text-amber-300'
                  }`}
                >
                  {ping.jitterMs} ms
                </div>
              </div>
              <div className="rounded-2xl bg-black/30 p-3.5">
                <div className="text-xs text-slate-400">فقدان الحزم</div>
                <div
                  className={`mt-1 font-mono-num text-2xl font-bold ${
                    ping.packetLossPercent === 0 ? 'text-emerald-300' : 'text-rose-400'
                  }`}
                >
                  {ping.packetLossPercent}%
                </div>
              </div>
              <div className="rounded-2xl bg-black/30 p-3.5">
                <div className="text-xs text-slate-400">النطاق (Min / Max)</div>
                <div className="mt-1 font-mono-num text-lg font-bold text-slate-200">
                  {ping.minMs}–{ping.maxMs} ms
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>العينات المقاسة فعلياً:</span>
              {ping.samples.map((ms, i) => (
                <span key={i} className="font-mono-num rounded-lg bg-white/5 px-2.5 py-1 text-slate-200">
                  #{i + 1}: {ms}ms
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="border-t border-white/10 pt-4 text-sm text-slate-400">
            اضغط على زر الفحص لقياس البنق الحقيقي والرعشة وفقدان الحزم من شبكتك الحالية.
          </p>
        )}
      </section>

      {/* DNS Benchmark Comparison */}
      <section className="glass-card rounded-3xl p-5 space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-300">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">مقارنة سرعة خوادم DNS</h2>
              <p className="text-xs text-slate-400">يقيس سرعة استجابة Cloudflare وGoogle وQuad9 وAdGuard من جهازك</p>
            </div>
          </div>

          <motion.button
            type="button"
            whileTap={{scale: 0.97}}
            onClick={handleRunDnsBenchmark}
            disabled={dnsLoading}
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border border-violet-400/40 bg-violet-500/20 px-5 py-2.5 text-sm font-bold text-violet-100 hover:bg-violet-500/30 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${dnsLoading ? 'animate-spin' : ''}`} />
            <span>{dnsLoading ? 'جاري اختبار الخوادم...' : translations.network.testDnsBtn}</span>
          </motion.button>
        </div>

        {dnsError && (
          <div className="flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-sm text-rose-200">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{dnsError}</span>
          </div>
        )}

        {dnsResult && (
          <div className="space-y-4 border-t border-white/10 pt-4">
            {bestDns ? (
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs font-bold text-emerald-300">التوصية الأسرع لشبكتك الآن</div>
                    <div className="mt-0.5 text-lg font-extrabold text-white">
                      {bestDns.name} ({bestDns.latencyMs} ms)
                    </div>
                    <div className="mt-1 font-mono-num text-xs text-slate-300">
                      IPv4: {bestDns.primaryIp} / {bestDns.secondaryIp} · Private DNS: {bestDns.privateDnsHost}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyText('best-dns', bestDns.privateDnsHost)}
                    className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 whitespace-nowrap shrink-0"
                  >
                    {copiedId === 'best-dns' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    <span>{copiedId === 'best-dns' ? 'تم نسخ العنوان' : 'نسخ عنوان Private DNS'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                تعذر قياس استجابة خوادم الـ DNS مباشرة من المتصفح (بسبب قيود الشبكة أو حجب DoH). جرب من تطبيق Android أو تأكد من الاتصال.
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {dnsResult.items.map((item) => {
                const isBest = item.id === dnsResult.recommendedId;
                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-4 ${
                      isBest ? 'border-emerald-400/40 bg-emerald-500/5' : 'border-white/10 bg-black/25'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white">{item.name}</div>
                        <div className="font-mono-num text-xs text-slate-400">
                          {item.primaryIp} · {item.secondaryIp}
                        </div>
                      </div>
                      <div className="text-left">
                        {item.latencyMs !== null ? (
                          <span className="font-mono-num text-xl font-bold text-sky-300">
                            {item.latencyMs} ms
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400">غير متاح</span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-400">
                      <span>{item.note}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyText(item.id, item.primaryIp)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/10"
                      >
                        {copiedId === item.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedId === item.id ? 'نُسخ' : 'نسخ IP'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step-by-step Mobile DNS Setup Guide */}
        <div className="border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={() => setShowDnsGuide((prev) => !prev)}
            className="flex min-h-[44px] w-full items-center justify-between text-sm font-bold text-sky-300 hover:text-sky-200"
          >
            <span>كيف تغيّر الـ DNS في إعدادات الجوال؟ (Android وiPhone)</span>
            {showDnsGuide ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showDnsGuide && (
            <div className="mt-3 grid grid-cols-1 gap-4 rounded-2xl bg-black/30 p-4 text-xs leading-relaxed text-slate-300 sm:grid-cols-2">
              <div className="space-y-1.5">
                <div className="font-bold text-white">أجهزة Android (الطريقة الأفضل والأسرع):</div>
                <ol className="list-inside list-decimal space-y-1">
                  <li>افتح إعدادات الجوال ← الشبكة والإنترنت (أو الاتصالات).</li>
                  <li>اختر <strong>DNS الخاص (Private DNS)</strong>.</li>
                  <li>اختر «اسم مضيف موفّر DNS الخاص» واكتب: <span className="font-mono-num text-sky-300">{bestDns?.privateDnsHost ?? 'one.one.one.one'}</span></li>
                  <li>اضغط حفظ وارجع هنا افحص البنق مرة ثانية.</li>
                </ol>
              </div>
              <div className="space-y-1.5">
                <div className="font-bold text-white">أجهزة iPhone (iOS):</div>
                <ol className="list-inside list-decimal space-y-1">
                  <li>افتح الإعدادات ← Wi-Fi ← اضغط علامة (i) بجانب شبكتك.</li>
                  <li>انزل إلى <strong>تكوين DNS</strong> واختر «يدوي».</li>
                  <li>احذف القديم وأضف الخادم الموصى به: <span className="font-mono-num text-sky-300">{bestDns?.primaryIp ?? '1.1.1.1'}</span> ثم <span className="font-mono-num text-sky-300">{bestDns?.secondaryIp ?? '1.0.0.1'}</span>.</li>
                  <li>اضغط حفظ.</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
