/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 1. إخفاء تقنية التشغيل (يمنع المتطفلين من معرفة أنك تستخدم Next.js)
  poweredByHeader: false, 

  async headers() {
    return [
      {
        // تطبيق القواعد على جميع الروابط
        source: '/:path*',
        headers: [
          {
            // منع عرض موقعك داخل إطار في مواقع أخرى (حماية من Clickjacking)
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            // منع المتصفح من تخمين نوع الملفات (حماية من XSS)
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            // إجبار المتصفح على استخدام HTTPS دائماً لمدة سنتين (HSTS)
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            // حماية بيانات المستخدم عند الانتقال لروابط خارجية
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            // إغلاق الكاميرا والميكروفون والموقع الجغرافي تماماً
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()'
          },
          {
            // 🔥 الجدار الناري للمتصفح (CSP) - نسخة صارمة جداً
            key: 'Content-Security-Policy',
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-eval' 'unsafe-inline';
              style-src 'self' 'unsafe-inline';
              img-src 'self' blob: data: https://*.supabase.co https://*.ytimg.com;
              font-src 'self' data:;
              connect-src 'self' https://*.supabase.co;
              frame-ancestors 'self';
            `.replace(/\s{2,}/g, ' ').trim() 
            // ملاحظة: سمحنا فقط بـ (Supabase) و (YouTube Thumbnails) بناءً على تحليلي للكود الخاص بك
          }
        ],
      },
    ];
  },
};

module.exports = nextConfig;
