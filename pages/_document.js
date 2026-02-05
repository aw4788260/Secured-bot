import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="ar" dir="rtl">
      <Head>
        {/* تم إزالة سكريبت تليجرام لتحسين الأمان */}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
