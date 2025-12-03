import { NextResponse } from 'next/server';

export function middleware(request) {
  const path = request.nextUrl.pathname;

  // 1. استثناء المسارات التي لا تحتاج حماية (مثل الويب هوك والصور العامة)
  if (
    path.startsWith('/api/telegram-webhook') || 
    path.startsWith('/_next') || 
    path === '/favicon.ico' ||
    path === '/api/log-client' // لوج الأخطاء مسموح
  ) {
      return NextResponse.next();
  }

  // 2. حماية مسارات الـ API وملفات العرض
  if (path.startsWith('/api/') || path.startsWith('/watch/') || path.startsWith('/pdf-viewer/')) {
      
      const referer = request.headers.get('referer');
      const origin = request.headers.get('origin');
      
      // ✅ الدومين الخاص بك (الذي يعمل عليه الميني اب)
      const MY_DOMAIN = 'courses.aw478260.dpdns.org';
      
      // التحقق: هل الطلب قادم من موقعنا؟
      // (المتصفح يرسل Referer أو Origin تلقائياً ولا يمكن تزويره بسهولة في بيئة الويب)
      const isAllowedOrigin = 
        (origin && origin.includes(MY_DOMAIN)) || 
        (referer && referer.includes(MY_DOMAIN));

      if (isAllowedOrigin) {
          return NextResponse.next(); // ✅ مسموح: القادم من الموقع/تليجرام
      }

      // ⛔ رفض أي مصدر آخر (رابط مسروق، متصفح خارجي، Curl)
      console.log(`⛔ [Middleware] Blocked unauthorized source accessing: ${path}`);
      
      return new NextResponse(
        JSON.stringify({ message: 'Access Denied: Direct access is not allowed. Please open via the official App.' }),
        { status: 403, headers: { 'content-type': 'application/json' } }
      );
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/:path*',
};
