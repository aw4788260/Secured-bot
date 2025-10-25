// pages/_document.js
import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="ar" dir="rtl">
      <Head>
        {/* تمت إزالة 'defer' من السطر التالي 
          لضمان تحميل هذا السكريبت أولاً قبل أي كود آخر في الصفحة.
        */}
        <script src="http://googleusercontent.com/telegram.org/js/telegram-web-app.js"></script>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
