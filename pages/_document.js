// pages/_document.js
import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="ar" dir="rtl">
      <Head>
        {/* تم تغيير الرابط إلى الرابط الرسمي والمباشر من تليجرام.
          هذا هو الحل المضمون لمشكلة عدم تحميل السكريبت.
        */}
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
