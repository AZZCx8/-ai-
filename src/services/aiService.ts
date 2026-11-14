import type {
  AiDiagnosisResponse,
  DeviceSnapshot,
  GameProfile,
  GameSessionRecord,
  PingMeasurement,
  ProGraphicsConfig,
  SensitivityCoachResult,
  SessionAiAnalysis,
} from '../types/gamemind';
import {API_BASE} from './apiBase';

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 35000);

  try {
    const response = await fetch(`${API_BASE}${url}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data = (await response.json().catch(() => ({}))) as {error?: string} & T;
    if (!response.ok) {
      throw new Error(data.error || `تعذر إتمام الطلب (رمز الخطأ ${response.status}).`);
    }
    return data;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('انتهت مهلة الاتصال بالخادم، تأكد من سرعة الإنترنت وجرب مرة ثانية.');
    }
    if (err instanceof TypeError) {
      throw new Error('ما قدرنا نوصل للخادم، تأكد من اتصالك بالإنترنت.');
    }
    throw err;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function requestAiDiagnosis(payload: {
  game: string;
  problem: string;
  deviceSnapshot: DeviceSnapshot | null;
  ping: PingMeasurement | null;
}): Promise<AiDiagnosisResponse> {
  return postJson<AiDiagnosisResponse>('/api/ai/diagnose', payload);
}

export function requestProGraphicsConfig(payload: {
  game: string;
  priority: string;
  deviceSnapshot: DeviceSnapshot | null;
}): Promise<ProGraphicsConfig> {
  return postJson<ProGraphicsConfig>('/api/ai/graphics-config', payload);
}

export function requestSensitivityCoach(payload: {
  game: string;
  playstyle: string;
  gyroMode: string;
  aimIssue: string;
  deviceSnapshot: DeviceSnapshot | null;
}): Promise<SensitivityCoachResult> {
  return postJson<SensitivityCoachResult>('/api/ai/sensitivity-coach', payload);
}

export function requestSessionAnalysis(payload: {
  session: GameSessionRecord;
  profile: GameProfile | null;
  deviceSnapshot: DeviceSnapshot | null;
}): Promise<SessionAiAnalysis> {
  return postJson<SessionAiAnalysis>('/api/ai/analyze-session', payload);
}
