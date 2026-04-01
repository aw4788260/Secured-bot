import TeacherLayout from '../../../components/TeacherLayout';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function AdvancedCopyPage() {
  const router = useRouter();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [treeLoading, setTreeLoading] = useState(false);
  const [copying, setCopying] = useState(false);

  const [sourceCourseId, setSourceCourseId] = useState('');
  const [targetCourseId, setTargetCourseId] = useState('');
  
  // شجرة المحتوى للكورس المصدري
  const [sourceTree, setSourceTree] = useState([]);
  
  // العناصر المحددة للنسخ
  const [selected, setSelected] = useState({
    subjects: [], chapters: [], videos: [], pdfs: [], exams: []
  });

  const [toast, setToast] = useState({ show: false, msg: '', type: '' });

  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: '' }), 4000);
  };

  // جلب قائمة الكورسات
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await fetch('/api/dashboard/teacher/content');
        const data = await res.json();
        if (res.ok) setCourses(data.courses || []);
      } catch (err) {
        showToast('خطأ في جلب الكورسات', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, []);

  // جلب شجرة المحتوى عند اختيار كورس مصدري
  useEffect(() => {
    if (!sourceCourseId) {
        setSourceTree([]);
        setSelected({ subjects: [], chapters: [], videos: [], pdfs: [], exams: [] });
        return;
    }

    const fetchTree = async () => {
      setTreeLoading(true);
      try {
        const res = await fetch(`/api/dashboard/teacher/advanced-copy?courseId=${sourceCourseId}`);
        const data = await res.json();
        if (res.ok) {
            setSourceTree(data.subjects || []);
            // تحديد الكل افتراضياً
            selectAll(data.subjects);
        }
      } catch (err) {
        showToast('خطأ في جلب تفاصيل الكورس', 'error');
      } finally {
        setTreeLoading(false);
      }
    };
    fetchTree();
  }, [sourceCourseId]);

  // دالة لتحديد كل شيء
  const selectAll = (subjects) => {
    const newSelected = { subjects: [], chapters: [], videos: [], pdfs: [], exams: [] };
    subjects.forEach(sub => {
      newSelected.subjects.push(sub.id);
      sub.exams?.forEach(ex => newSelected.exams.push(ex.id));
      sub.chapters?.forEach(ch => {
        newSelected.chapters.push(ch.id);
        ch.videos?.forEach(v => newSelected.videos.push(v.id));
        ch.pdfs?.forEach(p => newSelected.pdfs.push(p.id));
      });
    });
    setSelected(newSelected);
  };

  // دالة للتعامل مع التحديد (Smart Selection)
  const toggleSelection = (type, id, parentIds = {}) => {
    setSelected(prev => {
      const isSelected = prev[type].includes(id);
      const newState = { ...prev, [type]: isSelected ? prev[type].filter(x => x !== id) : [...prev[type], id] };

      // إذا قمنا بتحديد عنصر فرعي، يجب تحديد آبائه تلقائياً
      if (!isSelected) {
        if (parentIds.subjectId && !newState.subjects.includes(parentIds.subjectId)) newState.subjects.push(parentIds.subjectId);
        if (parentIds.chapterId && !newState.chapters.includes(parentIds.chapterId)) newState.chapters.push(parentIds.chapterId);
      }

      return newState;
    });
  };

  // تنفيذ النسخ
  const executeCopy = async () => {
    if (!sourceCourseId || !targetCourseId) return showToast('يرجى اختيار الكورس المصدري والهدف', 'error');
    if (sourceCourseId === targetCourseId) return showToast('لا يمكن النسخ لنفس الكورس', 'error');
    if (selected.subjects.length === 0) return showToast('يرجى تحديد مادة واحدة على الأقل للنسخ', 'error');

    setCopying(true);
    try {
      const res = await fetch('/api/dashboard/teacher/advanced-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceCourseId, targetCourseId, selected })
      });
      const data = await res.json();
      
      if (res.ok) {
        showToast('تم نسخ المحتوى بنجاح! 🎉', 'success');
        setTimeout(() => router.push('/admin/teacher/content'), 2000);
      } else {
        showToast(data.error || 'حدث خطأ أثناء النسخ', 'error');
      }
    } catch (err) {
      showToast('خطأ في الاتصال بالخادم', 'error');
    } finally {
      setCopying(false);
    }
  };

  return (
    <TeacherLayout title="المميزات المتقدمة (النسخ)">
      <div className={`toast ${toast.show ? 'show' : ''} ${toast.type}`}>{toast.msg}</div>

      <div className="header-bar">
          <div>
              <h1 style={{margin:0, color:'#a855f7'}}>🚀 النسخ الذكي للمحتوى</h1>
              <p style={{color:'#94a3b8', marginTop:'5px'}}>نسخ المواد، الفصول، الفيديوهات، أو الامتحانات من كورس لآخر بسهولة.</p>
          </div>
          <button className="btn-back" onClick={() => router.push('/admin/teacher/content')}>رجوع ⬅️</button>
      </div>

      {loading ? <div className="loader">جاري التحميل...</div> : (
        <div className="copy-grid">
            
            {/* إعدادات النسخ (يمين) */}
            <div className="settings-panel">
                <div className="form-group">
                    <label>📦 الكورس المصدري (المراد النسخ منه)</label>
                    <select className="select-input" value={sourceCourseId} onChange={e => setSourceCourseId(e.target.value)}>
                        <option value="">-- اختر الكورس المصدري --</option>
                        {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                </div>

                <div className="arrow-down">⬇️ يتم النسخ إلى ⬇️</div>

                <div className="form-group">
                    <label>🎯 الكورس الهدف (المراد النسخ إليه)</label>
                    <select className="select-input target" value={targetCourseId} onChange={e => setTargetCourseId(e.target.value)}>
                        <option value="">-- اختر الكورس الهدف --</option>
                        {courses.filter(c => String(c.id) !== sourceCourseId).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                </div>

                <div className="summary-box">
                    <h4>ملخص التحديد:</h4>
                    <ul>
                        <li>📚 مواد: {selected.subjects.length}</li>
                        <li>📂 فصول: {selected.chapters.length}</li>
                        <li>🎬 فيديوهات: {selected.videos.length}</li>
                        <li>📄 ملفات: {selected.pdfs.length}</li>
                        <li>📝 امتحانات: {selected.exams.length}</li>
                    </ul>
                </div>

                <button className="btn-execute" onClick={executeCopy} disabled={copying || !sourceCourseId || !targetCourseId}>
                    {copying ? 'جاري النسخ... ⏳' : 'تنفيذ النسخ الآن 🚀'}
                </button>
            </div>

            {/* شجرة المحتوى (يسار) */}
            <div className="tree-panel">
                <h3 className="tree-title">📌 حدد المحتوى المراد نسخه</h3>
                {treeLoading ? <div className="loader">جاري جلب المحتوى...</div> : sourceTree.length === 0 ? (
                    <div className="empty-tree">يرجى اختيار الكورس المصدري أولاً.</div>
                ) : (
                    <div className="tree-container">
                        {sourceTree.map(sub => (
                            <div key={sub.id} className="tree-subject">
                                <label className="tree-label subject">
                                    <input type="checkbox" checked={selected.subjects.includes(sub.id)} onChange={() => toggleSelection('subjects', sub.id)} />
                                    <span>📚 {sub.title}</span>
                                </label>

                                {/* الفصول */}
                                <div className="tree-children">
                                    {sub.chapters?.map(ch => (
                                        <div key={ch.id} className="tree-chapter">
                                            <label className="tree-label chapter">
                                                <input type="checkbox" checked={selected.chapters.includes(ch.id)} onChange={() => toggleSelection('chapters', ch.id, { subjectId: sub.id })} />
                                                <span>📂 {ch.title}</span>
                                            </label>
                                            
                                            <div className="tree-items">
                                                {ch.videos?.map(v => (
                                                    <label key={v.id} className="tree-label item">
                                                        <input type="checkbox" checked={selected.videos.includes(v.id)} onChange={() => toggleSelection('videos', v.id, { subjectId: sub.id, chapterId: ch.id })} />
                                                        <span>🎬 {v.title}</span>
                                                    </label>
                                                ))}
                                                {ch.pdfs?.map(p => (
                                                    <label key={p.id} className="tree-label item">
                                                        <input type="checkbox" checked={selected.pdfs.includes(p.id)} onChange={() => toggleSelection('pdfs', p.id, { subjectId: sub.id, chapterId: ch.id })} />
                                                        <span>📄 {p.title}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    
                                    {/* الامتحانات التابعة للمادة */}
                                    {sub.exams?.map(ex => (
                                        <label key={ex.id} className="tree-label exam">
                                            <input type="checkbox" checked={selected.exams.includes(ex.id)} onChange={() => toggleSelection('exams', ex.id, { subjectId: sub.id })} />
                                            <span>📝 امتحان: {ex.title}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      )}

      <style jsx>{`
        .header-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 15px; margin-bottom: 25px; }
        .btn-back { background: #334155; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; }
        
        .copy-grid { display: grid; grid-template-columns: 1fr 2fr; gap: 25px; align-items: start; }
        @media(max-width: 768px) { .copy-grid { grid-template-columns: 1fr; } }
        
        .settings-panel, .tree-panel { background: #1e293b; padding: 25px; border-radius: 12px; border: 1px solid #334155; }
        
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; color: #cbd5e1; margin-bottom: 10px; font-weight: bold; font-size: 1.1em; }
        .select-input { width: 100%; padding: 15px; background: #0f172a; border: 2px solid #334155; border-radius: 8px; color: white; font-size: 1em; outline: none; }
        .select-input:focus { border-color: #a855f7; }
        .select-input.target:focus { border-color: #22c55e; }

        .arrow-down { text-align: center; color: #64748b; font-weight: bold; margin: 20px 0; }
        
        .summary-box { background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.3); padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .summary-box h4 { margin: 0 0 10px 0; color: #d8b4fe; }
        .summary-box ul { list-style: none; padding: 0; margin: 0; color: #e2e8f0; display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }

        .btn-execute { width: 100%; padding: 15px; background: linear-gradient(135deg, #a855f7, #7e22ce); color: white; border: none; border-radius: 8px; font-size: 1.1em; font-weight: bold; cursor: pointer; transition: 0.3s; }
        .btn-execute:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-execute:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(168, 85, 247, 0.3); }

        .tree-title { margin-top: 0; color: white; border-bottom: 1px dashed #334155; padding-bottom: 10px; }
        .tree-container { max-height: 60vh; overflow-y: auto; padding-right: 10px; }
        .empty-tree { color: #64748b; text-align: center; padding: 40px 0; font-size: 1.1em; font-style: italic; }

        .tree-subject { background: #0f172a; border: 1px solid #334155; border-radius: 8px; margin-bottom: 15px; overflow: hidden; }
        .tree-label { display: flex; align-items: center; gap: 10px; padding: 12px; cursor: pointer; transition: 0.2s; user-select: none; }
        .tree-label:hover { background: rgba(255,255,255,0.02); }
        .tree-label input[type="checkbox"] { width: 18px; height: 18px; accent-color: #a855f7; cursor: pointer; }
        
        .tree-label.subject { background: rgba(168, 85, 247, 0.1); color: #d8b4fe; font-weight: bold; font-size: 1.1em; border-bottom: 1px solid #334155; }
        .tree-children { padding: 10px 15px; }
        
        .tree-chapter { margin-bottom: 10px; border-left: 2px solid #334155; padding-right: 10px; }
        .tree-label.chapter { color: #38bdf8; font-weight: bold; padding: 8px; }
        
        .tree-items { padding-right: 25px; border-right: 1px dashed #475569; margin-right: 15px; display: flex; flex-direction: column; gap: 5px; }
        .tree-label.item { color: #cbd5e1; padding: 6px; font-size: 0.95em; }
        .tree-label.exam { color: #facc15; padding: 8px 25px; font-weight: bold; }

        .loader { text-align: center; color: #a855f7; padding: 40px; font-size: 1.2em; }
        
        .toast { position: fixed; top: 20px; right: 20px; padding: 15px 25px; border-radius: 8px; color: white; font-weight: bold; transform: translateX(150%); transition: 0.3s; z-index: 9999; }
        .toast.show { transform: translateX(0); } .toast.success { background: #22c55e; } .toast.error { background: #ef4444; }
      `}</style>
    </TeacherLayout>
  );
}
