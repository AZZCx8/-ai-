import {Capacitor, registerPlugin} from '@capacitor/core';
import {API_BASE} from './apiBase';
import {Device} from '@capacitor/device';
import {Network} from '@capacitor/network';
import type {
  BatteryMetrics,
  DeviceSnapshot,
  DnsBenchmarkItem,
  DnsBenchmarkResult,
  InstalledGameStorage,
  NetworkMetrics,
  PingMeasurement,
  PlatformSource,
  RamMetrics,
  StorageMetrics,
  ThermalStatus,
} from '../types/gamemind';

interface NativeDeviceStatsResult {
  ram?: {
    totalMb?: number;
    availableMb?: number;
    usedMb?: number;
    lowMemory?: boolean;
  };
  battery?: {
    levelPercent?: number;
    isCharging?: boolean;
    temperatureC?: number;
  };
  storage?: {
    totalGb?: number;
    availableGb?: number;
    usedGb?: number;
  };
  network?: {
    connected?: boolean;
    type?: string;
    downlinkKbps?: number;
  };
  device?: {
    manufacturer?: string;
    model?: string;
    androidVersion?: string;
    cpuCores?: number;
  };
}

interface NativeThermalResult {
  temperatureC?: number;
  thermalState?: 'nominal' | 'light' | 'moderate' | 'severe' | 'critical';
  supported?: boolean;
}

interface NativePingResult {
  avgMs: number;
  minMs: number;
  maxMs: number;
  jitterMs: number;
  packetLossPercent: number;
  target: string;
}

interface NativeDnsResult {
  ip: string;
  latencyMs: number;
}

interface NativeLaunchResult {
  launched: boolean;
  reason?: string;
}

interface NativeDndResult {
  applied: boolean;
  permissionRequired?: boolean;
  enabled?: boolean;
  message?: string;
}

interface NativeInstalledGamesResult {
  games?: InstalledGameStorage[];
}

interface NativeOpenSettingsResult {
  opened: boolean;
}

interface SharkBoostNativePlugin {
  getDeviceStats(): Promise<NativeDeviceStatsResult>;
  getThermalStatus(): Promise<NativeThermalResult>;
  measurePing(options: {url?: string; samples?: number}): Promise<NativePingResult>;
  measureDnsPing(options: {ip: string}): Promise<NativeDnsResult>;
  launchGame(options: {packageName: string}): Promise<NativeLaunchResult>;
  setDoNotDisturb(options: {enabled: boolean}): Promise<NativeDndResult>;
  getInstalledGamesStorage(): Promise<NativeInstalledGamesResult>;
  openStorageSettings(): Promise<NativeOpenSettingsResult>;
}

const SharkBoostNative = registerPlugin<SharkBoostNativePlugin>('SharkBoost');

interface NavigatorBatteryManager {
  level: number;
  charging: boolean;
}

interface NavigatorWithExtras extends Navigator {
  deviceMemory?: number;
  getBattery?: () => Promise<NavigatorBatteryManager>;
  connection?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    type?: string;
  };
}

export function isNativeAndroidPlatform(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function getDeviceSnapshot(): Promise<DeviceSnapshot> {
  const capturedAt = new Date().toISOString();

  if (isNativeAndroidPlatform()) {
    try {
      const [stats, thermal] = await Promise.all([
        SharkBoostNative.getDeviceStats(),
        SharkBoostNative.getThermalStatus().catch(() => ({supported: false} as NativeThermalResult)),
      ]);

      const ram: RamMetrics = {
        supported: typeof stats.ram?.totalMb === 'number',
        totalMb: stats.ram?.totalMb ?? null,
        availableMb: stats.ram?.availableMb ?? null,
        usedMb: stats.ram?.usedMb ?? null,
        lowMemory: stats.ram?.lowMemory ?? null,
        note: 'قراءة مباشرة من نظام Android (ActivityManager)',
      };

      const batteryTemp =
        typeof stats.battery?.temperatureC === 'number'
          ? stats.battery.temperatureC
          : typeof thermal.temperatureC === 'number'
            ? thermal.temperatureC
            : null;

      const battery: BatteryMetrics = {
        supported: typeof stats.battery?.levelPercent === 'number' && stats.battery.levelPercent >= 0,
        levelPercent:
          typeof stats.battery?.levelPercent === 'number' && stats.battery.levelPercent >= 0
            ? stats.battery.levelPercent
            : null,
        isCharging: typeof stats.battery?.isCharging === 'boolean' ? stats.battery.isCharging : null,
        temperatureC: batteryTemp,
        note: batteryTemp !== null ? 'قراءة حقيقية من حساس البطارية' : 'البطارية مقروءة بدون حساس حرارة',
      };

      const storage: StorageMetrics = {
        supported: typeof stats.storage?.totalGb === 'number',
        totalGb: stats.storage?.totalGb ?? null,
        availableGb: stats.storage?.availableGb ?? null,
        usedGb: stats.storage?.usedGb ?? null,
        scopeLabel: 'ذاكرة الجهاز الداخلية',
        note: 'قراءة مباشرة عبر StatFs',
      };

      const rawType = stats.network?.type ?? 'unknown';
      const netType: NetworkMetrics['type'] =
        rawType === 'wifi' || rawType === 'cellular' || rawType === 'ethernet' || rawType === 'none'
          ? rawType
          : 'unknown';

      const network: NetworkMetrics = {
        connected: Boolean(stats.network?.connected),
        type: netType,
        effectiveType: null,
        downlinkMbps:
          typeof stats.network?.downlinkKbps === 'number' && stats.network.downlinkKbps > 0
            ? Math.round((stats.network.downlinkKbps / 1000) * 10) / 10
            : null,
        rttEstimateMs: null,
        note: 'قراءة مباشرة من ConnectivityManager',
      };

      const thermalStatus: ThermalStatus = {
        supported: Boolean(thermal.supported || batteryTemp !== null),
        temperatureC: batteryTemp,
        thermalState: thermal.thermalState ?? 'unavailable',
        note:
          batteryTemp !== null
            ? 'مراقبة حقيقية عبر حساس حرارة الجهاز'
            : 'حالة الحرارة مقروءة من نظام الطاقة في Android',
      };

      return {
        platform: 'android-native',
        capturedAt,
        ram,
        battery,
        storage,
        network,
        device: {
          manufacturer: stats.device?.manufacturer || 'Android',
          model: stats.device?.model || 'جهاز أندرويد',
          osVersion: `Android ${stats.device?.androidVersion || ''}`.trim(),
          cpuCores: stats.device?.cpuCores ?? null,
        },
        thermal: thermalStatus,
      };
    } catch {
      // Fallback below
    }
  }

  const nav = navigator as NavigatorWithExtras;
  const platform: PlatformSource = isNativeAndroidPlatform() ? 'android-native' : 'web-browser';

  const [deviceInfo, batteryPluginInfo, networkStatus] = await Promise.all([
    Device.getInfo().catch(() => null),
    Device.getBatteryInfo().catch(() => null),
    Network.getStatus().catch(() => ({connected: navigator.onLine, connectionType: 'unknown' as const})),
  ]);

  const approxDeviceRamGb = typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null;
  const ram: RamMetrics = {
    supported: approxDeviceRamGb !== null,
    totalMb: approxDeviceRamGb !== null ? approxDeviceRamGb * 1024 : null,
    availableMb: null,
    usedMb: null,
    lowMemory: null,
    note:
      approxDeviceRamGb !== null
        ? `المتصفح يكشف السعة التقريبية فقط (~${approxDeviceRamGb} GB)، استهلاك الرام الدقيق يتوفر في نسخة الجوال.`
        : 'متصفحك ما يسمح بقراءة الرام — تتوفر كاملة في نسخة Android.',
  };

  let levelPercent: number | null =
    typeof batteryPluginInfo?.batteryLevel === 'number'
      ? Math.round(batteryPluginInfo.batteryLevel * 100)
      : null;
  let isCharging: boolean | null =
    typeof batteryPluginInfo?.isCharging === 'boolean' ? batteryPluginInfo.isCharging : null;

  if (levelPercent === null && typeof nav.getBattery === 'function') {
    try {
      const bat = await nav.getBattery();
      levelPercent = Math.round(bat.level * 100);
      isCharging = bat.charging;
    } catch {
      // Blocked by browser
    }
  }

  const battery: BatteryMetrics = {
    supported: levelPercent !== null,
    levelPercent,
    isCharging,
    temperatureC: null,
    note:
      levelPercent !== null
        ? 'نسبة الشحن حقيقية من المتصفح. حرارة البطارية (°C) تتطلب نسخة الجوال.'
        : 'متصفحك ما يدعم قراءة البطارية — تتوفر كاملة في نسخة الجوال.',
  };

  let storage: StorageMetrics = {
    supported: false,
    totalGb: null,
    availableGb: null,
    usedGb: null,
    scopeLabel: 'مساحة المتصفح المخصصة للتطبيق',
    note: 'المتصفح ما يعرض سعة تخزين الجوال الكاملة — تتوفر في نسخة Android.',
  };

  if (navigator.storage && typeof navigator.storage.estimate === 'function') {
    try {
      const est = await navigator.storage.estimate();
      if (typeof est.quota === 'number' && typeof est.usage === 'number') {
        const toGb = (bytes: number) => Math.round((bytes / (1024 * 1024 * 1024)) * 100) / 100;
        const totalGb = toGb(est.quota);
        const usedGb = toGb(est.usage);
        const availableGb = Math.max(0, Math.round((totalGb - usedGb) * 100) / 100);
        storage = {
          supported: true,
          totalGb,
          usedGb,
          availableGb,
          scopeLabel: 'حصة المتصفح (Web Quota)',
          note: 'هذي مساحة المتصفح المتاحة للتطبيق فقط، مساحة الجوال الكاملة تظهر في نسخة Android.',
        };
      }
    } catch {
      // Ignore
    }
  }

  const conn = nav.connection;
  const mappedType: NetworkMetrics['type'] = !networkStatus.connected
    ? 'none'
    : networkStatus.connectionType === 'wifi'
      ? 'wifi'
      : networkStatus.connectionType === 'cellular'
        ? 'cellular'
        : conn?.type === 'wifi'
          ? 'wifi'
          : conn?.type === 'cellular'
            ? 'cellular'
            : 'unknown';

  const network: NetworkMetrics = {
    connected: Boolean(networkStatus.connected && navigator.onLine),
    type: mappedType,
    effectiveType: conn?.effectiveType ?? null,
    downlinkMbps: typeof conn?.downlink === 'number' ? conn.downlink : null,
    rttEstimateMs: typeof conn?.rtt === 'number' ? conn.rtt : null,
    note: conn?.effectiveType
      ? 'بيانات الشبكة حقيقية من المتصفح (Network Information API)'
      : 'حالة الاتصال حقيقية؛ تفاصيل سرعة الشبكة التفصيلية تظهر في نسخة الجوال.',
  };

  const thermal: ThermalStatus = {
    supported: false,
    temperatureC: null,
    thermalState: 'unavailable',
    note: 'حساس الحرارة الفعلي غير متاح عبر المتصفحات — يشتغل تلقائياً في نسخة Android.',
  };

  return {
    platform,
    capturedAt,
    ram,
    battery,
    storage,
    network,
    device: {
      manufacturer: deviceInfo?.manufacturer || 'متصفح الويب',
      model: deviceInfo?.model || (deviceInfo?.operatingSystem ? `${deviceInfo.operatingSystem}` : 'Web Device'),
      osVersion: deviceInfo?.osVersion ? `${deviceInfo.operatingSystem} ${deviceInfo.osVersion}` : navigator.platform || 'Web',
      cpuCores: typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : null,
    },
    thermal,
  };
}

export async function measureRealPing(samplesCount = 5): Promise<PingMeasurement> {
  if (!navigator.onLine) {
    throw new Error('جهازك غير متصل بالإنترنت حالياً، تأكد من الواي فاي أو البيانات.');
  }

  if (isNativeAndroidPlatform()) {
    try {
      const originPingUrl = `${API_BASE || window.location.origin}/api/ping`;
      const res = await SharkBoostNative.measurePing({url: originPingUrl, samples: samplesCount});
      return {
        avgMs: res.avgMs,
        minMs: res.minMs,
        maxMs: res.maxMs,
        jitterMs: res.jitterMs,
        packetLossPercent: res.packetLossPercent,
        samples: [res.minMs, res.avgMs, res.maxMs],
        measuredAt: new Date().toISOString(),
        target: res.target,
        source: 'android-native',
      };
    } catch {
      // Fall through to HTTP fetch
    }
  }

  const samples: number[] = [];
  let failures = 0;

  for (let i = 0; i < samplesCount; i++) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 5000);
    const start = performance.now();
    try {
      const resp = await fetch(`${API_BASE}/api/ping?seq=${i}&t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      await resp.json();
      const elapsed = Math.max(1, Math.round(performance.now() - start));
      samples.push(elapsed);
    } catch {
      failures++;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  if (samples.length === 0) {
    throw new Error('تعذر الوصول للخادم لقياس البنق الحقيقي — تأكد من الاتصال بالإنترنت.');
  }

  const avgMs = Math.round(samples.reduce((acc, v) => acc + v, 0) / samples.length);
  const minMs = Math.min(...samples);
  const maxMs = Math.max(...samples);
  let jitterMs = 0;
  if (samples.length > 1) {
    let diffSum = 0;
    for (let i = 1; i < samples.length; i++) {
      diffSum += Math.abs(samples[i] - samples[i - 1]);
    }
    jitterMs = Math.round(diffSum / (samples.length - 1));
  }

  return {
    avgMs,
    minMs,
    maxMs,
    jitterMs,
    packetLossPercent: Math.round((failures / samplesCount) * 100),
    samples,
    measuredAt: new Date().toISOString(),
    target: '/api/ping',
    source: isNativeAndroidPlatform() ? 'android-native' : 'web-browser',
  };
}

interface DnsCandidate {
  id: string;
  name: string;
  primaryIp: string;
  secondaryIp: string;
  privateDnsHost: string;
  dohUrl: string;
  acceptHeader?: string;
}

const DNS_CANDIDATES: DnsCandidate[] = [
  {
    id: 'cloudflare',
    name: 'Cloudflare DNS',
    primaryIp: '1.1.1.1',
    secondaryIp: '1.0.0.1',
    privateDnsHost: 'one.one.one.one',
    dohUrl: 'https://cloudflare-dns.com/dns-query?name=example.com&type=A',
    acceptHeader: 'application/dns-json',
  },
  {
    id: 'google',
    name: 'Google Public DNS',
    primaryIp: '8.8.8.8',
    secondaryIp: '8.8.4.4',
    privateDnsHost: 'dns.google',
    dohUrl: 'https://dns.google/resolve?name=example.com&type=A',
  },
  {
    id: 'quad9',
    name: 'Quad9 DNS',
    primaryIp: '9.9.9.9',
    secondaryIp: '149.112.112.112',
    privateDnsHost: 'dns.quad9.net',
    dohUrl: 'https://dns.quad9.net:5053/dns-query?name=example.com&type=A',
    acceptHeader: 'application/dns-json',
  },
  {
    id: 'adguard',
    name: 'AdGuard DNS',
    primaryIp: '94.140.14.14',
    secondaryIp: '94.140.15.15',
    privateDnsHost: 'dns.adguard-dns.com',
    dohUrl: 'https://dns.adguard-dns.com/resolve?name=example.com&type=A',
  },
];

async function probeWebDohLatency(candidate: DnsCandidate): Promise<number | null> {
  const timings: number[] = [];
  for (let i = 0; i < 2; i++) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 3000);
    const start = performance.now();
    try {
      const headers: Record<string, string> = {};
      if (candidate.acceptHeader) {
        headers.Accept = candidate.acceptHeader;
      }
      const resp = await fetch(`${candidate.dohUrl}&_t=${Date.now()}`, {
        method: 'GET',
        headers,
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      await resp.json();
      const elapsed = Math.max(1, Math.round(performance.now() - start));
      timings.push(elapsed);
    } catch {
      // Failed or blocked by CORS/network
    } finally {
      window.clearTimeout(timer);
    }
  }
  if (timings.length === 0) return null;
  // Use the second warm lookup if available to avoid cold TLS handshake skew
  return timings.length > 1 ? timings[1] : timings[0];
}

export async function benchmarkDnsServers(): Promise<DnsBenchmarkResult> {
  if (!navigator.onLine) {
    throw new Error('لا يوجد اتصال بالإنترنت لاختبار خوادم الـ DNS.');
  }

  const results: DnsBenchmarkItem[] = await Promise.all(
    DNS_CANDIDATES.map(async (candidate) => {
      if (isNativeAndroidPlatform()) {
        try {
          const nativeRes = await SharkBoostNative.measureDnsPing({ip: candidate.primaryIp});
          return {
            id: candidate.id,
            name: candidate.name,
            primaryIp: candidate.primaryIp,
            secondaryIp: candidate.secondaryIp,
            privateDnsHost: candidate.privateDnsHost,
            latencyMs: nativeRes.latencyMs,
            status: 'ok' as const,
            note: 'قياس TCP مباشر لمنفذ 53 من جهازك',
          };
        } catch {
          // Fall through to DoH check
        }
      }

      const dohMs = await probeWebDohLatency(candidate);
      if (dohMs !== null) {
        return {
          id: candidate.id,
          name: candidate.name,
          primaryIp: candidate.primaryIp,
          secondaryIp: candidate.secondaryIp,
          privateDnsHost: candidate.privateDnsHost,
          latencyMs: dohMs,
          status: 'ok' as const,
          note: 'استجابة DoH حقيقية من شبكتك',
        };
      }

      return {
        id: candidate.id,
        name: candidate.name,
        primaryIp: candidate.primaryIp,
        secondaryIp: candidate.secondaryIp,
        privateDnsHost: candidate.privateDnsHost,
        latencyMs: null,
        status: 'unavailable' as const,
        note: 'تعذر القياس من المتصفح أو الخادم محجوب في الشبكة',
      };
    }),
  );

  const reachable = results
    .filter((r) => r.status === 'ok' && r.latencyMs !== null)
    .sort((a, b) => (a.latencyMs ?? 9999) - (b.latencyMs ?? 9999));

  return {
    measuredAt: new Date().toISOString(),
    recommendedId: reachable.length > 0 ? reachable[0].id : null,
    items: results,
  };
}

export async function getRealThermalStatus(): Promise<ThermalStatus> {
  if (isNativeAndroidPlatform()) {
    try {
      const res = await SharkBoostNative.getThermalStatus();
      return {
        supported: Boolean(res.supported),
        temperatureC: typeof res.temperatureC === 'number' ? res.temperatureC : null,
        thermalState: res.thermalState ?? 'nominal',
        note: 'قراءة مباشرة من حساس حرارة الجهاز',
      };
    } catch {
      // Fallback below
    }
  }

  return {
    supported: false,
    temperatureC: null,
    thermalState: 'unavailable',
    note: 'قراءة الحرارة التلقائية متاحة في نسخة الجوال (Android) فقط.',
  };
}

export async function launchGameApp(
  packageName: string,
): Promise<{launched: boolean; supported: boolean; message: string}> {
  if (isNativeAndroidPlatform()) {
    try {
      const res = await SharkBoostNative.launchGame({packageName});
      return {
        launched: res.launched,
        supported: true,
        message: res.launched
          ? 'تم فتح اللعبة مع تفعيل مراقبة الجلسة في الخلفية.'
          : res.reason || 'اللعبة غير مثبتة على هذا الجهاز.',
      };
    } catch (err) {
      return {
        launched: false,
        supported: true,
        message: err instanceof Error ? err.message : 'تعذر فتح اللعبة.',
      };
    }
  }

  return {
    launched: false,
    supported: false,
    message: 'تشغيل الألعاب المثبتة مباشرة متاح في نسخة Android فقط — شغّل اللعبة يدوياً وخلّ مراقبة الجلسة شغالة هنا.',
  };
}

export async function toggleDoNotDisturb(
  enabled: boolean,
): Promise<{applied: boolean; supported: boolean; message: string}> {
  if (isNativeAndroidPlatform()) {
    try {
      const res = await SharkBoostNative.setDoNotDisturb({enabled});
      return {
        applied: res.applied,
        supported: true,
        message:
          res.message ||
          (res.applied
            ? enabled
              ? 'تم تفعيل وضع عدم الإزعاج تلقائياً.'
              : 'تم إرجاع الإشعارات لوضعها الطبيعي.'
            : 'يتطلب تفعيل إذن عدم الإزعاج.'),
      };
    } catch (err) {
      return {
        applied: false,
        supported: true,
        message: err instanceof Error ? err.message : 'تعذر تغيير وضع عدم الإزعاج.',
      };
    }
  }

  return {
    applied: false,
    supported: false,
    message: 'تفعيل عدم الإزعاج التلقائي متاح في تطبيق Android فقط — فعّل وضع التركيز يدوياً من شريط الإشعارات.',
  };
}

export async function getInstalledGamesStorage(): Promise<{
  supported: boolean;
  games: InstalledGameStorage[];
  note: string;
}> {
  if (isNativeAndroidPlatform()) {
    try {
      const res = await SharkBoostNative.getInstalledGamesStorage();
      const games = Array.isArray(res.games) ? res.games : [];
      return {
        supported: true,
        games,
        note:
          games.length > 0
            ? 'أحجام ملفات الألعاب المثبتة مقروءة مباشرة من نظام Android (حجم التطبيق الأساسي APK).'
            : 'ما لقينا ألعاب معروفة مثبتة حالياً على هذا الجهاز.',
      };
    } catch {
      return {
        supported: false,
        games: [],
        note: 'تعذر قراءة قائمة الألعاب من النظام.',
      };
    }
  }

  return {
    supported: false,
    games: [],
    note: 'فحص حجم الألعاب المثبتة على الجوال محجوب في المتصفحات لأسباب الأمان — يشتغل مباشرة في تطبيق Android.',
  };
}

export async function openDeviceStorageSettings(): Promise<{
  opened: boolean;
  supported: boolean;
  message: string;
}> {
  if (isNativeAndroidPlatform()) {
    try {
      const res = await SharkBoostNative.openStorageSettings();
      return {
        opened: Boolean(res.opened),
        supported: true,
        message: 'تم فتح شاشة إعدادات التخزين في الجوال.',
      };
    } catch (err) {
      return {
        opened: false,
        supported: true,
        message: err instanceof Error ? err.message : 'تعذر فتح إعدادات التخزين.',
      };
    }
  }

  return {
    opened: false,
    supported: false,
    message: 'الانتقال المباشر لإعدادات التخزين في الجوال متاح في نسخة Android فقط — افتح الإعدادات > التخزين في جوالك يدوياً.',
  };
}
