import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function AdminDashboard() {
  const router = useRouter();
  const { userId } = router.query; // (للعرض فقط إن وجد، لكن الاعتماد الأساسي على التخزين)
  
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [courses, setCourses] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState('');
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('');

  // 1. التحقق من الصلاحيات وجلب البيانات (Secure Headers)
  useEffect(() => {
    if (!router.isReady) return;

    // أ) جلب مفاتيح الدخول من الذاكرة
    const uid = localStorage.getItem('auth_user_id');
    const did = localStorage.getItem('auth_device_id');

    if (!uid || !did) {
        setStatus("⛔ غير مسجل دخول. يرجى الدخول أولاً.");
        return;
    }

    // ب) التحقق من الأدمن (مع إرسال الهيدرز)
    fetch(`/api/auth/check-admin`, {
        headers: { 'x-user-id': uid, 'x-device-id': did }
    })
      .then(res => {
          if (res.status === 403) throw new Error("⛔ جهاز غير مصرح به.");
          return res.json();
      })
      .then(data => {
        if (data.isAdmin) {
          setIsAuthorized(true);
          // ج) جلب الكورسات (مع الهيدرز أيضاً)
          return fetch(`/api/data/get-structured-courses`, {
              headers: { 'x-user-id': uid, 'x-device-id': did }
          });
        } else {
            throw new Error('⛔ حسابك ليس بصلاحيات أدمن.');
        }
      })
      .then(res => res.json())
      .then(data => { 
          if(Array.isArray(data)) setCourses(data); 
      })
      .catch(err => setStatus(err.message))
      .finally(() => setLoading(false));
  }, [router.isReady]);

  // 2. دالة رفع الملف (Secure Upload)
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !selectedChapter) return;
    
    setStatus('جاري الرفع... ⏳');
    
    const uid = localStorage.getItem('auth_user_id');
    const did = localStorage.getItem('auth_device_id');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title || file.name);
    formData.append('chapterId', selectedChapter);

    try {
        const res = await fetch(`/api/admin/upload-file`, { 
            method: 'POST', 
            // ملاحظة: لا نضع Content-Type يدوياً مع FormData، المتصفح يضعه تلقائياً
            headers: {
                'x-user-id': uid,
                'x-device-id': did
            },
            body: formData 
        });

        if (res.ok) {
            setStatus('✅ تم الرفع بنجاح!');
            setFile(null); setTitle(''); e.target.reset();
        } else {
            const d = await res.json(); 
            setStatus('❌ فشل الرفع: ' + (d.error || d.message));
        }
    } catch (err) {
        setStatus('❌ خطأ في الاتصال: ' + err.message);
    }
  };

  if (loading) return <div className="app-container" style={{justifyContent:'center'}}>جاري التحقق من الصلاحيات...</div>;
  
  if (!isAuthorized) return (
      <div className="app-container" style={{justifyContent:'center'}}>
          <h2 style={{color:'red', textAlign:'center'}}>{status}</h2>
          <button className="back-button" onClick={() => router.push('/app')}>عودة</button>
      </div>
  );

  return (
    <div className="app-container">
      <Head><title>لوحة الأدمن - رفع الملفات</title></Head>
      
      <button className="back-button" onClick={() => router.back()}>&larr; خروج</button>
      
      <h1>رفع ملف PDF</h1>
      
      <form onSubmit={handleUpload} style={{background:'#1e293b', padding:'20px', borderRadius:'10px', border:'1px solid #334155'}}>
        
        <div style={{marginBottom:'15px'}}>
            <label style={{color:'#38bdf8', display:'block', marginBottom:'5px'}}>اختر الشابتر:</label>
            <select 
                onChange={e => setSelectedChapter(e.target.value)} 
                style={{width:'100%', padding:'10px', background:'#0f172a', color:'white', border:'1px solid #475569', borderRadius:'5px'}}
                required
            >
                <option value="">-- اختر --</option>
                {courses.map(c => (
                    <optgroup key={c.id} label={c.title}>
                        {c.chapters.map(ch => <option key={ch.id} value={ch.id}>{ch.title}</option>)}
                    </optgroup>
                ))}
            </select>
        </div>

        <div style={{marginBottom:'15px'}}>
            <label style={{color:'#38bdf8', display:'block', marginBottom:'5px'}}>اسم الملف (اختياري):</label>
            <input 
                type="text" 
                onChange={e => setTitle(e.target.value)} 
                style={{width:'100%', padding:'10px', background:'#0f172a', color:'white', border:'1px solid #475569', borderRadius:'5px'}} 
            />
        </div>

        <div style={{marginBottom:'20px'}}>
            <input 
                type="file" 
                accept="application/pdf" 
                onChange={e => setFile(e.target.files[0])} 
                required
                style={{color:'white'}}
            />
        </div>

        <button type="submit" className="button-link" style={{justifyContent:'center', background:'#38bdf8', color:'black', fontWeight:'bold'}}>
            🚀 بدء الرفع
        </button>
        
        {status && <p style={{textAlign:'center', marginTop:'15px', color: status.startsWith('✅') ? '#4ade80' : '#ef4444'}}>{status}</p>}
      </form>
    </div>
  );
}
