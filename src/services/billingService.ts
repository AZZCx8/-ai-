import {setCentralProStatus} from '../state/subscriptionStore';

export interface BillingActionResult {
  success: boolean;
  isPro: boolean;
  message: string;
}

export interface BillingServiceAdapter {
  purchasePro(): Promise<BillingActionResult>;
  restorePurchases(): Promise<BillingActionResult>;
  deactivatePreviewPro(): Promise<BillingActionResult>;
}

const ENTITLEMENT_RECEIPT_KEY = 'gamemind_billing_receipt_v1';

/**
 * TODO: Google Play Billing Integration
 * عند تجهيز النشر على Google Play:
 * 1. ثبّت حزمة فوترة متوافقة مع Capacitor (مثل @capgo/capacitor-purchases أو Google Play BillingClient plugin).
 * 2. استبدل هذا الكلاس بتطبيق ينفذ BillingServiceAdapter ويتواصل مع Product ID: "gamemind_pro_monthly" (10 ريال/شهر).
 * 3. استدعِ التحقق من الإيصال (Receipt Validation) في server.ts قبل تفعيل setCentralProStatus(true).
 */
class ReplaceableGooglePlayBillingStub implements BillingServiceAdapter {
  async purchasePro(): Promise<BillingActionResult> {
    // Simulate async native billing sheet latency cleanly
    await new Promise((resolve) => window.setTimeout(resolve, 650));

    try {
      window.localStorage.setItem(
        ENTITLEMENT_RECEIPT_KEY,
        JSON.stringify({
          productId: 'gamemind_pro_monthly',
          purchasedAt: new Date().toISOString(),
          provider: 'preview-local-stub',
        }),
      );
      setCentralProStatus(true);
      return {
        success: true,
        isPro: true,
        message: 'تم تفعيل اشتراك GameMind Pro بنجاح! كل ميزات Pro مفتوحة لك الحين.',
      };
    } catch {
      return {
        success: false,
        isPro: false,
        message: 'تعذر حفظ حالة الاشتراك في المتصفح. تأكد إن التخزين المحلي مفعّل.',
      };
    }
  }

  async restorePurchases(): Promise<BillingActionResult> {
    await new Promise((resolve) => window.setTimeout(resolve, 550));

    try {
      const raw = window.localStorage.getItem(ENTITLEMENT_RECEIPT_KEY);
      if (!raw) {
        setCentralProStatus(false);
        return {
          success: true,
          isPro: false,
          message: 'ما لقينا اشتراك GameMind Pro سابق محفوظ على هذا الجهاز.',
        };
      }
      const receipt = JSON.parse(raw) as {productId?: string};
      if (receipt.productId === 'gamemind_pro_monthly') {
        setCentralProStatus(true);
        return {
          success: true,
          isPro: true,
          message: 'تمت استعادة اشتراك GameMind Pro بنجاح!',
        };
      }
      return {
        success: true,
        isPro: false,
        message: 'ما لقينا اشتراك فعّال للاستعادة.',
      };
    } catch {
      return {
        success: false,
        isPro: false,
        message: 'صار خطأ أثناء التحقق من المشتريات السابقة.',
      };
    }
  }

  async deactivatePreviewPro(): Promise<BillingActionResult> {
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    try {
      window.localStorage.removeItem(ENTITLEMENT_RECEIPT_KEY);
    } catch {
      // Ignore
    }
    setCentralProStatus(false);
    return {
      success: true,
      isPro: false,
      message: 'تم إرجاع الحساب للوضع المجاني (للمعاينة والاختبار).',
    };
  }
}

export const billingService: BillingServiceAdapter = new ReplaceableGooglePlayBillingStub();
