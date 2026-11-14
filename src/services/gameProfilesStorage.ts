import type {GameProfile} from '../types/gamemind';

const PROFILES_KEY = 'gamemind_game_profiles_v1';

const DEFAULT_GAME_PROFILES: GameProfile[] = [
  {
    id: 'pubg-mobile',
    name: 'PUBG Mobile',
    packageName: 'com.tencent.ig',
    graphicsQuality: 'سلسة (Smooth)',
    targetFps: '60 FPS',
    sensitivitySummary: 'كاميرا 105% · ADS 95% · جيرو 220% (Red Dot)',
    notes: 'إغلاق الظلال ومضاد التعرج يحافظ على ثبات الفريمات وقت الفايت.',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cod-mobile',
    name: 'Call of Duty Mobile',
    packageName: 'com.activision.callofduty.shooter',
    graphicsQuality: 'منخفضة / متوسطة',
    targetFps: '60 FPS (عالي جداً)',
    sensitivitySummary: 'سريع مع ثبات عالي بالسكوبات البعيدة',
    notes: 'عطّل Depth of Field وBloom لوضوح أكبر وتقليل الحرارة.',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'free-fire',
    name: 'Free Fire',
    packageName: 'com.dts.freefireth',
    graphicsQuality: 'قياسي (Standard)',
    targetFps: 'High FPS',
    sensitivitySummary: 'عام 95% · Red Dot 88%',
    notes: 'تعمل بثبات حتى على الأجهزة المتوسطة مع تفعيل High FPS.',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'fortnite',
    name: 'Fortnite',
    packageName: 'com.epicgames.fortnite',
    graphicsQuality: 'منخفضة + دقة 75%',
    targetFps: '60 FPS',
    sensitivitySummary: 'متوازن للبناء والتصويب',
    notes: 'لعبة ثقيلة حرارياً — يُنصح بفك غطاء الجوال قبل اللعب.',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'genshin-impact',
    name: 'Genshin Impact',
    packageName: 'com.miHoYo.GenshinImpact',
    graphicsQuality: 'منخفضة / متوسطة',
    targetFps: '45–60 FPS',
    sensitivitySummary: 'كاميرا قياسية مريحة للاستكشاف',
    notes: 'قلل Render Resolution إلى Low/Medium لتجنب الاختناق الحراري.',
    updatedAt: new Date().toISOString(),
  },
];

export function loadGameProfiles(): GameProfile[] {
  try {
    const raw = window.localStorage.getItem(PROFILES_KEY);
    if (!raw) return DEFAULT_GAME_PROFILES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as GameProfile[]) : DEFAULT_GAME_PROFILES;
  } catch {
    return DEFAULT_GAME_PROFILES;
  }
}

export function saveGameProfile(profile: GameProfile): GameProfile[] {
  const current = loadGameProfiles();
  const exists = current.some((p) => p.id === profile.id);
  const next = exists
    ? current.map((p) => (p.id === profile.id ? profile : p))
    : [profile, ...current];
  try {
    window.localStorage.setItem(PROFILES_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage error
  }
  return next;
}

export function deleteGameProfile(id: string): GameProfile[] {
  const next = loadGameProfiles().filter((p) => p.id !== id);
  try {
    window.localStorage.setItem(PROFILES_KEY, JSON.stringify(next));
  } catch {
    // Ignore
  }
  return next;
}
