import {useEffect, useState} from 'react';
import type {SubscriptionState} from '../types/gamemind';

/**
 * ============================================================================
 * المركز الموحد لحالة الاشتراك (isPro Central Source of Truth)
 * ============================================================================
 * الوضع الحالي: جميع ميزات GameMind Pro مفتوحة مجاناً للجميع (isPro = true دائماً).
 *
 * كيف نرجّع نظام الاشتراك والحد اليومي لاحقاً؟
 * 1. غيّر الثابت `UNLOCK_ALL_PRO_FOR_FREE` بالأسفل إلى `false`.
 * 2. فعّل قراءة حالة الشراء المحفوظة `stored.isPro` داخل `buildState()`.
 * 3. أضف رابط شاشة `subscription` في شريط التنقل بملف `src/App.tsx` واستعد `ProSubscriptionView`.
 * 4. اربط `src/services/billingService.ts` مع Google Play Billing.
 * ============================================================================
 */
export const UNLOCK_ALL_PRO_FOR_FREE = true;

const STORAGE_KEY = 'gamemind_subscription_v1';
export const FREE_DAILY_AI_LIMIT = 3;
export const PRO_PRICE_SAR = 10;

interface StoredSubscription {
  isPro: boolean;
  activatedAt: string | null;
  usedToday: number;
  quotaDate: string;
}

function getTodayDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function loadStored(): StoredSubscription {
  const today = getTodayDateKey();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {isPro: UNLOCK_ALL_PRO_FOR_FREE, activatedAt: null, usedToday: 0, quotaDate: today};
    }
    const parsed = JSON.parse(raw) as Partial<StoredSubscription>;
    const isSameDay = parsed.quotaDate === today;
    return {
      isPro: UNLOCK_ALL_PRO_FOR_FREE ? true : Boolean(parsed.isPro),
      activatedAt: typeof parsed.activatedAt === 'string' ? parsed.activatedAt : null,
      usedToday: isSameDay && typeof parsed.usedToday === 'number' ? Math.max(0, parsed.usedToday) : 0,
      quotaDate: today,
    };
  } catch {
    return {isPro: UNLOCK_ALL_PRO_FOR_FREE, activatedAt: null, usedToday: 0, quotaDate: today};
  }
}

function saveStored(data: StoredSubscription) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota issues
  }
}

function buildState(stored: StoredSubscription): SubscriptionState {
  // عند تفعيل الاشتراك المدفوع مستقبلاً: استبدل UNLOCK_ALL_PRO_FOR_FREE بـ stored.isPro فقط
  const effectiveIsPro = UNLOCK_ALL_PRO_FOR_FREE || stored.isPro;
  const remainingToday = effectiveIsPro
    ? Number.POSITIVE_INFINITY
    : Math.max(0, FREE_DAILY_AI_LIMIT - stored.usedToday);

  return {
    isPro: effectiveIsPro,
    planName: effectiveIsPro ? 'GameMind (مفتوح بالكامل)' : 'الحساب المجاني',
    priceLabel: `${PRO_PRICE_SAR} ريال / شهرياً`,
    activatedAt: stored.activatedAt,
    dailyLimit: FREE_DAILY_AI_LIMIT,
    usedToday: stored.usedToday,
    remainingToday,
    quotaDate: stored.quotaDate,
  };
}

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((cb) => cb());
}

export function getSubscriptionSnapshot(): SubscriptionState {
  const stored = loadStored();
  saveStored(stored);
  return buildState(stored);
}

export function canUseAiAssistant(): boolean {
  const snap = getSubscriptionSnapshot();
  return snap.isPro || snap.remainingToday > 0;
}

export function consumeAiAssistantAttempt(): SubscriptionState {
  const stored = loadStored();
  if (!UNLOCK_ALL_PRO_FOR_FREE && !stored.isPro) {
    stored.usedToday = Math.min(FREE_DAILY_AI_LIMIT, stored.usedToday + 1);
  }
  saveStored(stored);
  notifyListeners();
  return buildState(stored);
}

export function setCentralProStatus(isPro: boolean): SubscriptionState {
  const stored = loadStored();
  stored.isPro = UNLOCK_ALL_PRO_FOR_FREE ? true : isPro;
  stored.activatedAt = stored.isPro ? stored.activatedAt ?? new Date().toISOString() : null;
  saveStored(stored);
  notifyListeners();
  return buildState(stored);
}

export function useSubscription(): SubscriptionState {
  const [state, setState] = useState<SubscriptionState>(() => getSubscriptionSnapshot());

  useEffect(() => {
    const sync = () => setState(getSubscriptionSnapshot());
    listeners.add(sync);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        sync();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      listeners.delete(sync);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return state;
}
