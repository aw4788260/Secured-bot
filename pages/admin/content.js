import AdminLayout from '../../components/AdminLayout';
import { useState, useEffect } from 'react';

export default function ContentManager() {
  // --- States ---
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Navigation
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);

  // Forms Visibility
  const [modalMode, setModalMode] = useState(null); // 'add_chapter', 'add_video', 'add_pdf', 'add_exam', 'view_stats'
  
  // Form Data
  const [newItemTitle, setNewItemTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [examForm, setExamForm] = useState({ title: '', duration: 30, questions: [] });
  const [currentQuestion, setCurrentQuestion] = useState({ text: '', image: null, options: ['', '', '', ''], correctIndex: 0 });
  const [uploadingImg, setUploadingImg] = useState(false);
  const [examStats, setExamStats] = useState(null);

  // --- Fetch Data ---
  const fetchContent = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/manage-content'); // استخدام API الأدمن الجديد
        const data = await res.json();
        setCourses(data);
        
        // تحديث البيانات المحلية للحفاظ على العرض الحالي
        if (selectedCourse) {
            const updatedCourse = data.find(c => c.id === selectedCourse.id);
            setSelectedCourse(updatedCourse);
            if (selectedSubject) {
                const updatedSubject = updatedCourse.subjects.find(s => s.id === selectedSubject.id);
                setSelectedSubject(updatedSubject);
                if (selectedChapter) {
                    const updatedChapter = updatedSubject.chapters.find(ch => ch.id === selectedChapter.id);
                    setSelectedChapter(updatedChapter);
                }
            }
        }
      } catch (err) {
        console.error(err);
        alert("فشل جلب البيانات");
      }
      setLoading(false);
  };

  useEffect(() => { fetchContent(); }, []);

  // --- Actions ---

  const handleAddChapter = async () => {
      if(!newItemTitle) return alert("اكتب العنوان");
      await apiCall('add_chapter', { subjectId: selectedSubject.id, title: newItemTitle });
      setModalMode(null); setNewItemTitle('');
  };

  const handleAddVideo = async () => {
      if(!newItemTitle || !videoUrl) return alert("اكمل البيانات");
      await apiCall('add_video', { chapterId: selectedChapter.id, title: newItemTitle, url: videoUrl });
      setModalMode(null); setNewItemTitle(''); setVideoUrl('');
  };

  const handlePdfUpload = async (e) => {
      e.preventDefault();
      const file = e.target.file.files[0];
      const title = e.target.title.value;
      if (!file) return alert("اختر ملف");

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      formData.append('type', 'pdf');
      formData.append('chapterId', selectedChapter.id);

      setLoading(true);
      const res = await fetch('/api/admin/upload-file', { method: 'POST', body: formData });
      if (res.ok) { fetchContent(); setModalMode(null); alert('تم الرفع ✅'); }
      else alert('فشل الرفع');
      setLoading(false);
  };

  const handleQuestionImageUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setUploadingImg(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'exam_image');
      const res = await fetch('/api/admin/upload-file', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) setCurrentQuestion({ ...currentQuestion, image: data.fileName });
      setUploadingImg(false);
  };

  const addQuestion = () => {
      if(!currentQuestion.text) return alert("نص السؤال مطلوب");
      setExamForm({...examForm, questions: [...examForm.questions, currentQuestion]});
      setCurrentQuestion({ text: '', image: null, options: ['', '', '', ''], correctIndex: 0 });
  };

  const saveExam = async () => {
      if(examForm.questions.length === 0) return alert("أضف أسئلة أولاً");
      await apiCall('save_exam', { 
          subjectId: selectedSubject.id, 
          title: examForm.title, 
          duration: examForm.duration, 
          questions: examForm.questions 
      });
      setModalMode(null); setExamForm({ title: '', duration: 30, questions: [] });
  };

  const deleteItem = async (type, id) => {
      if(!confirm("هل أنت متأكد من الحذف؟")) return;
      await apiCall('delete_item', { type, id });
  };

  const viewStats = async (examId) => {
      setLoading(true);
      const res = await fetch(`/api/admin/exam-stats?examId=${examId}`);
      const data = await res.json();
      setExamStats(data);
      setModalMode('view_stats');
      setLoading(false);
  };

  const apiCall = async (action, payload) => {
      setLoading(true);
      const res = await fetch('/api/admin/manage-content', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ action, payload })
      });
      const data = await res.json();
      if(res.ok) { fetchContent(); }
      else { alert(data.error); }
      setLoading(false);
  };

  // --- Render Helpers ---
  const Breadcrumbs = () => (
      <div className="breadcrumbs">
          <span onClick={() => {setSelectedCourse(null); setSelectedSubject(null); setSelectedChapter(null);}}>الرئيسية</span>
          {selectedCourse && <span onClick={() => {setSelectedSubject(null); setSelectedChapter(null);}}> &gt; {selectedCourse.title}</span>}
          {selectedSubject && <span onClick={() => setSelectedChapter(null)}> &gt; {selectedSubject.title}</span>}
          {selectedChapter && <span> &gt; {selectedChapter.title}</span>}
      </div>
  );

  return (
    <AdminLayout title="إدارة المحتوى">
      <h1 className="page-title">🗂️ إدارة المحتوى التعليمي</h1>
      <Breadcrumbs />

      {loading && <div className="loader">جاري التحميل...</div>}

      {/* المستوى 1: الكورسات */}
      {!selectedCourse && (
          <div className="grid">
              {courses.map(course => (
                  <div key={course.id} className="card course-card" onClick={() => setSelectedCourse(course)}>
                      <div className="icon">📦</div>
                      <h3>{course.title}</h3>
                      <span className="count">{course.subjects.length} مادة</span>
                  </div>
              ))}
          </div>
      )}

      {/* المستوى 2: المواد */}
      {selectedCourse && !selectedSubject && (
          <div className="grid">
              {selectedCourse.subjects.map(subject => (
                  <div key={subject.id} className="card subject-card" onClick={() => setSelectedSubject(subject)}>
                      <div className="icon">📖</div>
                      <h3>{subject.title}</h3>
                      <span className="count">
                          {subject.chapters.length} فصل | {subject.exams.length} امتحان
                      </span>
                  </div>
              ))}
          </div>
      )}

      {/* المستوى 3: تفاصيل المادة (شباتر + امتحانات) */}
      {selectedSubject && !selectedChapter && (
          <div className="content-wrapper">
              
              {/* قسم الشباتر */}
              <div className="section-header">
                  <h3>📂 الفصول الدراسية (Chapters)</h3>
                  <button className="btn-add" onClick={() => setModalMode('add_chapter')}>➕ إضافة فصل جديد</button>
              </div>
              
              <div className="list-container">
                  {selectedSubject.chapters.length === 0 && <p className="empty-text">لا توجد فصول مضافة.</p>}
                  {selectedSubject.chapters.map(chapter => (
                      <div key={chapter.id} className="list-item">
                          <div className="info" onClick={() => setSelectedChapter(chapter)}>
                              <span className="title">📁 {chapter.title}</span>
                              <span className="meta">({chapter.videos.length} فيديو - {chapter.pdfs.length} ملف)</span>
                          </div>
                          <div className="actions">
                              <button className="btn-icon delete" title="حذف" onClick={() => deleteItem('chapters', chapter.id)}>🗑️</button>
                          </div>
                      </div>
                  ))}
              </div>

              {/* قسم الامتحانات */}
              <div className="section-header" style={{marginTop:'40px'}}>
                  <h3>📝 الامتحانات</h3>
                  <button className="btn-add" onClick={() => setModalMode('add_exam')}>➕ إنشاء امتحان</button>
              </div>

              <div className="list-container">
                  {selectedSubject.exams.length === 0 && <p className="empty-text">لا توجد امتحانات.</p>}
                  {selectedSubject.exams.map(exam => (
                      <div key={exam.id} className="list-item exam-item">
                          <div className="info">
                              <span className="title">📝 {exam.title}</span>
                              <span className="meta">{exam.duration_minutes} دقيقة</span>
                          </div>
                          <div className="actions">
                              <button className="btn-small stats" onClick={() => viewStats(exam.id)}>📊 الإحصائيات</button>
                              <button className="btn-icon delete" onClick={() => deleteItem('exams', exam.id)}>🗑️</button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* المستوى 4: داخل الشابتر (فيديوهات + ملفات) */}
      {selectedChapter && (
          <div className="content-wrapper">
              
              {/* الفيديوهات */}
              <div className="section-header">
                  <h3>🎬 الفيديوهات</h3>
                  <button className="btn-add" onClick={() => setModalMode('add_video')}>➕ رفع فيديو</button>
              </div>
              <div className="grid-mini">
                  {selectedChapter.videos.map(video => (
                      <div key={video.id} className="mini-card">
                          <div className="mini-info">
                              <span className="video-icon">▶️</span>
                              <span>{video.title}</span>
                          </div>
                          <button className="btn-text delete" onClick={() => deleteItem('videos', video.id)}>حذف</button>
                      </div>
                  ))}
              </div>

              {/* الملفات */}
              <div className="section-header" style={{marginTop:'30px'}}>
                  <h3>📄 ملفات PDF</h3>
                  <button className="btn-add" onClick={() => setModalMode('add_pdf')}>➕ رفع ملف</button>
              </div>
              <div className="grid-mini">
                  {selectedChapter.pdfs.map(pdf => (
                      <div key={pdf.id} className="mini-card pdf">
                          <div className="mini-info">
                              <span className="pdf-icon">📄</span>
                              <span>{pdf.title}</span>
                          </div>
                          <button className="btn-text delete" onClick={() => deleteItem('pdfs', pdf.id)}>حذف</button>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* -------- Modals -------- */}

      {/* Modal: Add Chapter */}
      {modalMode === 'add_chapter' && (
          <Modal onClose={() => setModalMode(null)} title="إضافة فصل جديد">
              <input className="input-field" placeholder="عنوان الفصل (مثال: الوحدة الأولى)" value={newItemTitle} onChange={e=>setNewItemTitle(e.target.value)} />
              <button className="btn-primary full" onClick={handleAddChapter}>حفظ</button>
          </Modal>
      )}

      {/* Modal: Add Video */}
      {modalMode === 'add_video' && (
          <Modal onClose={() => setModalMode(null)} title="إضافة فيديو يوتيوب">
              <input className="input-field" placeholder="عنوان الفيديو" value={newItemTitle} onChange={e=>setNewItemTitle(e.target.value)} />
              <input className="input-field" placeholder="رابط يوتيوب (Link)" value={videoUrl} onChange={e=>setVideoUrl(e.target.value)} />
              <button className="btn-primary full" onClick={handleAddVideo}>إضافة</button>
          </Modal>
      )}

      {/* Modal: Add PDF */}
      {modalMode === 'add_pdf' && (
          <Modal onClose={() => setModalMode(null)} title="رفع ملف PDF">
              <form onSubmit={handlePdfUpload}>
                  <input className="input-field" name="title" placeholder="عنوان الملف" required />
                  <input className="input-field file" type="file" name="file" accept="application/pdf" required />
                  <button type="submit" className="btn-primary full">رفع وحفظ</button>
              </form>
          </Modal>
      )}

      {/* Modal: Stats */}
      {modalMode === 'view_stats' && examStats && (
          <Modal onClose={() => setModalMode(null)} title="إحصائيات الامتحان">
              <div className="stats-summary">
                  <div className="stat-box"><span>الطلاب</span><strong>{examStats.totalAttempts}</strong></div>
                  <div className="stat-box"><span>المتوسط</span><strong style={{color:'#facc15'}}>{examStats.averageScore}%</strong></div>
              </div>
              <div className="table-scroll">
                  <table className="data-table">
                      <thead><tr><th>الاسم</th><th>الدرجة</th></tr></thead>
                      <tbody>
                          {examStats.attempts.map((att, i) => (
                              <tr key={i}>
                                  <td>{att.student_name_input}</td>
                                  <td style={{color: att.score >= 50 ? '#4ade80' : '#ef4444'}}>{att.score}%</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </Modal>
      )}

      {/* Modal: Add Exam (Full Screen) */}
      {modalMode === 'add_exam' && (
          <div className="fullscreen-modal">
              <div className="modal-content large">
                  <div className="modal-header">
                      <h2>📝 إنشاء امتحان جديد</h2>
                      <button onClick={() => setModalMode(null)}>✕</button>
                  </div>
                  <div className="modal-body">
                      <div className="row">
                          <input className="input-field" placeholder="عنوان الامتحان" value={examForm.title} onChange={e=>setExamForm({...examForm, title: e.target.value})} />
                          <input className="input-field" type="number" placeholder="المدة (د)" value={examForm.duration} onChange={e=>setExamForm({...examForm, duration: e.target.value})} style={{width:'100px'}} />
                      </div>

                      <div className="question-builder">
                          <h4>سؤال جديد:</h4>
                          <textarea className="input-field" rows="2" placeholder="نص السؤال..." value={currentQuestion.text} onChange={e=>setCurrentQuestion({...currentQuestion, text: e.target.value})}></textarea>
                          
                          <div className="upload-row">
                              <label>صورة (اختياري): {uploadingImg && 'جاري الرفع...'}</label>
                              <input type="file" accept="image/*" onChange={handleQuestionImageUpload} />
                              {currentQuestion.image && <span className="success-tag">تم الإرفاق ✅</span>}
                          </div>

                          <div className="options-grid">
                              {currentQuestion.options.map((opt, i) => (
                                  <div key={i} className="option-row">
                                      <input type="radio" name="correct" checked={currentQuestion.correctIndex === i} onChange={() => setCurrentQuestion({...currentQuestion, correctIndex: i})} />
                                      <input className="input-field small" placeholder={`الخيار ${i+1}`} value={opt} onChange={e => {
                                          const newOpts = [...currentQuestion.options]; newOpts[i] = e.target.value;
                                          setCurrentQuestion({...currentQuestion, options: newOpts});
                                      }} />
                                  </div>
                              ))}
                          </div>
                          <button className="btn-secondary full" onClick={addQuestion}>➕ إضافة السؤال</button>
                      </div>

                      <div className="questions-list">
                          <h4>الأسئلة ({examForm.questions.length}):</h4>
                          {examForm.questions.map((q, i) => (
                              <div key={i} className="q-preview">
                                  <b>{i+1}. {q.text}</b>
                                  <span>الإجابة: {q.options[q.correctIndex]}</span>
                              </div>
                          ))}
                      </div>
                  </div>
                  <div className="modal-footer">
                      <button className="btn-primary" onClick={saveExam}>حفظ الامتحان النهائي 💾</button>
                  </div>
              </div>
          </div>
      )}

      <style jsx>{`
        .page-title { color: #38bdf8; border-bottom: 1px solid #334155; padding-bottom: 15px; margin-bottom: 20px; }
        .breadcrumbs { color: #94a3b8; margin-bottom: 25px; font-size: 1.1em; cursor: pointer; }
        .breadcrumbs span:hover { color: white; text-decoration: underline; }
        
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px; }
        .card { background: #1e293b; padding: 25px; border-radius: 12px; border: 1px solid #334155; text-align: center; cursor: pointer; transition: 0.2s; }
        .card:hover { transform: translateY(-5px); border-color: #38bdf8; box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
        .card .icon { font-size: 2.5em; margin-bottom: 10px; }
        .card h3 { margin: 0; color: white; font-size: 1.2em; }
        .card .count { display: block; margin-top: 8px; color: #64748b; font-size: 0.9em; }

        .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #334155; padding-bottom: 10px; }
        .btn-add { background: #38bdf8; color: #0f172a; border: none; padding: 8px 15px; border-radius: 6px; font-weight: bold; cursor: pointer; }
        
        .list-container { display: flex; flex-direction: column; gap: 10px; }
        .list-item { background: #1f2937; padding: 15px; border-radius: 8px; border: 1px solid #374151; display: flex; justify-content: space-between; align-items: center; }
        .list-item .info { cursor: pointer; flex: 1; }
        .list-item .title { font-weight: bold; font-size: 1.1em; color: white; display: block; }
        .list-item .meta { color: #9ca3af; font-size: 0.9em; }
        .list-item .actions { display: flex; gap: 10px; }
        
        .grid-mini { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px; }
        .mini-card { background: #111827; padding: 15px; border-radius: 8px; border: 1px solid #374151; display: flex; justify-content: space-between; align-items: center; }
        .mini-info { display: flex; align-items: center; gap: 10px; color: #e5e7eb; }
        
        .btn-icon { background: none; border: none; font-size: 1.2em; cursor: pointer; padding: 5px; }
        .btn-icon:hover { transform: scale(1.1); }
        .btn-small { padding: 5px 10px; border-radius: 4px; border: none; font-size: 0.85em; font-weight: bold; cursor: pointer; }
        .btn-small.stats { background: #3b82f6; color: white; }
        .btn-text.delete { background: none; border: none; color: #ef4444; font-size: 0.9em; cursor: pointer; }
        .btn-text.delete:hover { text-decoration: underline; }

        /* Modals */
        .fullscreen-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 100; display: flex; justify-content: center; align-items: center; }
        .modal-content { background: #1e293b; padding: 25px; border-radius: 12px; width: 90%; max-width: 500px; max-height: 90vh; overflow-y: auto; }
        .modal-content.large { max-width: 800px; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .modal-header button { background: none; border: none; color: #94a3b8; font-size: 1.5em; cursor: pointer; }
        
        .input-field { width: 100%; padding: 12px; margin-bottom: 10px; background: #0f172a; border: 1px solid #475569; color: white; border-radius: 6px; }
        .input-field.file { padding: 10px; }
        .btn-primary { background: #38bdf8; color: #0f172a; border: none; padding: 12px; border-radius: 6px; font-weight: bold; cursor: pointer; }
        .btn-primary.full { width: 100%; }
        .btn-secondary { background: #374151; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer; }
        
        .question-builder { background: #111827; padding: 15px; border-radius: 8px; border: 1px dashed #38bdf8; margin: 15px 0; }
        .options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0; }
        .option-row { display: flex; align-items: center; gap: 5px; }
        .option-row input[type="radio"] { width: 20px; height: 20px; accent-color: #38bdf8; }
        
        .stats-summary { display: flex; justify-content: space-around; margin-bottom: 20px; }
        .stat-box { text-align: center; background: #0f172a; padding: 15px; border-radius: 8px; min-width: 100px; }
        .stat-box span { display: block; color: #94a3b8; font-size: 0.85em; }
        .stat-box strong { font-size: 1.5em; color: white; }
        .data-table { width: 100%; border-collapse: collapse; }
        .data-table th, .data-table td { padding: 10px; text-align: left; border-bottom: 1px solid #374151; }
        .data-table th { color: #94a3b8; font-size: 0.9em; }
      `}</style>
    </AdminLayout>
  );
}

// Modal Component Helper
const Modal = ({ children, title, onClose }) => (
    <div className="fullscreen-modal" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
                <h3>{title}</h3>
                <button onClick={onClose}>✕</button>
            </div>
            {children}
        </div>
        <style jsx>{`
            .fullscreen-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 200; display: flex; justify-content: center; align-items: center; }
            .modal-content { background: #1e293b; padding: 25px; border-radius: 12px; width: 90%; max-width: 450px; border: 1px solid #475569; }
            .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; color: #38bdf8; }
            .modal-header button { background: none; border: none; color: white; cursor: pointer; font-size: 1.2em; }
        `}</style>
    </div>
);
