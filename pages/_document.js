// pages/_document.js
import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="ar" dir="rtl">
      <Head>
        {/* هذا السكريبت ضروري لعمل الـ WebApp */}
        <script src="http://googleusercontent.com/telegram.org/js/telegram-web-app.js" defer></script>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
