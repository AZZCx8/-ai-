// عنوان الخادم. داخل الـ APK لازم يكون عنوان كامل مثل https://gamemind.onrender.com
// في المتصفح أو أثناء التطوير نخليه فاضي فتشتغل المسارات النسبية عادي.
const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? '';
export const API_BASE = raw.replace(/\/+$/, '');
