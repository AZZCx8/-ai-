export const translations = {
  appName: 'GameMind',
  appTagline: 'مساعد الألعاب الذكي',
  nav: {
    dashboard: 'الرئيسية',
    network: 'الشبكة',
    games: 'الألعاب',
    assistant: 'المساعد',
    sessions: 'السجل',
  },
  platform: {
    webBannerTitle: 'تشتغل حالياً من المتصفح',
    webBannerDesc:
      'نعرض لك البيانات الحقيقية المسموح بها في المتصفح (البنق، DNS، الشبكة، وحالة البطارية إن توفرت). الميزات العميقة مثل فتح الألعاب تلقائياً، عدم الإزعاج، حرارة البطارية °C، وأحجام الألعاب المثبتة تتطلب نسخة تطبيق Android.',
    androidBadge: 'Android أصلي · قراءات مباشرة',
    webBadge: 'وضع المتصفح · بيانات حقيقية متاحة فقط',
  },
  dashboard: {
    startSessionBig: 'ابدأ جلسة لعب',
    refreshBtn: 'تحديث القراءة',
    refreshing: 'جاري الفحص...',
    pingBtn: 'فحص البنق',
    pinging: 'يقيس...',
    tempGauge: 'الحرارة',
    ramGauge: 'الرام',
    batteryGauge: 'البطارية',
    pingGauge: 'البنق',
    thermalTitle: 'كاشف الاختناق الحراري',
  },
  network: {
    title: 'فاحص الشبكة وDNS المتقدم',
    subtitle: 'قياس حقيقي للبنق والتذبذب وفقدان الحزم مع مقارنة سرعة خوادم DNS من شبكتك',
    testPingBtn: 'فحص البنق والـ Jitter وفقدان الحزم',
    testDnsBtn: 'مقارنة سرعة خوادم DNS',
  },
  games: {
    title: 'ملفات الألعاب ومدير المساحة',
    subtitle: 'احفظ إعدادات كل لعبة وتابع مساحة جهازك والألعاب المثبتة',
    openStorageBtn: 'فتح إعدادات التخزين في الجوال',
    scanGamesBtn: 'فحص الألعاب المثبتة',
  },
  assistant: {
    title: 'المساعد الذكي للألعاب',
    subtitle: 'تشخيص التقطيع، توليد إعدادات الرسومات، ومدرب الحساسية — مفتوح مجاناً بالكامل',
  },
  sessions: {
    title: 'وضع الجلسة الذكي والسجل',
    subtitle: 'تسجيل تلقائي للحرارة والبطارية كل 10 ثواني مع تقارير ورسوم بيانية حقيقية',
  },
} as const;
