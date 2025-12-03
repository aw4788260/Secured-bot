import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function AdminDashboard() {
  const router = useRouter();
  const { userId, firstName } = router.query;
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [courses, setCourses] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState('');
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!router.isReady || !userId) return;
    fetch(`/api/auth/check-admin?userId=${userId}`)
      .then(res => res.json())
      .then(data => {
        if (data.isAdmin) {
          setIsAuthorized(true);
          return fetch(`/api/data/get-structured-courses?userId=${userId}`);
        } else throw new Error('غير مصرح');
      })
      .then(res => res.json())
      .then(data => { if(Array.isArray(data)) setCourses(data); })
      .catch(err => setStatus(err.message))
      .finally(() => setLoading(false));
  }, [router.isReady, userId]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !selectedChapter) return;
    setStatus('جاري الرفع... ⏳');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title || file.name);
    formData.append('chapterId', selectedChapter);

    const res = await fetch(`/api/admin/upload-file?userId=${userId}`, { method: 'POST', body: formData });
    if (res.ok) {
      setStatus('✅ تم الرفع!');
      setFile(null); setTitle(''); e.target.reset();
    } else {
      const d = await res.json(); setStatus('❌ ' + d.error);
    }
  };

  if (loading) return <div className="app-container">جاري التحقق...</div>;
  if (!isAuthorized) return <div className="app-container">{status}</div>;

  return (
    <div className="app-container">
      <Head><title>رفع الملفات</title></Head>
      <button className="back-button" onClick={() => router.back()}>&larr; خروج</button>
      <h1>رفع PDF</h1>
      <form onSubmit={handleUpload} style={{background:'#1e293b', padding:'20px', borderRadius:'10px'}}>
        <div style={{marginBottom:'15px'}}>
            <label style={{color:'#38bdf8'}}>اختر الشابتر:</label>
            <select onChange={e => setSelectedChapter(e.target.value)} style={{width:'100%', padding:'10px', background:'#0f172a', color:'white'}}>
                <option value="">-- اختر --</option>
                {courses.map(c => (
                    <optgroup key={c.id} label={c.title}>
                        {c.chapters.map(ch => <option key={ch.id} value={ch.id}>{ch.title}</option>)}
                    </optgroup>
                ))}
            </select>
        </div>
        <div style={{marginBottom:'15px'}}>
            <label style={{color:'#38bdf8'}}>اسم الملف:</label>
            <input type="text" onChange={e => setTitle(e.target.value)} style={{width:'100%', padding:'10px', background:'#0f172a', color:'white'}} />
        </div>
        <div style={{marginBottom:'20px'}}>
            <input type="file" accept="application/pdf" onChange={e => setFile(e.target.files[0])} />
        </div>
        <button type="submit" className="button-link" style={{justifyContent:'center', background:'#38bdf8', color:'black'}}>🚀 رفع</button>
        {status && <p style={{textAlign:'center'}}>{status}</p>}
      </form>
    </div>
  );
}
