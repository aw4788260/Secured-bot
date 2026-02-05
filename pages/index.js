// pages/index.js
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link'; // ✅ استيراد مكون الرابط

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // توجيه الزائر مباشرة للوحة تحكم الأدمن
    router.replace('/admin/login');
  }, []);

  // ✅ التعديل: إرجاع واجهة بسيطة تحتوي على رابط سياسة الخصوصية بدلاً من null
  // هذا يضمن أن الرابط موجود في "DOM" الصفحة الرئيسية للامتثال لقوانين GDPR
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      fontFamily: 'sans-serif'
    }}>
      <p>جاري التوجيه...</p>
      
      <Link href="/privacy-policy" style={{ marginTop: '20px', fontSize: '14px', color: '#555', textDecoration: 'underline' }}>
        سياسة الخصوصية (Privacy Policy)
      </Link>
    </div>
  );
}
