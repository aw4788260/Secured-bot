import TeacherLayout from '../../../components/TeacherLayout';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function AdvancedCopyPage() {
  const router = useRouter();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [treeLoading, setTreeLoading] = useState(false);
  const [copying, setCopying] = useState(false);

  // الخيارات الأساسية
  const [sourceCourseId, setSourceCourseId] = useState('');
  const [targetCourseId, setTargetCourseId] = useState('');
  
  // الخيارات المتقدمة (النسخ لمادة/فصل موجود)
  const [targetSubjectId, setTargetSubjectId] = useState('');
  const [targetChapterId, setTargetChapterId] = useState('');
  const [targetTree, setTargetTree] = useState([]);

  const [sourceTree, setSourceTree] = useState([]);
  
  // شملنا الفيديوهات والملفات في هيكل التحديد
  const [selected, setSelected] = useState({ subjects: [], chapters: [], exams: [], videos: [], pdfs: [] });

  const [toast, setToast] = useState({ show: false, msg: '', type: '' });

  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: '' }), 4000);
  };

  // جلب الكورسات عند التحميل
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

  // جلب شجرة المصدر
  useEffect(() => {
    if (!sourceCourseId) {
        setSourceTree([]);
        setSelected({ subjects: [], chapters: [], exams: [], videos: [], pdfs: [] });
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

  // جلب شجرة الهدف (لإظهار المواد والفصول الموجودة)
  useEffect(() => {
    if (!targetCourseId) {
        setTargetTree([]);
        setTargetSubjectId('');
        setTargetChapterId('');
        return;
    }
    const fetchTargetTree = async () => {
        try {
            const res = await fetch(`/api/dashboard/teacher/advanced-copy?courseId=${targetCourseId}`);
            const data = await res.json();
            if (res.ok) setTargetTree(data.subjects || []);
        } catch(e) {}
    };
    fetchTargetTree();
  }, [targetCourseId]);

  const selectAll = (subjects) => {
    const newSelected = { subjects: [], chapters: [], exams: [], videos: [], pdfs: [] };
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

  // --- دوال التحديد الذكي ---
  const toggleSubject = (sub) => {
    setSelected(prev => {
        const isSelected = prev.subjects.includes(sub.id);
        let newSubjects = [...prev.subjects];
        let newChapters = [...prev.chapters];
        let newExams = [...prev.exams];
        let newVideos = [...prev.videos];
        let newPdfs = [...prev.pdfs];

        if (isSelected) {
            newSubjects = newSubjects.filter(id => id !== sub.id);
            const subChapterIds = sub.chapters?.map(c => c.id) || [];
            const subExamIds = sub.exams?.map(e => e.id) || [];
            
            newChapters = newChapters.filter(id => !subChapterIds.includes(id));
            newExams = newExams.filter(id => !subExamIds.includes(id));
            
            sub.chapters?.forEach(ch => {
                const vIds = ch.videos?.map(v => v.id) || [];
                const pIds = ch.pdfs?.map(p => p.id) || [];
                newVideos = newVideos.filter(id => !vIds.includes(id));
                newPdfs = newPdfs.filter(id => !pIds.includes(id));
            });
        } else {
            newSubjects.push(sub.id);
            sub.chapters?.forEach(c => { 
                if(!newChapters.includes(c.id)) newChapters.push(c.id); 
                c.videos?.forEach(v => { if(!newVideos.includes(v.id)) newVideos.push(v.id); });
                c.pdfs?.forEach(p => { if(!newPdfs.includes(p.id)) newPdfs.push(p.id); });
            });
            sub.exams?.forEach(e => { if(!newExams.includes(e.id)) newExams.push(e.id); });
        }
        return { subjects: newSubjects, chapters: newChapters, exams: newExams, videos: newVideos, pdfs: newPdfs };
    });
  };

  const toggleChapter = (chapterId, subjectId, videos, pdfs) => {
    setSelected(prev => {
        const isSelected = prev.chapters.includes(chapterId);
        let newChapters = isSelected ? prev.chapters.filter(id => id !== chapterId) : [...prev.chapters, chapterId];
        let newSubjects = [...prev.subjects];
        let newVideos = [...prev.videos];
        let newPdfs = [...prev.pdfs];
        
        if (isSelected) {
            const vIds = videos?.map(v => v.id) || [];
            const pIds = pdfs?.map(p => p.id) || [];
            newVideos = newVideos.filter(id => !vIds.includes(id));
            newPdfs = newPdfs.filter(id => !pIds.includes(id));
        } else {
            videos?.forEach(v => { if(!newVideos.includes(v.id)) newVideos.push(v.id); });
            pdfs?.forEach(p => { if(!newPdfs.includes(p.id)) newPdfs.push(p.id); });
            if (!newSubjects.includes(subjectId)) newSubjects.push(subjectId);
        }
        
        return { ...prev, chapters: newChapters, subjects: newSubjects, videos: newVideos, pdfs: newPdfs };
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

  const toggleVideo = (videoId) => {
    setSelected(prev => ({
        ...prev,
        videos: prev.videos.includes(videoId) ? prev.videos.filter(v => v !== videoId) : [...prev.videos, videoId]
    }));
  };

  const togglePdf = (pdfId) => {
    setSelected(prev => ({
        ...prev,
        pdfs: prev.pdfs.includes(pdfId) ? prev.pdfs.filter(p => p !== pdfId) : [...prev.pdfs, pdfId]
    }));
  };

  // --- التنفيذ للنسخ المتقدم ---
  const executeCopy = async () => {
    if (!sourceCourseId || !targetCourseId) return showToast('يرجى اختيار الكورس المصدري والهدف', 'error');
    
    

    const hasIndividualChaptersOrExams = selected.chapters.length > 0 || selected.exams.length > 0;
    if (hasIndividualChaptersOrExams && !targetSubjectId && selected.subjects.length === 0) {
        return showToast('يجب اختيار المادة الوجهة لنسخ الفصول والامتحانات الفردية', 'error');
    }

    // تصفية الفيديوهات لتجنب النسخ المزدوج (لو الشابتر كامل متحدد، بنشيل الفيديوهات الفردية منه)
    let filteredVideos = [...selected.videos];
    let filteredPdfs = [...selected.pdfs];
    
    sourceTree.forEach(sub => {
        sub.chapters?.forEach(ch => {
            if (selected.chapters.includes(ch.id)) {
                filteredVideos = filteredVideos.filter(vid => !ch.videos?.some(v => v.id === vid));
                filteredPdfs = filteredPdfs.filter(pid => !ch.pdfs?.some(p => p.id === pid));
            }
        });
    });

    const finalPayload = { 
        subjects: [...selected.subjects],
        chapters: [...selected.chapters],
        exams: [...selected.exams],
        videos: filteredVideos, 
        pdfs: filteredPdfs 
    };

    if (finalPayload.subjects.length === 0 && finalPayload.chapters.length === 0 && finalPayload.exams.length === 0 && finalPayload.videos.length === 0 && finalPayload.pdfs.length === 0) {
        return showToast('يرجى تحديد عنصر واحد على الأقل للنسخ', 'error');
    }

    setCopying(true);
    try {
      const res = await fetch('/api/dashboard/teacher/advanced-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            sourceCourseId, 
            targetCourseId, 
            targetSubjectId, 
            targetChapterId, 
            selected: finalPayload 
        })
      });
      const data = await res.json();
      
      if (res.ok) {
        showToast('🎉 تم النسخ بنجاح!', 'success');
        setSelected({ subjects: [], chapters: [], exams: [], videos: [], pdfs: [] });
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
      <div className={`custom-toast ${toast.show ? 'show' : ''} ${toast.type}`}>
          <span className="toast-icon">{toast.type === 'success' ? '✅' : '⚠️'}</span>
          <span>{toast.msg}</span>
      </div>

      <div className="page-header">
          <div className="header-info">
              <div className="header-icon">🚀</div>
              <div>
                  <h1>النسخ الذكي للمحتوى</h1>
                  <p>يمكنك نسخ محتويات كاملة أو فردية إلى كورسات ومواد وفصول موجودة بالفعل.</p>
              </div>
          </div>
          <button className="back-button" onClick={() => router.push('/admin/teacher/content')}>
              ⬅️ رجوع للمحتوى
          </button>
      </div>

      {loading ? (
          <div className="loading-container">
              <div className="loader-circle"></div>
              <p>جاري تهيئة الأداة...</p>
          </div>
      ) : (
        <div className="main-layout">
            
            <div className="config-sidebar">
                <div className="sticky-box">
                    
                    <div className="step-box">
                        <div className="step-title">
                            <span className="step-badge">1</span>
                            <h3>تحديد المصدر</h3>
                        </div>
                        <div className="step-content">
                            <label>📦 الكورس المصدري (يُنسخ منه):</label>
                            <select className="elegant-select" value={sourceCourseId} onChange={e => setSourceCourseId(e.target.value)}>
                                <option value="">-- اختر الكورس المصدري --</option>
                                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="down-arrow">⬇️</div>

                    <div className="step-box">
                        <div className="step-title">
                            <span className="step-badge">2</span>
                            <h3>تحديد الهدف</h3>
                        </div>
                        <div className="step-content">
                            <label>🎯 الكورس الهدف (يُنسخ إليه):</label>
                            <select className="elegant-select target" value={targetCourseId} onChange={e => { setTargetCourseId(e.target.value); setTargetSubjectId(''); setTargetChapterId(''); }}>
                                <option value="">-- اختر الكورس الهدف --</option>
                                {/* تم السماح باختيار نفس الكورس هنا */}
                                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                            </select>

                            {targetCourseId && (
                                <>
                                    <label className="mt-3">📚 المادة الوجهة (اختياري - للنسخ بداخلها):</label>
                                    <select className="elegant-select target" value={targetSubjectId} onChange={e => { setTargetSubjectId(e.target.value); setTargetChapterId(''); }}>
                                        <option value="">-- إنشاء مواد جديدة --</option>
                                        {targetTree.map(sub => <option key={sub.id} value={sub.id}>{sub.title}</option>)}
                                    </select>
                                </>
                            )}

                            {targetSubjectId && (
                                <>
                                    <label className="mt-3">📂 الفصل الوجهة (اختياري - لنقل الفيديوهات والملفات):</label>
                                    <select className="elegant-select target" value={targetChapterId} onChange={e => setTargetChapterId(e.target.value)}>
                                        <option value="">-- إنشاء فصول جديدة --</option>
                                        {targetTree.find(s => String(s.id) === String(targetSubjectId))?.chapters?.map(ch => (
                                            <option key={ch.id} value={ch.id}>{ch.title}</option>
                                        ))}
                                    </select>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="step-box execute-box">
                        <div className="step-title">
                            <span className="step-badge purple">3</span>
                            <h3>التنفيذ والملخص</h3>
                        </div>
                        <div className="step-content">
                            <div className="summary-tags">
                                <div className="tag"><span>📚 مواد</span><strong>{selected.subjects.length}</strong></div>
                                <div className="tag"><span>📂 فصول</span><strong>{selected.chapters.length}</strong></div>
                                <div className="tag"><span>📝 امتحانات</span><strong>{selected.exams.length}</strong></div>
                                <div className="tag"><span>🎬 فردي</span><strong>{selected.videos.length + selected.pdfs.length}</strong></div>
                            </div>

                            <button className="execute-btn" onClick={executeCopy} disabled={copying || !sourceCourseId || !targetCourseId}>
                                {copying ? '⏳ جاري النسخ...' : '🚀 تأكيد وبدء النسخ'}
                            </button>
                        </div>
                    </div>

                </div>
            </div>

            <div className="tree-main-panel">
                <div className="panel-header">
                    <h2>هيكل الكورس والمحتوى</h2>
                    <span className="info-badge">قم بتحديد/إلغاء تحديد ما تريد نسخه بدقة</span>
                </div>
                
                <div className="panel-body custom-scrollbar">
                    {treeLoading ? (
                        <div className="loading-container">
                            <div className="loader-circle"></div>
                            <p>جاري تحليل وبناء هيكل الكورس...</p>
                        </div>
                    ) : sourceTree.length === 0 ? (
                        <div className="empty-tree">
                            <div className="empty-icon">📦</div>
                            <p>يرجى اختيار الكورس المصدري من القائمة الجانبية لعرض محتوياته هنا.</p>
                        </div>
                    ) : (
                        <div className="tree-structure">
                            {sourceTree.map(sub => (
                                <div key={sub.id} className="subject-block">
                                    
                                    {/* مستوى المادة */}
                                    <div className={`subject-item ${selected.subjects.includes(sub.id) ? 'selected' : ''}`}>
                                        <label className="custom-checkbox">
                                            <input type="checkbox" checked={selected.subjects.includes(sub.id)} onChange={() => toggleSubject(sub)} />
                                            <span className="checkmark main"></span>
                                            <div className="item-text">
                                                <span className="icon">📚</span>
                                                <h4>{sub.title}</h4>
                                            </div>
                                        </label>
                                    </div>

                                    {/* مستوى الفصول والامتحانات */}
                                    <div className="subject-children">
                                        
                                        {/* الفصول */}
                                        {sub.chapters?.map(ch => (
                                            <div key={ch.id} className={`chapter-block ${selected.chapters.includes(ch.id) ? 'selected' : ''}`}>
                                                <div className="chapter-item">
                                                    <label className="custom-checkbox">
                                                        <input type="checkbox" checked={selected.chapters.includes(ch.id)} onChange={() => toggleChapter(ch.id, sub.id, ch.videos, ch.pdfs)} />
                                                        <span className="checkmark sub"></span>
                                                        <div className="item-text">
                                                            <span className="icon" style={{color: '#38bdf8'}}>📂</span>
                                                            <h5>{ch.title}</h5>
                                                        </div>
                                                    </label>
                                                </div>
                                                
                                                {/* المرفقات (تحويلها لأزرار تحديد) */}
                                                <div className="attachments-area">
                                                    {(ch.videos?.length > 0 || ch.pdfs?.length > 0) ? (
                                                        <div className="attachments-flex">
                                                            {ch.videos?.map(v => (
                                                                <div 
                                                                    key={`v-${v.id}`} 
                                                                    className={`attach-pill video ${selected.videos.includes(v.id) ? 'selected-pill' : ''}`}
                                                                    onClick={() => toggleVideo(v.id)}
                                                                >
                                                                    🎬 <span className="trunc">{v.title}</span>
                                                                </div>
                                                            ))}
                                                            {ch.pdfs?.map(p => (
                                                                <div 
                                                                    key={`p-${p.id}`} 
                                                                    className={`attach-pill pdf ${selected.pdfs.includes(p.id) ? 'selected-pill' : ''}`}
                                                                    onClick={() => togglePdf(p.id)}
                                                                >
                                                                    📄 <span className="trunc">{p.title}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="no-attachments">لا توجد مرفقات داخل هذا الفصل</div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}

                                        {/* الامتحانات */}
                                        {sub.exams?.map(ex => (
                                            <div key={ex.id} className={`exam-item ${selected.exams.includes(ex.id) ? 'selected' : ''}`}>
                                                <label className="custom-checkbox">
                                                    <input type="checkbox" checked={selected.exams.includes(ex.id)} onChange={() => toggleExam(ex.id, sub.id)} />
                                                    <span className="checkmark exam"></span>
                                                    <div className="item-text">
                                                        <span className="icon" style={{color: '#facc15'}}>📝</span>
                                                        <h5>امتحان: {ex.title}</h5>
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
        .mt-3 { margin-top: 15px; display: block; }
        
        .attach-pill { cursor: pointer; border: 2px solid transparent !important; }
        .attach-pill:hover { filter: brightness(1.2); }
        .attach-pill.selected-pill { border-color: #a855f7 !important; background: rgba(168, 85, 247, 0.2) !important; color: white !important; }

        /* ================= General Layout ================= */
        .page-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 15px; margin-bottom: 25px; }
        .header-info { display: flex; align-items: center; gap: 15px; }
        .header-icon { font-size: 2.5rem; background: rgba(168, 85, 247, 0.1); width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; border-radius: 16px; }
        .header-info h1 { margin: 0; color: #f8fafc; font-size: 1.6rem; }
        .header-info p { margin: 5px 0 0; color: #94a3b8; font-size: 0.95rem; }
        
        .back-button { background: #1e293b; color: #cbd5e1; border: 1px solid #334155; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s; }
        .back-button:hover { background: #334155; color: white; }

        .main-layout { display: grid; grid-template-columns: 350px 1fr; gap: 30px; align-items: start; }
        @media(max-width: 900px) { .main-layout { grid-template-columns: 1fr; } }

        /* ================= Sidebar Config (Right) ================= */
        .config-sidebar { position: relative; }
        .sticky-box { position: sticky; top: 80px; display: flex; flex-direction: column; gap: 15px; }
        
        .step-box { background: #1e293b; border: 1px solid #334155; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
        .execute-box { border-color: rgba(168, 85, 247, 0.4); background: linear-gradient(180deg, #1e293b, #151c2c); }
        
        .step-title { display: flex; align-items: center; gap: 12px; padding: 15px 20px; background: rgba(0,0,0,0.2); border-bottom: 1px solid #334155; }
        .step-badge { width: 28px; height: 28px; background: #334155; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; }
        .step-badge.purple { background: #a855f7; }
        .step-title h3 { margin: 0; color: #e2e8f0; font-size: 1.1rem; }

        .step-content { padding: 20px; }
        .step-content label { display: block; color: #cbd5e1; margin-bottom: 10px; font-weight: 600; }
        
        .elegant-select { width: 100%; padding: 14px; background: #0f172a; border: 1px solid #475569; border-radius: 10px; color: white; font-size: 1rem; outline: none; cursor: pointer; transition: 0.2s; }
        .elegant-select:focus { border-color: #38bdf8; box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.1); }
        .elegant-select.target:focus { border-color: #4ade80; box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.1); }
        
        .down-arrow { text-align: center; font-size: 1.5rem; color: #64748b; margin: -5px 0; }

        .summary-tags { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
        .tag { background: #0f172a; border: 1px solid #334155; padding: 10px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
        .tag span { color: #94a3b8; font-size: 0.9rem; }
        .tag strong { color: white; font-size: 1.1rem; }
        .tag.muted { opacity: 0.6; }

        .execute-btn { width: 100%; padding: 16px; background: linear-gradient(135deg, #a855f7, #7e22ce); color: white; border: none; border-radius: 10px; font-size: 1.1rem; font-weight: bold; cursor: pointer; transition: 0.3s; box-shadow: 0 4px 15px rgba(168, 85, 247, 0.3); }
        .execute-btn:disabled { opacity: 0.5; cursor: not-allowed; background: #475569; box-shadow: none; }
        .execute-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(168, 85, 247, 0.4); }

        /* ================= Tree Panel (Left) ================= */
        .tree-main-panel { background: #1e293b; border: 1px solid #334155; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; height: calc(100vh - 120px); min-height: 600px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
        .panel-header { padding: 20px 25px; background: #0f172a; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; }
        .panel-header h2 { margin: 0; color: #f8fafc; font-size: 1.2rem; }
        .info-badge { background: rgba(56, 189, 248, 0.1); color: #38bdf8; padding: 5px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: bold; border: 1px solid rgba(56, 189, 248, 0.2); }

        .panel-body { flex: 1; overflow-y: auto; padding: 25px; background: #111827; }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #0f172a; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }

        .tree-structure { display: flex; flex-direction: column; gap: 25px; }

        /* --- 1. Subject Level --- */
        .subject-block { background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; }
        .subject-item { background: rgba(0,0,0,0.2); padding: 15px 20px; border-bottom: 1px solid #334155; transition: 0.3s; }
        .subject-item.selected { background: rgba(168, 85, 247, 0.1); border-bottom-color: rgba(168, 85, 247, 0.3); }
        
        .subject-children { padding: 20px 20px 20px 45px; position: relative; display: flex; flex-direction: column; gap: 15px; }
        /* الخط الرأسي الرئيسي للمادة */
        .subject-children::before { content: ''; position: absolute; top: 0; bottom: 20px; right: 28px; width: 2px; background: #334155; z-index: 1; }

        /* --- 2. Chapter Level --- */
        .chapter-block { background: #0f172a; border: 1px dashed #475569; border-radius: 10px; position: relative; z-index: 2; transition: 0.3s; overflow: hidden; }
        .chapter-block.selected { border-style: solid; border-color: #38bdf8; box-shadow: 0 4px 15px rgba(56, 189, 248, 0.05); }
        /* الخط الأفقي الواصل للفصل */
        .chapter-block::before { content: ''; position: absolute; top: 25px; right: -17px; width: 17px; height: 2px; background: #334155; z-index: -1; }

        .chapter-item { padding: 12px 15px; background: rgba(255,255,255,0.02); border-bottom: 1px dashed #334155; }
        .chapter-block.selected .chapter-item { background: rgba(56, 189, 248, 0.08); border-bottom: 1px solid rgba(56, 189, 248, 0.2); }

        /* --- 3. Attachments (Videos/PDFs) --- */
        .attachments-area { padding: 15px; }
        .attachments-flex { display: flex; flex-wrap: wrap; gap: 8px; }
        .attach-pill { display: flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 20px; font-size: 0.85rem; border: 1px solid #475569; background: #1e293b; color: #cbd5e1; user-select: none; transition: 0.3s; }
        .chapter-block.selected .attach-pill.video { border-color: #38bdf8; color: white; background: rgba(56,189,248,0.1); }
        .chapter-block.selected .attach-pill.pdf { border-color: #f472b6; color: white; background: rgba(244,114,182,0.1); }
        .trunc { max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .no-attachments { color: #64748b; font-size: 0.85rem; font-style: italic; }

        /* --- 4. Exam Level --- */
        .exam-item { background: #0f172a; border: 1px dashed #475569; border-radius: 10px; padding: 12px 15px; position: relative; z-index: 2; transition: 0.3s; }
        .exam-item::before { content: ''; position: absolute; top: 20px; right: -17px; width: 17px; height: 2px; background: #334155; z-index: -1; }
        .exam-item.selected { border-style: solid; border-color: #facc15; background: rgba(250, 204, 21, 0.08); }

        /* ================= Custom Checkboxes ================= */
        .custom-checkbox { display: flex; align-items: center; cursor: pointer; position: relative; user-select: none; width: 100%; }
        .custom-checkbox input { position: absolute; opacity: 0; cursor: pointer; height: 0; width: 0; }
        
        .checkmark { position: relative; background-color: #0f172a; border: 2px solid #475569; border-radius: 6px; transition: 0.2s; flex-shrink: 0; margin-left: 15px; display: flex; align-items: center; justify-content: center; }
        .checkmark.main { height: 24px; width: 24px; }
        .checkmark.sub { height: 20px; width: 20px; }
        .checkmark.exam { height: 20px; width: 20px; border-radius: 4px; }

        .custom-checkbox:hover input ~ .checkmark { border-color: #94a3b8; }
        
        .custom-checkbox input:checked ~ .checkmark.main { background-color: #a855f7; border-color: #a855f7; }
        .custom-checkbox input:checked ~ .checkmark.sub { background-color: #38bdf8; border-color: #38bdf8; }
        .custom-checkbox input:checked ~ .checkmark.exam { background-color: #facc15; border-color: #facc15; }

        .checkmark:after { content: ""; position: absolute; display: none; border: solid #0f172a; border-width: 0 2px 2px 0; transform: rotate(45deg); }
        .checkmark.main:after { left: 7px; top: 3px; width: 6px; height: 12px; }
        .checkmark.sub:after { left: 6px; top: 2px; width: 5px; height: 10px; }
        .checkmark.exam:after { left: 6px; top: 2px; width: 5px; height: 10px; border-color: #0f172a; }
        .custom-checkbox input:checked ~ .checkmark:after { display: block; }

        .item-text { display: flex; align-items: center; gap: 10px; }
        .item-text h4 { margin: 0; font-size: 1.1rem; color: #f8fafc; font-weight: bold; }
        .item-text h5 { margin: 0; font-size: 1rem; color: #e2e8f0; font-weight: normal; }
        .item-text .icon { font-size: 1.2rem; }

        /* ================= States & UI ================= */
        .loading-container, .empty-tree { display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; color: #64748b; text-align: center; }
        .empty-icon { font-size: 4rem; margin-bottom: 15px; opacity: 0.5; }
        .loader-circle { width: 50px; height: 50px; border: 4px solid #1e293b; border-top: 4px solid #a855f7; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 15px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        .custom-toast { position: fixed; top: 30px; left: 50%; transform: translate(-50%, -150%); background: #1e293b; color: white; padding: 15px 30px; border-radius: 50px; font-weight: bold; box-shadow: 0 10px 40px rgba(0,0,0,0.5); z-index: 20000; display: flex; align-items: center; gap: 12px; transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); border: 1px solid #334155; font-size: 1.1rem; }
        .custom-toast.show { transform: translate(-50%, 0); }
        .custom-toast.success { border-bottom: 3px solid #22c55e; }
        .custom-toast.error { border-bottom: 3px solid #ef4444; }
      `}</style>
    </TeacherLayout>
  );
}
