import type {GameSessionRecord} from '../types/gamemind';

const SESSIONS_KEY = 'gamemind_sessions_v2';
const THERMAL_THRESHOLD_KEY = 'gamemind_thermal_threshold_c';

export function loadSavedSessions(): GameSessionRecord[] {
  try {
    const raw = window.localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GameSessionRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveSessionRecord(record: GameSessionRecord): GameSessionRecord[] {
  const existing = loadSavedSessions();
  const updated = [record, ...existing].slice(0, 50);
  try {
    window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }
  return updated;
}

export function deleteSessionRecord(id: string): GameSessionRecord[] {
  const updated = loadSavedSessions().filter((item) => item.id !== id);
  try {
    window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore
  }
  return updated;
}

export function getThermalAlertThreshold(): number {
  try {
    const raw = window.localStorage.getItem(THERMAL_THRESHOLD_KEY);
    const val = raw ? Number(raw) : 41;
    return Number.isFinite(val) && val >= 37 && val <= 46 ? val : 41;
  } catch {
    return 41;
  }
}

export function setThermalAlertThreshold(tempC: number): number {
  const clamped = Math.min(46, Math.max(37, Math.round(tempC)));
  try {
    window.localStorage.setItem(THERMAL_THRESHOLD_KEY, String(clamped));
  } catch {
    // Ignore
  }
  return clamped;
}
