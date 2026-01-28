// pages/index.js
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // توجيه الزائر مباشرة للوحة تحكم الأدمن
    router.replace('/admin/login');
  }, []);

  return null; // لا تعرض شيئاً
}
