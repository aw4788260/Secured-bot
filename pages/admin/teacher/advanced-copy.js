import TeacherLayout from '../../../components/TeacherLayout';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

// --- أيقونات SVG احترافية ---
const Icons = {
    back: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>,
    copy: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>,
    source: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>,
    target: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>,
    subject: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>,
    chapter: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>,
    video: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>,
    pdf: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
    exam: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M9 15l2 2 4-4"></path></svg>,
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
  // ✅ التحديد أصبح يقتصر على المواد، الفصول، والامتحانات فقط
  const [selected, setSelected] = useState({ subjects: [], chapters: [], exams: [] });

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
        setSelected({ subjects: [], chapters: [], exams: [] });
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
    const newSelected = { subjects: [], chapters: [], exams: [] };
    subjects.forEach(sub => {
      newSelected.subjects.push(sub.id);
      sub.exams?.forEach(ex => newSelected.exams.push(ex.id));
      sub.chapters?.forEach(ch => newSelected.chapters.push(ch.id));
    });
    setSelected(newSelected);
  };

  // ✅ الدوال الذكية للتعامل مع التحديد المترابط
  const toggleSubject = (sub) => {
    setSelected(prev => {
        const isSelected = prev.subjects.includes(sub.id);
        let newSubjects = [...prev.subjects];
        let newChapters = [...prev.chapters];
        let newExams = [...prev.exams];

        if (isSelected) {
            // إلغاء تحديد المادة يلغي تحديد كافة الفصول والامتحانات التابعة لها
            newSubjects = newSubjects.filter(id => id !== sub.id);
            const subChapterIds = sub.chapters?.map(c => c.id) || [];
            const subExamIds = sub.exams?.map(e => e.id) || [];
            newChapters = newChapters.filter(id => !subChapterIds.includes(id));
            newExams = newExams.filter(id => !subExamIds.includes(id));
        } else {
            // تحديد المادة يحدد كافة الفصول والامتحانات التابعة لها تلقائياً
            newSubjects.push(sub.id);
            sub.chapters?.forEach(c => { if(!newChapters.includes(c.id)) newChapters.push(c.id); });
            sub.exams?.forEach(e => { if(!newExams.includes(e.id)) newExams.push(e.id); });
        }
        return { subjects: newSubjects, chapters: newChapters, exams: newExams };
    });
  };

  const toggleChapter = (chapterId, subjectId) => {
    setSelected(prev => {
        const isSelected = prev.chapters.includes(chapterId);
        let newChapters = isSelected ? prev.chapters.filter(id => id !== chapterId) : [...prev.chapters, chapterId];
        let newSubjects = [...prev.subjects];
        
        // التحديد التلقائي للمادة الأب في حال تم تحديد أحد الفصول
        if (!isSelected && !newSubjects.includes(subjectId)) {
            newSubjects.push(subjectId);
        }
        return { ...prev, chapters: newChapters, subjects: newSubjects };
    });
  };

  const toggleExam = (examId, subjectId) => {
    setSelected(prev => {
        const isSelected = prev.exams.includes(examId);
        let newExams = isSelected ? prev.exams.filter(id => id !== examId) : [...prev.exams, examId];
        let newSubjects = [...prev.subjects];
        
        if (!isSelected && !newSubjects.includes(subjectId)) {
            newSubjects.push(subjectId);
        }
        return { ...prev, exams: newExams, subjects: newSubjects };
    });
  };

  const executeCopy = async () => {
    if (!sourceCourseId || !targetCourseId) return showToast('يرجى اختيار الكورس المصدري والهدف', 'error');
    if (sourceCourseId === targetCourseId) return showToast('لا يمكن النسخ لنفس الكورس', 'error');
    if (selected.subjects.length === 0) return showToast('يرجى تحديد مادة واحدة على الأقل للنسخ', 'error');

    // ✅ بناء Payload نهائي يشمل الـ Videos والـ PDFs بناءً على الفصول المحددة (للتوافق مع الـ API)
    const finalPayload = { ...selected, videos: [], pdfs: [] };
    
    sourceTree.forEach(sub => {
        sub.chapters?.forEach(ch => {
            if (selected.chapters.includes(ch.id)) {
                ch.videos?.forEach(v => finalPayload.videos.push(v.id));
                ch.pdfs?.forEach(p => finalPayload.pdfs.push(p.id));
            }
        });
    });

    setCopying(true);
    try {
      const res = await fetch('/api/dashboard/teacher/advanced-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceCourseId, targetCourseId, selected: finalPayload })
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
                            <div className="summary-item" style={{opacity: 0.7}}>
                                <span className="s-icon">{Icons.video}</span>
                                <div className="s-details"><span className="s-val">تلقائي</span><span className="s-lbl">فيديو</span></div>
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

            {/* العمود الأيسر: الهيكل المرئي للمحتوى (Tree) */}
            <div className="tree-column">
                <div className="tree-header">
                    <h3>هيكل الكورس (حدد العناصر المطلوبة)</h3>
                    <span className="badge">يتم نسخ المرفقات تلقائياً مع الفصول</span>
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
                            <p>يرجى اختيار الكورس المصدري من القائمة اليمنى لتهيئة شجرة النسخ.</p>
                        </div>
                    ) : (
                        <div className="tree-wrapper">
                            {sourceTree.map(sub => (
                                <div key={sub.id} className="subject-section">
                                    {/* 1. قسم المادة (عنوان رئيسي) */}
                                    <div className={`subject-header ${selected.subjects.includes(sub.id) ? 'active' : ''}`}>
                                        <label className="checkbox-wrapper">
                                            <input type="checkbox" checked={selected.subjects.includes(sub.id)} onChange={() => toggleSubject(sub)} />
                                            <span className="checkmark main"></span>
                                            <div className="node-content">
                                                <span className="node-icon purple-text">{Icons.subject}</span>
                                                <h4 className="node-title">مادة: {sub.title}</h4>
                                            </div>
                                        </label>
                                    </div>

                                    {/* محتوى المادة */}
                                    <div className="subject-body">
                                        
                                        {/* 2. الفصول (عناوين فرعية مع التحديد) */}
                                        {sub.chapters?.map(ch => (
                                            <div key={ch.id} className={`chapter-section ${selected.chapters.includes(ch.id) ? 'active' : ''}`}>
                                                <div className="chapter-header">
                                                    <label className="checkbox-wrapper">
                                                        <input type="checkbox" checked={selected.chapters.includes(ch.id)} onChange={() => toggleChapter(ch.id, sub.id)} />
                                                        <span className="checkmark sub"></span>
                                                        <div className="node-content">
                                                            <span className="node-icon blue-text">{Icons.chapter}</span>
                                                            <h5 className="node-title">شابتر: {ch.title}</h5>
                                                        </div>
                                                    </label>
                                                </div>
                                                
                                                {/* المرفقات (فقط عرض - بدون شيك بوكس) */}
                                                <div className="chapter-contents">
                                                    {(ch.videos?.length > 0 || ch.pdfs?.length > 0) ? (
                                                        <div className="contents-grid">
                                                            {ch.videos?.map(v => (
                                                                <div key={`v-${v.id}`} className="content-pill video">
                                                                    {Icons.video}
                                                                    <span className="truncate">{v.title}</span>
                                                                </div>
                                                            ))}
                                                            {ch.pdfs?.map(p => (
                                                                <div key={`p-${p.id}`} className="content-pill pdf">
                                                                    {Icons.pdf}
                                                                    <span className="truncate">{p.title}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="empty-content">لا توجد مرفقات داخل هذا الشابتر</div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}

                                        {/* 3. الامتحانات (مثل الفصول تماماً) */}
                                        {sub.exams?.map(ex => (
                                            <div key={ex.id} className={`exam-section ${selected.exams.includes(ex.id) ? 'active' : ''}`}>
                                                <label className="checkbox-wrapper">
                                                    <input type="checkbox" checked={selected.exams.includes(ex.id)} onChange={() => toggleExam(ex.id, sub.id)} />
                                                    <span className="checkmark exam-mark"></span>
                                                    <div className="node-content">
                                                        <span className="node-icon yellow-text">{Icons.exam}</span>
                                                        <h5 className="node-title exam-title">امتحان: {ex.title}</h5>
                                                    </div>
                                                </label>
                                            </div>
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

        /* Tree Column (Professional Structure) */
        .tree-column { background: #1e293b; border: 1px solid #334155; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; height: calc(100vh - 180px); min-height: 600px; }
        .tree-header { padding: 20px; background: #0f172a; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; }
        .tree-header h3 { margin: 0; color: #f8fafc; font-size: 1.1rem; }
        .badge { background: rgba(56, 189, 248, 0.1); color: #38bdf8; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; }

        .tree-content { flex: 1; overflow-y: auto; padding: 25px; background: #111827; }
        .custom-scroll::-webkit-scrollbar { width: 8px; }
        .custom-scroll::-webkit-scrollbar-track { background: #0f172a; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: #475569; }

        .tree-wrapper { display: flex; flex-direction: column; gap: 25px; }

        /* 1. Subject Section */
        .subject-section { background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .subject-header { background: rgba(168, 85, 247, 0.05); padding: 15px 20px; border-bottom: 1px solid rgba(168, 85, 247, 0.1); transition: background 0.3s; }
        .subject-header.active { background: rgba(168, 85, 247, 0.15); border-color: rgba(168, 85, 247, 0.3); }
        .subject-body { padding: 20px; display: flex; flex-direction: column; gap: 15px; }

        /* 2. Chapter Section */
        .chapter-section { border: 1px dashed #475569; border-radius: 10px; background: #0f172a; overflow: hidden; transition: border-color 0.3s; }
        .chapter-section.active { border-style: solid; border-color: #38bdf8; box-shadow: inset 0 0 10px rgba(56, 189, 248, 0.05); }
        .chapter-header { padding: 12px 15px; background: rgba(0,0,0,0.2); border-bottom: 1px dashed #334155; }
        .chapter-section.active .chapter-header { background: rgba(56, 189, 248, 0.1); border-bottom-style: solid; border-color: rgba(56, 189, 248, 0.2); }
        .chapter-contents { padding: 15px; }

        /* 3. Read-Only Content Pills (Videos & PDFs) */
        .contents-grid { display: flex; flex-wrap: wrap; gap: 10px; }
        .content-pill { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 500; border: 1px solid; opacity: 0.8; user-select: none; }
        .chapter-section.active .content-pill { opacity: 1; }
        .content-pill.video { background: rgba(148, 163, 184, 0.05); border-color: #475569; color: #cbd5e1; }
        .content-pill.pdf { background: rgba(244, 114, 182, 0.05); border-color: rgba(244, 114, 182, 0.3); color: #f472b6; }
        .truncate { max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .empty-content { color: #64748b; font-size: 0.85rem; font-style: italic; }

        /* 4. Exam Section */
        .exam-section { background: #0f172a; border: 1px dashed #475569; border-radius: 10px; padding: 12px 15px; transition: 0.3s; }
        .exam-section.active { border-style: solid; border-color: #facc15; background: rgba(250, 204, 21, 0.05); box-shadow: inset 0 0 10px rgba(250, 204, 21, 0.05); }
        
        /* Node Texts & Icons */
        .node-content { display: flex; align-items: center; gap: 12px; }
        .node-title { margin: 0; color: #f8fafc; font-size: 1rem; }
        h4.node-title { font-size: 1.1rem; }
        .exam-title { color: #e2e8f0; }
        .exam-section.active .exam-title { color: #facc15; }
        
        .purple-text { color: #c084fc; } .blue-text { color: #38bdf8; } .yellow-text { color: #facc15; }

        /* Checkboxes Custom Design */
        .checkbox-wrapper { display: flex; align-items: center; cursor: pointer; position: relative; user-select: none; width: 100%; }
        .checkbox-wrapper input { position: absolute; opacity: 0; cursor: pointer; height: 0; width: 0; }
        
        .checkmark { position: relative; background-color: #0f172a; border: 2px solid #475569; border-radius: 6px; transition: 0.2s; flex-shrink: 0; margin-left: 15px; display: flex; align-items: center; justify-content: center;}
        .checkmark.main { height: 24px; width: 24px; }
        .checkmark.sub { height: 20px; width: 20px; }
        .checkmark.exam-mark { height: 20px; width: 20px; border-radius: 5px; }

        .checkbox-wrapper:hover input ~ .checkmark { border-color: #94a3b8; }
        
        /* Subject Check */
        .checkbox-wrapper input:checked ~ .checkmark.main { background-color: #a855f7; border-color: #a855f7; }
        /* Chapter Check */
        .checkbox-wrapper input:checked ~ .checkmark.sub { background-color: #38bdf8; border-color: #38bdf8; }
        /* Exam Check */
        .checkbox-wrapper input:checked ~ .checkmark.exam-mark { background-color: #facc15; border-color: #facc15; }

        .checkmark:after { content: ""; position: absolute; display: none; border: solid #0f172a; border-width: 0 2px 2px 0; transform: rotate(45deg); }
        .checkmark.main:after { left: 7px; top: 3px; width: 6px; height: 12px; }
        .checkmark.sub:after { left: 6px; top: 2px; width: 5px; height: 10px; }
        .checkmark.exam-mark:after { left: 6px; top: 2px; width: 5px; height: 10px; border-color: #0f172a; }
        .checkbox-wrapper input:checked ~ .checkmark:after { display: block; }

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
