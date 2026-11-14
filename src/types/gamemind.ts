export type PlatformSource = 'android-native' | 'web-browser';

export type NavTabId = 'dashboard' | 'network' | 'games' | 'assistant' | 'sessions';

export interface RamMetrics {
  supported: boolean;
  totalMb: number | null;
  availableMb: number | null;
  usedMb: number | null;
  lowMemory: boolean | null;
  note: string;
}

export interface BatteryMetrics {
  supported: boolean;
  levelPercent: number | null;
  isCharging: boolean | null;
  temperatureC: number | null;
  note: string;
}

export interface StorageMetrics {
  supported: boolean;
  totalGb: number | null;
  availableGb: number | null;
  usedGb: number | null;
  scopeLabel: string;
  note: string;
}

export interface NetworkMetrics {
  connected: boolean;
  type: 'wifi' | 'cellular' | 'ethernet' | 'none' | 'unknown';
  effectiveType: string | null;
  downlinkMbps: number | null;
  rttEstimateMs: number | null;
  note: string;
}

export interface DeviceHardwareInfo {
  manufacturer: string;
  model: string;
  osVersion: string;
  cpuCores: number | null;
}

export interface ThermalStatus {
  supported: boolean;
  temperatureC: number | null;
  thermalState: 'nominal' | 'light' | 'moderate' | 'severe' | 'critical' | 'unavailable';
  note: string;
}

export interface DeviceSnapshot {
  platform: PlatformSource;
  capturedAt: string;
  ram: RamMetrics;
  battery: BatteryMetrics;
  storage: StorageMetrics;
  network: NetworkMetrics;
  device: DeviceHardwareInfo;
  thermal: ThermalStatus;
}

export interface PingMeasurement {
  avgMs: number;
  minMs: number;
  maxMs: number;
  jitterMs: number;
  packetLossPercent: number;
  samples: number[];
  measuredAt: string;
  target: string;
  source: PlatformSource;
}

export interface DnsBenchmarkItem {
  id: string;
  name: string;
  primaryIp: string;
  secondaryIp: string;
  privateDnsHost: string;
  latencyMs: number | null;
  status: 'ok' | 'unavailable';
  note: string;
}

export interface DnsBenchmarkResult {
  measuredAt: string;
  recommendedId: string | null;
  items: DnsBenchmarkItem[];
}

export interface InstalledGameStorage {
  name: string;
  packageName: string;
  apkSizeMb: number;
}

export interface GameProfile {
  id: string;
  name: string;
  packageName: string;
  graphicsQuality: string;
  targetFps: string;
  sensitivitySummary: string;
  notes: string;
  updatedAt: string;
}

export interface SessionTelemetrySample {
  timestamp: string;
  elapsedSec: number;
  temperatureC: number | null;
  batteryPercent: number | null;
  thermalState: ThermalStatus['thermalState'];
}

export interface GameSessionRecord {
  id: string;
  game: string;
  packageName: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  prePingMs: number | null;
  postPingMs: number | null;
  batteryStartPercent: number | null;
  batteryEndPercent: number | null;
  batteryDrainPercent: number | null;
  peakTempC: number | null;
  stabilityScore: number;
  thermalAlertTriggered: boolean;
  thermalThrottlingDetected: boolean;
  dndActivated: boolean;
  samples: SessionTelemetrySample[];
  notes: string;
}

export interface AiDiagnosisResponse {
  probableCause: string;
  steps: string[];
  suggestedGraphics: {
    quality: string;
    fpsTarget: string;
    style: string;
    antiAliasing: string;
    shadows: string;
    extraTip: string;
  };
  honestHardwareNote: string;
}

export interface ProGraphicsConfig {
  gameName: string;
  presetTitle: string;
  expectedStableFps: string;
  graphicsQuality: string;
  frameRateSetting: string;
  resolutionScale: string;
  shadows: string;
  antiAliasing: string;
  autoAdjustGraphics: string;
  thermalWarning: string;
  reasoning: string;
}

export interface SensitivityCoachResult {
  coachSummary: string;
  cameraSensitivity: {
    freeLook: number;
    noScope: number;
    redDot: number;
    scope2x: number;
    scope4x: number;
    scope6x: number;
  };
  adsSensitivity: {
    noScope: number;
    redDot: number;
    scope2x: number;
    scope4x: number;
    scope6x: number;
  };
  gyroSensitivity: {
    enabledNote: string;
    noScope: number;
    redDot: number;
    scope4x: number;
    scope6x: number;
  };
  trainingDrill: string[];
}

export interface SessionAiAnalysis {
  verdict: string;
  thermalAndBatteryInsight: string;
  networkInsight: string;
  nextSessionRecommendations: string[];
  suggestedProfileUpdates: {
    graphicsQuality: string;
    targetFps: string;
    reason: string;
  };
}

export interface SubscriptionState {
  isPro: boolean;
  planName: string;
  priceLabel: string;
  activatedAt: string | null;
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
  quotaDate: string;
}
