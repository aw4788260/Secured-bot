import FingerprintJS from '@fingerprintjs/fingerprintjs';

export const getDeviceFingerprint = async () => {
    // 1. إذا كنا داخل تطبيق الأندرويد، نستخدم الـ Interface الخاص به
    if (typeof window !== 'undefined' && window.Android && window.Android.getDeviceId) {
        return window.Android.getDeviceId();
    }

    // 2. للمتصفح: هل البصمة محفوظة؟
    const storedFp = typeof window !== 'undefined' ? localStorage.getItem('auth_device_id') : null;
    if (storedFp) return storedFp;

    // 3. توليد بصمة جديدة وحفظها
    try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        const visitorId = result.visitorId;
        if (typeof window !== 'undefined') localStorage.setItem('auth_device_id', visitorId);
        return visitorId;
    } catch (error) {
        // Fallback
        const fallback = 'web_' + Math.random().toString(36).substring(7);
        if (typeof window !== 'undefined') localStorage.setItem('auth_device_id', fallback);
        return fallback;
    }
};
