import TeacherLayout from '../../../components/TeacherLayout';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

// --- أيقونات SVG احترافية ---
const Icons = {
    back: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>,
    copy: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>,
    source: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>,
    target: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>,
    subject: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>,
    chapter: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>,
    video: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>,
    pdf: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
    exam: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M9 15l2 2 4-4"></path></svg>,
    arrowDown: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>,
    check: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
};

export default function AdvancedCopyPage() {
  const router = useRouter();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [treeLoading, setTreeLoading] = useState(false);
  const [copying, setCopying] = useState(false);

  const [sourceCourseId, setSourceCourseId] = useState('');
  const [targetCourseId, setTargetCourseId] = useState('');
  
  const [sourceTree, setSourceTree] = useState([]);
  const [selected, setSelected] = useState({ subjects: [], chapters: [], videos: [], pdfs: [], exams: [] });

  const [toast, setToast] = useState({ show: false, msg: '', type: '' });

  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: '' }), 4000);
  };

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

  const toggleSelection = (type, id, parentIds = {}) => {
    setSelected(prev => {
      const isSelected = prev[type].includes(id);
      const newState = { ...prev, [type]: isSelected ? prev[type].filter(x => x !== id) : [...prev[type], id] };

      if (!isSelected) {
        if (parentIds.subjectId && !newState.subjects.includes(parentIds.subjectId)) newState.subjects.push(parentIds.subjectId);
        if (parentIds.chapterId && !newState.chapters.includes(parentIds.chapterId)) newState.chapters.push(parentIds.chapterId);
      }
      return newState;
    });
  };

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
        showToast('تم نسخ المحتوى بنجاح! سيتم تحويلك...', 'success');
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
    <TeacherLayout title="النسخ المتقدم">
      <div className={`toast ${toast.show ? 'show' : ''} ${toast.type}`}>
          <div className="toast-icon">{toast.type === 'success' ? Icons.check : '!'}</div>
          {toast.msg}
      </div>

      <div className="header-bar">
          <div className="title-area">
              <div className="icon-wrapper purple">{Icons.copy}</div>
              <div>
                  <h1>النسخ الذكي للمحتوى</h1>
                  <p>أداة احترافية لنسخ المواد والفصول والاختبارات بين الكورسات</p>
              </div>
          </div>
          <button className="btn-back" onClick={() => router.push('/admin/teacher/content')}>
              {Icons.back} رجوع للمحتوى
          </button>
      </div>

      {loading ? (
          <div className="loading-state">
              <div className="spinner"></div>
              <p>جاري تهيئة الأداة...</p>
          </div>
      ) : (
        <div className="copy-layout">
            
            {/* العمود الأيمن: إعدادات النسخ (Steps) */}
            <div className="config-column">
                
                {/* الخطوة الأولى */}
                <div className="step-card">
                    <div className="step-header">
                        <div className="step-num">1</div>
                        <h3>تحديد المصدر</h3>
                    </div>
                    <div className="step-body">
                        <label className="input-label">
                            <span className="label-icon blue">{Icons.source}</span> الكورس المراد النسخ منه:
                        </label>
                        <select className="custom-select" value={sourceCourseId} onChange={e => setSourceCourseId(e.target.value)}>
                            <option value="">-- اختر الكورس المصدري --</option>
                            {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flow-arrow">{Icons.arrowDown}</div>

                {/* الخطوة الثانية */}
                <div className="step-card">
                    <div className="step-header">
                        <div className="step-num">2</div>
                        <h3>تحديد الهدف</h3>
                    </div>
                    <div className="step-body">
                        <label className="input-label">
                            <span className="label-icon green">{Icons.target}</span> الكورس المراد النسخ إليه:
                        </label>
                        <select className="custom-select target-select" value={targetCourseId} onChange={e => setTargetCourseId(e.target.value)}>
                            <option value="">-- اختر الكورس الهدف --</option>
                            {courses.filter(c => String(c.id) !== sourceCourseId).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                        </select>
                    </div>
                </div>

                {/* الخطوة الثالثة: الملخص والتنفيذ */}
                <div className="step-card highlight">
                    <div className="step-header">
                        <div className="step-num highlight-num">3</div>
                        <h3>المراجعة والتنفيذ</h3>
                    </div>
                    <div className="step-body">
                        <div className="summary-grid">
                            <div className="summary-item">
                                <span className="s-icon">{Icons.subject}</span>
                                <div className="s-details"><span className="s-val">{selected.subjects.length}</span><span className="s-lbl">مواد</span></div>
                            </div>
                            <div className="summary-item">
                                <span className="s-icon">{Icons.chapter}</span>
                                <div className="s-details"><span className="s-val">{selected.chapters.length}</span><span className="s-lbl">فصول</span></div>
                            </div>
                            <div className="summary-item">
                                <span className="s-icon">{Icons.video}</span>
                                <div className="s-details"><span className="s-val">{selected.videos.length}</span><span className="s-lbl">فيديو</span></div>
                            </div>
                            <div className="summary-item">
                                <span className="s-icon">{Icons.exam}</span>
                                <div className="s-details"><span className="s-val">{selected.exams.length}</span><span className="s-lbl">امتحان</span></div>
                            </div>
                        </div>

                        <button className="btn-execute" onClick={executeCopy} disabled={copying || !sourceCourseId || !targetCourseId || selected.subjects.length === 0}>
                            {copying ? (
                                <><span className="spinner-small"></span> جاري معالجة ونسخ البيانات...</>
                            ) : (
                                <>{Icons.copy} تأكيد وبدء النسخ</>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* العمود الأيسر: شجرة المحتوى */}
            <div className="tree-column">
                <div className="tree-header">
                    <h3>شجرة المحتوى القابلة للنسخ</h3>
                    <span className="badge">حدد العناصر المطلوبة</span>
                </div>
                
                <div className="tree-content custom-scroll">
                    {treeLoading ? (
                        <div className="loading-state">
                            <div className="spinner"></div>
                            <p>جاري تحليل هيكل الكورس...</p>
                        </div>
                    ) : sourceTree.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">{Icons.source}</div>
                            <p>يرجى اختيار الكورس المصدري من القائمة اليمنى لرؤية محتوياته هنا.</p>
                        </div>
                    ) : (
                        <div className="tree-wrapper">
                            {sourceTree.map(sub => (
                                <div key={sub.id} className="tree-node subject-node">
                                    <label className="checkbox-wrapper">
                                        <input type="checkbox" checked={selected.subjects.includes(sub.id)} onChange={() => toggleSelection('subjects', sub.id)} />
                                        <span className="checkmark"></span>
                                        <div className="node-content">
                                            <span className="node-icon purple-text">{Icons.subject}</span>
                                            <span className="node-title">{sub.title}</span>
                                        </div>
                                    </label>

                                    <div className="tree-branch">
                                        {/* الفصول */}
                                        {sub.chapters?.map(ch => (
                                            <div key={ch.id} className="tree-node chapter-node">
                                                <label className="checkbox-wrapper">
                                                    <input type="checkbox" checked={selected.chapters.includes(ch.id)} onChange={() => toggleSelection('chapters', ch.id, { subjectId: sub.id })} />
                                                    <span className="checkmark"></span>
                                                    <div className="node-content">
                                                        <span className="node-icon blue-text">{Icons.chapter}</span>
                                                        <span className="node-title">{ch.title}</span>
                                                    </div>
                                                </label>
                                                
                                                <div className="tree-branch sub-branch">
                                                    {/* الفيديوهات */}
                                                    {ch.videos?.map(v => (
                                                        <label key={v.id} className="checkbox-wrapper item-node">
                                                            <input type="checkbox" checked={selected.videos.includes(v.id)} onChange={() => toggleSelection('videos', v.id, { subjectId: sub.id, chapterId: ch.id })} />
                                                            <span className="checkmark small"></span>
                                                            <div className="node-content">
                                                                <span className="node-icon slate-text">{Icons.video}</span>
                                                                <span className="node-title">{v.title}</span>
                                                            </div>
                                                        </label>
                                                    ))}
                                                    {/* الملفات */}
                                                    {ch.pdfs?.map(p => (
                                                        <label key={p.id} className="checkbox-wrapper item-node">
                                                            <input type="checkbox" checked={selected.pdfs.includes(p.id)} onChange={() => toggleSelection('pdfs', p.id, { subjectId: sub.id, chapterId: ch.id })} />
                                                            <span className="checkmark small"></span>
                                                            <div className="node-content">
                                                                <span className="node-icon pink-text">{Icons.pdf}</span>
                                                                <span className="node-title">{p.title}</span>
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                        
                                        {/* الامتحانات */}
                                        {sub.exams?.map(ex => (
                                            <label key={ex.id} className="checkbox-wrapper exam-node">
                                                <input type="checkbox" checked={selected.exams.includes(ex.id)} onChange={() => toggleSelection('exams', ex.id, { subjectId: sub.id })} />
                                                <span className="checkmark"></span>
                                                <div className="node-content">
                                                    <span className="node-icon yellow-text">{Icons.exam}</span>
                                                    <span className="node-title">امتحان: {ex.title}</span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      <style jsx>{`
        /* Header */
        .header-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 15px; margin-bottom: 25px; }
        .title-area { display: flex; align-items: center; gap: 15px; }
        .icon-wrapper { width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .icon-wrapper.purple { background: rgba(168, 85, 247, 0.1); color: #a855f7; }
        .title-area h1 { margin: 0; color: #f8fafc; font-size: 1.6rem; }
        .title-area p { margin: 5px 0 0 0; color: #94a3b8; font-size: 0.95rem; }
        .btn-back { background: #1e293b; color: #cbd5e1; border: 1px solid #334155; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 8px; transition: 0.2s; }
        .btn-back:hover { background: #334155; color: white; }

        /* Layout */
        .copy-layout { display: grid; grid-template-columns: 350px 1fr; gap: 30px; align-items: start; }
        @media(max-width: 900px) { .copy-layout { grid-template-columns: 1fr; } }

        /* Config Column (Steps) */
        .config-column { display: flex; flex-direction: column; gap: 15px; }
        .step-card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .step-card.highlight { border-color: rgba(168, 85, 247, 0.4); box-shadow: 0 10px 30px rgba(168, 85, 247, 0.1); background: linear-gradient(180deg, #1e293b, #151c2c); }
        
        .step-header { display: flex; align-items: center; gap: 12px; padding: 15px 20px; background: rgba(0,0,0,0.2); border-bottom: 1px solid #334155; }
        .step-num { width: 28px; height: 28px; background: #334155; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.9rem; }
        .highlight-num { background: #a855f7; }
        .step-header h3 { margin: 0; color: #e2e8f0; font-size: 1.1rem; }

        .step-body { padding: 20px; }
        .input-label { display: flex; align-items: center; gap: 8px; color: #cbd5e1; font-weight: 600; margin-bottom: 10px; font-size: 0.95rem; }
        .label-icon { display: flex; align-items: center; justify-content: center; }
        .label-icon.blue { color: #38bdf8; }
        .label-icon.green { color: #4ade80; }
        
        .custom-select { width: 100%; padding: 14px 15px; background: #0f172a; border: 1px solid #475569; border-radius: 10px; color: white; font-size: 1rem; outline: none; transition: 0.2s; cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: left 15px center; }
        .custom-select:focus { border-color: #38bdf8; box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.1); }
        .target-select:focus { border-color: #4ade80; box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.1); }
        
        .flow-arrow { display: flex; justify-content: center; color: #64748b; margin: -5px 0; }

        /* Summary Grid */
        .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 25px; }
        .summary-item { display: flex; align-items: center; gap: 12px; background: #0f172a; padding: 12px; border-radius: 10px; border: 1px solid #334155; }
        .s-icon { color: #94a3b8; display: flex; align-items: center; justify-content: center; }
        .s-details { display: flex; flex-direction: column; }
        .s-val { color: white; font-weight: bold; font-size: 1.1rem; line-height: 1; }
        .s-lbl { color: #64748b; font-size: 0.8rem; margin-top: 2px; }

        .btn-execute { width: 100%; display: flex; justify-content: center; align-items: center; gap: 10px; padding: 16px; background: linear-gradient(135deg, #a855f7, #7e22ce); color: white; border: none; border-radius: 10px; font-size: 1.1rem; font-weight: bold; cursor: pointer; transition: 0.3s; box-shadow: 0 4px 15px rgba(168, 85, 247, 0.3); }
        .btn-execute:disabled { opacity: 0.6; cursor: not-allowed; background: #475569; box-shadow: none; }
        .btn-execute:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(168, 85, 247, 0.4); }

        /* Tree Column */
        .tree-column { background: #1e293b; border: 1px solid #334155; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; height: calc(100vh - 180px); min-height: 600px; }
        .tree-header { padding: 20px; background: #0f172a; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; }
        .tree-header h3 { margin: 0; color: #f8fafc; font-size: 1.1rem; }
        .badge { background: rgba(56, 189, 248, 0.1); color: #38bdf8; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; }

        .tree-content { flex: 1; overflow-y: auto; padding: 20px; background: #111827; }
        .custom-scroll::-webkit-scrollbar { width: 8px; }
        .custom-scroll::-webkit-scrollbar-track { background: #0f172a; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: #475569; }

        /* Tree Structure */
        .tree-wrapper { display: flex; flex-direction: column; gap: 15px; }
        .tree-node { position: relative; }
        .tree-branch { margin-right: 22px; padding-right: 15px; border-right: 1px solid #334155; margin-top: 8px; display: flex; flex-direction: column; gap: 8px; }
        .sub-branch { border-right-style: dashed; border-color: #475569; }

        /* Checkbox & Labels */
        .checkbox-wrapper { display: flex; align-items: center; cursor: pointer; position: relative; user-select: none; padding: 8px 12px; border-radius: 8px; transition: 0.2s; border: 1px solid transparent; }
        .checkbox-wrapper:hover { background: rgba(255,255,255,0.03); border-color: #334155; }
        .checkbox-wrapper input { position: absolute; opacity: 0; cursor: pointer; height: 0; width: 0; }
        
        .checkmark { position: relative; height: 22px; width: 22px; background-color: #0f172a; border: 2px solid #475569; border-radius: 6px; transition: 0.2s; flex-shrink: 0; margin-left: 12px; }
        .checkmark.small { height: 18px; width: 18px; border-radius: 4px; }
        .checkbox-wrapper:hover input ~ .checkmark { border-color: #94a3b8; }
        .checkbox-wrapper input:checked ~ .checkmark { background-color: #a855f7; border-color: #a855f7; }
        .checkbox-wrapper input:checked ~ .checkmark.small { background-color: #38bdf8; border-color: #38bdf8; }
        .checkmark:after { content: ""; position: absolute; display: none; left: 6px; top: 2px; width: 6px; height: 12px; border: solid white; border-width: 0 2px 2px 0; transform: rotate(45deg); }
        .checkmark.small:after { left: 5px; top: 1px; width: 4px; height: 9px; }
        .checkbox-wrapper input:checked ~ .checkmark:after { display: block; }

        .node-content { display: flex; align-items: center; gap: 10px; }
        .node-icon { display: flex; align-items: center; justify-content: center; }
        .purple-text { color: #c084fc; } .blue-text { color: #38bdf8; } .slate-text { color: #94a3b8; } .pink-text { color: #f472b6; } .yellow-text { color: #facc15; }
        
        .node-title { color: #e2e8f0; font-size: 1rem; }
        .subject-node > .checkbox-wrapper { background: rgba(168, 85, 247, 0.05); border-color: rgba(168, 85, 247, 0.2); }
        .subject-node > .checkbox-wrapper .node-title { font-weight: bold; font-size: 1.1rem; color: #f8fafc; }
        .item-node .node-title { font-size: 0.9rem; color: #cbd5e1; }
        .exam-node .node-title { font-weight: bold; color: #facc15; }

        /* States & Loaders */
        .loading-state, .empty-state { display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; color: #64748b; text-align: center; }
        .empty-icon { font-size: 3rem; color: #334155; margin-bottom: 15px; }
        .spinner { width: 40px; height: 40px; border: 4px solid #1e293b; border-top: 4px solid #a855f7; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 15px; }
        .spinner-small { width: 20px; height: 20px; border: 3px solid rgba(255,255,255,0.3); border-top: 3px solid white; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        /* Toast */
        .toast { position: fixed; top: 20px; left: 50%; transform: translate(-50%, -150%); background: #1e293b; color: white; padding: 12px 25px; border-radius: 50px; font-weight: bold; box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 20000; display: flex; align-items: center; gap: 10px; transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); border: 1px solid #334155; }
        .toast.show { transform: translate(-50%, 0); }
        .toast.success { border-bottom: 3px solid #22c55e; }
        .toast.error { border-bottom: 3px solid #ef4444; }
        .toast-icon { display: flex; align-items: center; justify-content: center; }
      `}</style>
    </TeacherLayout>
  );
}
