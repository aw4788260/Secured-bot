import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="ar" dir="rtl">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
        {/* تم إزالة سكريبت تليجرام لتحسين الأمان */}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
