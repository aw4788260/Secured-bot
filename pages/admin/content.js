import AdminLayout from '../../components/AdminLayout';
import { useState, useEffect } from 'react';

// --- SVG Icons ---
const Icons = {
    back: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>,
    add: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>,
    trash: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
    edit: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    video: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
    pdf: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
    exam: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2 2 4-4"/></svg>,
    folder: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>,
    upload: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
    check: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>,
    next: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
    prev: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
};

export default function ContentManager() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Navigation
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);

  // Modals & UI States
  const [modalMode, setModalMode] = useState(null);
  const [alertData, setAlertData] = useState({ show: false, type: 'info', msg: '' });
  const [confirmData, setConfirmData] = useState({ show: false, msg: '', onConfirm: null });

  // Forms
  const [newItemTitle, setNewItemTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  
  // Exam Builder
  const [examForm, setExamForm] = useState({ title: '', duration: 30, questions: [] });
  const [currentQ, setCurrentQ] = useState({ text: '', image: null, options: ['', '', '', ''], correctIndex: 0 });
  const [editingQIndex, setEditingQIndex] = useState(-1); // -1 means new question
  const [uploadingImg, setUploadingImg] = useState(false);
  
  // Stats
  const [examStats, setExamStats] = useState(null);

  // --- Initial Load ---
  const fetchContent = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/manage-content');
        const data = await res.json();
        setCourses(data);
        
        // Refresh local selection if data changed
        if (selectedCourse) {
            const updatedC = data.find(c => c.id === selectedCourse.id);
            setSelectedCourse(updatedC);
            if (selectedSubject && updatedC) {
                const updatedS = updatedC.subjects.find(s => s.id === selectedSubject.id);
                setSelectedSubject(updatedS);
                if (selectedChapter && updatedS) {
                    const updatedCh = updatedS.chapters.find(ch => ch.id === selectedChapter.id);
                    setSelectedChapter(updatedCh);
                }
            }
        }
      } catch (err) { showAlert('error', 'فشل الاتصال بالسيرفر'); }
      setLoading(false);
  };

  useEffect(() => { fetchContent(); }, []);

  // --- Helpers ---
  const showAlert = (type, msg) => {
      setAlertData({ show: true, type, msg });
      setTimeout(() => setAlertData({ ...alertData, show: false }), 3000);
  };

  const showConfirm = (msg, action) => {
      setConfirmData({ show: true, msg, onConfirm: action });
  };

  const goBack = () => {
      if (selectedChapter) setSelectedChapter(null);
      else if (selectedSubject) setSelectedSubject(null);
      else if (selectedCourse) setSelectedCourse(null);
  };

  // --- API Actions ---
  const apiCall = async (action, payload) => {
      setLoading(true);
      try {
          const res = await fetch('/api/admin/manage-content', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ action, payload })
          });
          const data = await res.json();
          if (res.ok) { 
              fetchContent(); 
              return true; 
          } else { 
              showAlert('error', data.error || 'حدث خطأ'); 
              return false; 
          }
      } catch (e) { showAlert('error', 'خطأ في الاتصال'); } 
      finally { setLoading(false); }
  };

  // --- Handlers ---
  const handleAddChapter = async () => {
      if(!newItemTitle) return showAlert('error', 'العنوان مطلوب');
      const success = await apiCall('add_chapter', { subjectId: selectedSubject.id, title: newItemTitle });
      if(success) { setModalMode(null); setNewItemTitle(''); showAlert('success', 'تمت الإضافة'); }
  };

  const handleAddVideo = async () => {
      if(!newItemTitle || !videoUrl) return showAlert('error', 'البيانات ناقصة');
      const success = await apiCall('add_video', { chapterId: selectedChapter.id, title: newItemTitle, url: videoUrl });
      if(success) { setModalMode(null); setNewItemTitle(''); setVideoUrl(''); showAlert('success', 'تم إضافة الفيديو'); }
  };

  const handleDelete = (type, id) => {
      showConfirm('هل أنت متأكد من الحذف النهائي؟', async () => {
          const success = await apiCall('delete_item', { type, id });
          if(success) { 
              showAlert('success', 'تم الحذف'); 
              setConfirmData({ show: false, msg: '', onConfirm: null });
          }
      });
  };

  // --- Exam Logic ---
  const handleImageUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setUploadingImg(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'exam_image');
      try {
          const res = await fetch('/api/admin/upload-file', { method: 'POST', body: formData });
          const data = await res.json();
          if (res.ok) setCurrentQ({ ...currentQ, image: data.fileName });
      } catch(e) { showAlert('error', 'فشل رفع الصورة'); }
      setUploadingImg(false);
  };

  const saveCurrentQuestion = () => {
      if(!currentQ.text) return showAlert('error', 'نص السؤال مطلوب');
      
      const newQuestions = [...examForm.questions];
      if (editingQIndex >= 0) {
          newQuestions[editingQIndex] = currentQ; // Update existing
      } else {
          newQuestions.push(currentQ); // Add new
      }
      
      setExamForm({ ...examForm, questions: newQuestions });
      // Reset for next question
      setCurrentQ({ text: '', image: null, options: ['', '', '', ''], correctIndex: 0 });
      setEditingQIndex(-1);
  };

  const editQuestion = (index) => {
      setCurrentQ(examForm.questions[index]);
      setEditingQIndex(index);
  };

  const deleteQuestion = (index) => {
      const newQuestions = examForm.questions.filter((_, i) => i !== index);
      setExamForm({ ...examForm, questions: newQuestions });
      if (editingQIndex === index) {
          setEditingQIndex(-1);
          setCurrentQ({ text: '', image: null, options: ['', '', '', ''], correctIndex: 0 });
      }
  };

  const submitExam = async () => {
      if(examForm.questions.length === 0) return showAlert('error', 'أضف أسئلة أولاً');
      if(!examForm.title) return showAlert('error', 'العنوان مطلوب');
      
      const success = await apiCall('save_exam', { 
          subjectId: selectedSubject.id, 
          title: examForm.title, 
          duration: examForm.duration, 
          questions: examForm.questions 
      });
      if(success) { 
          setModalMode(null); 
          setExamForm({ title: '', duration: 30, questions: [] }); 
          showAlert('success', 'تم حفظ الامتحان');
      }
  };

  const handleStats = async (examId) => {
      setLoading(true);
      const res = await fetch(`/api/admin/exam-stats?examId=${examId}`);
      const data = await res.json();
      setExamStats(data);
      setModalMode('view_stats');
      setLoading(false);
  };

  // --- Render ---
  return (
    <AdminLayout title="إدارة المحتوى">
      
      {/* Top Header */}
      <div className="page-header">
          <div className="title-box">
              <h1>🗂️ إدارة المحتوى</h1>
              <p className="subtitle">
                  {selectedCourse ? selectedCourse.title : 'الرئيسية'} 
                  {selectedSubject ? ` / ${selectedSubject.title}` : ''}
                  {selectedChapter ? ` / ${selectedChapter.title}` : ''}
              </p>
          </div>
          {(selectedCourse || selectedSubject || selectedChapter) && (
              <button className="btn-back" onClick={goBack}>{Icons.back} رجوع</button>
          )}
      </div>

      {loading && <div className="loader-line"></div>}

      {/* Level 1: Courses */}
      {!selectedCourse && (
          <div className="grid-cards">
              {courses.map(c => (
                  <div key={c.id} className="card folder-card" onClick={() => setSelectedCourse(c)}>
                      <div className="icon-wrapper blue">{Icons.folder}</div>
                      <h3>{c.title}</h3>
                      <span className="badge">{c.subjects.length} مادة</span>
                  </div>
              ))}
          </div>
      )}

      {/* Level 2: Subjects */}
      {selectedCourse && !selectedSubject && (
          <div className="grid-cards">
              {selectedCourse.subjects.map(s => (
                  <div key={s.id} className="card folder-card" onClick={() => setSelectedSubject(s)}>
                      <div className="icon-wrapper green">{Icons.folder}</div>
                      <h3>{s.title}</h3>
                      <span className="badge">{s.chapters.length} فصول</span>
                  </div>
              ))}
          </div>
      )}

      {/* Level 3: Chapters & Exams */}
      {selectedSubject && !selectedChapter && (
          <div className="content-container">
              
              {/* Chapters Section */}
              <div className="section-block">
                  <div className="section-head">
                      <h3>📂 الفصول الدراسية</h3>
                      <button className="btn-primary" onClick={() => setModalMode('add_chapter')}>
                          {Icons.add} إضافة فصل
                      </button>
                  </div>
                  <div className="list-view">
                      {selectedSubject.chapters.length === 0 && <div className="empty">لا توجد فصول</div>}
                      {selectedSubject.chapters.map(ch => (
                          <div key={ch.id} className="list-item">
                              <div className="info" onClick={() => setSelectedChapter(ch)}>
                                  <strong>{ch.title}</strong>
                                  <small>{ch.videos.length} فيديو • {ch.pdfs.length} ملف</small>
                              </div>
                              <div className="actions">
                                  {/* أزرار التعديل تظهر هنا فقط */}
                                  <button className="btn-icon danger" onClick={() => handleDelete('chapters', ch.id)}>{Icons.trash}</button>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>

              {/* Exams Section */}
              <div className="section-block">
                  <div className="section-head">
                      <h3>📝 الامتحانات</h3>
                      <button className="btn-primary" onClick={() => setModalMode('add_exam')}>
                          {Icons.add} إنشاء امتحان
                      </button>
                  </div>
                  <div className="grid-cards small">
                      {selectedSubject.exams.map(ex => (
                          <div key={ex.id} className="card exam-card">
                              <div className="card-top">
                                  <div className="icon-wrapper purple">{Icons.exam}</div>
                                  <div className="actions-overlay">
                                      <button className="btn-icon" onClick={() => handleStats(ex.id)}>📊</button>
                                      <button className="btn-icon danger" onClick={() => handleDelete('exams', ex.id)}>{Icons.trash}</button>
                                  </div>
                              </div>
                              <h4>{ex.title}</h4>
                              <span>{ex.duration_minutes} دقيقة</span>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* Level 4: Content (Videos & PDFs) */}
      {selectedChapter && (
          <div className="content-container">
              
              {/* Videos */}
              <div className="section-block">
                  <div className="section-head">
                      <h3>🎬 الفيديوهات</h3>
                      <button className="btn-primary" onClick={() => setModalMode('add_video')}>
                          {Icons.upload} إضافة فيديو
                      </button>
                  </div>
                  <div className="grid-cards video-grid">
                      {selectedChapter.videos.map(vid => (
                          <div key={vid.id} className="card video-card">
                              <div className="video-thumb">
                                  {Icons.video}
                                  <button className="delete-overlay" onClick={() => handleDelete('videos', vid.id)}>{Icons.trash}</button>
                              </div>
                              <div className="card-body">
                                  <h4>{vid.title}</h4>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>

              {/* PDFs */}
              <div className="section-block">
                  <div className="section-head">
                      <h3>📄 الملفات</h3>
                      <button className="btn-primary" onClick={() => setModalMode('add_pdf')}>
                          {Icons.upload} رفع ملف
                      </button>
                  </div>
                  <div className="list-view">
                      {selectedChapter.pdfs.map(pdf => (
                          <div key={pdf.id} className="list-item pdf-item">
                              <div className="info">
                                  <span className="icon">{Icons.pdf}</span>
                                  <strong>{pdf.title}</strong>
                              </div>
                              <button className="btn-icon danger" onClick={() => handleDelete('pdfs', pdf.id)}>{Icons.trash}</button>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* --- Modals --- */}
      
      {/* 1. Add Chapter */}
      {modalMode === 'add_chapter' && (
          <Modal title="فصل جديد" onClose={() => setModalMode(null)}>
              <div className="form-group">
                  <label>عنوان الفصل</label>
                  <input autoFocus value={newItemTitle} onChange={e=>setNewItemTitle(e.target.value)} placeholder="مثال: الباب الأول" />
              </div>
              <button className="btn-submit" onClick={handleAddChapter}>حفظ</button>
          </Modal>
      )}

      {/* 2. Add Video */}
      {modalMode === 'add_video' && (
          <Modal title="إضافة فيديو" onClose={() => setModalMode(null)}>
              <div className="form-group">
                  <label>العنوان</label>
                  <input value={newItemTitle} onChange={e=>setNewItemTitle(e.target.value)} placeholder="عنوان الفيديو" />
              </div>
              <div className="form-group">
                  <label>رابط يوتيوب</label>
                  <input value={videoUrl} onChange={e=>setVideoUrl(e.target.value)} placeholder="https://..." dir="ltr" />
              </div>
              <button className="btn-submit" onClick={handleAddVideo}>إضافة</button>
          </Modal>
      )}

      {/* 3. Add PDF - (Uses native form submission logic in handler) */}
      {modalMode === 'add_pdf' && (
          <Modal title="رفع ملف PDF" onClose={() => setModalMode(null)}>
              <form onSubmit={async (e) => {
                  e.preventDefault();
                  const file = e.target.file.files[0];
                  const title = e.target.title.value;
                  if (!file) return showAlert('error', 'اختر الملف');
                  setLoading(true);
                  const fd = new FormData();
                  fd.append('file', file); fd.append('title', title); fd.append('type', 'pdf'); fd.append('chapterId', selectedChapter.id);
                  const res = await fetch('/api/admin/upload-file', {method:'POST', body:fd});
                  if(res.ok) { fetchContent(); setModalMode(null); showAlert('success', 'تم الرفع'); }
                  setLoading(false);
              }}>
                  <div className="form-group">
                      <label>اسم الملف</label>
                      <input name="title" required placeholder="مثال: ملزمة الشرح" />
                  </div>
                  <div className="form-group">
                      <label>الملف</label>
                      <input type="file" name="file" accept="application/pdf" required />
                  </div>
                  <button type="submit" className="btn-submit">رفع</button>
              </form>
          </Modal>
      )}

      {/* 4. Exam Builder (Full Screen) */}
      {modalMode === 'add_exam' && (
          <div className="fullscreen-modal">
              <div className="builder-container">
                  <div className="builder-header">
                      <h2>{Icons.exam} منشئ الامتحانات</h2>
                      <button className="btn-close" onClick={() => setModalMode(null)}>✕</button>
                  </div>
                  
                  <div className="builder-body">
                      {/* Left: Questions List */}
                      <div className="questions-sidebar">
                          <h4>الأسئلة ({examForm.questions.length})</h4>
                          <div className="q-list">
                              {examForm.questions.map((q, i) => (
                                  <div key={i} className={`q-item ${editingQIndex === i ? 'active' : ''}`} onClick={() => editQuestion(i)}>
                                      <span className="num">{i+1}</span>
                                      <span className="text">{q.text.substring(0, 20)}...</span>
                                      <button className="del" onClick={(e) => { e.stopPropagation(); deleteQuestion(i); }}>×</button>
                                  </div>
                              ))}
                              <button className={`q-item new ${editingQIndex === -1 ? 'active' : ''}`} onClick={() => { setEditingQIndex(-1); setCurrentQ({text:'', image:null, options:['','','',''], correctIndex:0}); }}>
                                  + سؤال جديد
                              </button>
                          </div>
                          <div className="exam-meta">
                              <label>عنوان الامتحان</label>
                              <input value={examForm.title} onChange={e=>setExamForm({...examForm, title: e.target.value})} />
                              <label>المدة (دقيقة)</label>
                              <input type="number" value={examForm.duration} onChange={e=>setExamForm({...examForm, duration: e.target.value})} />
                              <button className="btn-submit" onClick={submitExam}>حفظ الامتحان النهائي</button>
                          </div>
                      </div>

                      {/* Right: Question Editor */}
                      <div className="editor-area">
                          <h3>{editingQIndex === -1 ? 'إضافة سؤال جديد' : `تعديل السؤال رقم ${editingQIndex + 1}`}</h3>
                          
                          <div className="form-group">
                              <textarea 
                                  value={currentQ.text} 
                                  onChange={e=>setCurrentQ({...currentQ, text: e.target.value})} 
                                  placeholder="اكتب نص السؤال هنا..." 
                                  rows="3" 
                              />
                          </div>

                          <div className="upload-box">
                              <label className="btn-outline">
                                  {uploadingImg ? 'جاري الرفع...' : (currentQ.image ? 'تغيير الصورة' : '📸 إرفاق صورة')}
                                  <input type="file" hidden accept="image/*" onChange={handleImageUpload} />
                              </label>
                              {currentQ.image && <div className="img-preview"><img src={`/api/admin/file-proxy?type=exam_images&filename=${currentQ.image}`} alt="preview" /></div>}
                          </div>

                          <div className="options-area">
                              <label>الإجابات (اختر الصحيحة):</label>
                              {currentQ.options.map((opt, i) => (
                                  <div key={i} className={`option-row ${currentQ.correctIndex === i ? 'correct' : ''}`}>
                                      <div className="radio-circle" onClick={() => setCurrentQ({...currentQ, correctIndex: i})}>
                                          {currentQ.correctIndex === i && <div className="dot"></div>}
                                      </div>
                                      <input 
                                          value={opt} 
                                          onChange={e => {
                                              const newOpts = [...currentQ.options];
                                              newOpts[i] = e.target.value;
                                              setCurrentQ({...currentQ, options: newOpts});
                                          }}
                                          placeholder={`الخيار ${i+1}`}
                                      />
                                  </div>
                              ))}
                          </div>

                          <div className="editor-actions">
                              <button className="btn-primary" onClick={saveCurrentQuestion}>
                                  {editingQIndex === -1 ? 'إضافة للقائمة' : 'تحديث السؤال'}
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* 5. Stats Modal */}
      {modalMode === 'view_stats' && examStats && (
          <Modal title="إحصائيات الامتحان" onClose={() => setModalMode(null)}>
              <div className="stats-box">
                  <div><span>المحاولات</span><strong>{examStats.totalAttempts}</strong></div>
                  <div><span>المتوسط</span><strong style={{color:'#facc15'}}>{examStats.averageScore}%</strong></div>
              </div>
              <div className="table-wrapper">
                  <table className="styled-table">
                      <thead><tr><th>الطالب</th><th>الدرجة</th></tr></thead>
                      <tbody>
                          {examStats.attempts.map((a, i) => (
                              <tr key={i}><td>{a.student_name_input}</td><td style={{color: a.score>=50?'#4ade80':'#ef4444'}}>{a.score}%</td></tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </Modal>
      )}

      {/* --- Alerts & Confirms --- */}
      {alertData.show && (
          <div className={`alert-toast ${alertData.type}`}>
              {alertData.type === 'success' ? Icons.check : '!'} {alertData.msg}
          </div>
      )}

      {confirmData.show && (
          <div className="confirm-overlay">
              <div className="confirm-box">
                  <h3>تأكيد</h3>
                  <p>{confirmData.msg}</p>
                  <div className="acts">
                      <button className="btn-cancel" onClick={() => setConfirmData({ ...confirmData, show: false })}>إلغاء</button>
                      <button className="btn-danger" onClick={confirmData.onConfirm}>نعم، حذف</button>
                  </div>
              </div>
          </div>
      )}

      <style jsx>{`
        /* --- General Layout --- */
        .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 1px solid #334155; padding-bottom: 20px; }
        .page-header h1 { margin: 0; color: #38bdf8; font-size: 1.8rem; }
        .subtitle { color: #94a3b8; font-size: 0.95rem; margin-top: 5px; }
        
        .btn-back { background: transparent; border: 1px solid #475569; color: #cbd5e1; padding: 8px 16px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s; }
        .btn-back:hover { background: #334155; color: white; }

        .loader-line { height: 3px; width: 100%; background: #38bdf8; position: fixed; top: 0; left: 0; z-index: 9999; animation: loading 1s infinite; }
        @keyframes loading { 0% { width: 0; } 50% { width: 50%; } 100% { width: 100%; opacity: 0; } }

        /* --- Cards Grid --- */
        .grid-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; }
        .grid-cards.small { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
        
        .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; cursor: pointer; transition: transform 0.2s, border-color 0.2s; position: relative; overflow: hidden; }
        .card:hover { transform: translateY(-4px); border-color: #38bdf8; }
        
        .folder-card { text-align: center; }
        .folder-card .icon-wrapper { width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px; }
        .icon-wrapper.blue { background: rgba(56, 189, 248, 0.1); color: #38bdf8; }
        .icon-wrapper.green { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
        .icon-wrapper.purple { background: rgba(168, 85, 247, 0.1); color: #a855f7; }
        
        .card h3 { margin: 0 0 5px; color: white; font-size: 1.1rem; }
        .card .badge { background: #0f172a; color: #94a3b8; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; }

        /* --- Section Blocks --- */
        .section-block { margin-bottom: 40px; }
        .section-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .section-head h3 { color: #e2e8f0; margin: 0; font-size: 1.2rem; display: flex; align-items: center; gap: 10px; }
        
        .btn-primary { background: #38bdf8; color: #0f172a; border: none; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 6px; }
        .btn-primary:hover { background: #0ea5e9; }

        /* --- List View --- */
        .list-view { display: flex; flex-direction: column; gap: 10px; }
        .list-item { background: #1f2937; padding: 15px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #334155; }
        .list-item .info { cursor: pointer; flex: 1; }
        .list-item strong { display: block; color: white; margin-bottom: 4px; }
        .list-item small { color: #94a3b8; }
        
        .btn-icon { background: rgba(255,255,255,0.05); border: none; width: 32px; height: 32px; border-radius: 6px; color: #cbd5e1; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .btn-icon:hover { background: rgba(255,255,255,0.1); color: white; }
        .btn-icon.danger:hover { background: rgba(239, 68, 68, 0.2); color: #ef4444; }

        /* --- Video & Exam Cards --- */
        .video-card { padding: 0; }
        .video-thumb { height: 120px; background: #0f172a; display: flex; align-items: center; justify-content: center; color: #38bdf8; position: relative; }
        .delete-overlay { position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.6); color: #ef4444; border: none; padding: 5px; border-radius: 4px; cursor: pointer; opacity: 0; transition: 0.2s; }
        .video-card:hover .delete-overlay { opacity: 1; }
        .card-body { padding: 15px; }
        .card-body h4 { margin: 0; font-size: 0.95rem; color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .exam-card { text-align: center; }
        .card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
        .exam-card h4 { margin: 0 0 5px; font-size: 1rem; }
        .exam-card span { font-size: 0.8rem; color: #94a3b8; }

        /* --- Exam Builder (Full Screen) --- */
        .fullscreen-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: #0f172a; z-index: 1000; display: flex; flex-direction: column; }
        .builder-container { display: flex; flex-direction: column; height: 100vh; }
        .builder-header { padding: 15px 30px; background: #1e293b; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; }
        .builder-header h2 { margin: 0; color: white; display: flex; gap: 10px; align-items: center; }
        .btn-close { background: none; border: none; color: #94a3b8; font-size: 1.5rem; cursor: pointer; }
        
        .builder-body { flex: 1; display: flex; overflow: hidden; }
        
        .questions-sidebar { width: 280px; background: #111827; border-left: 1px solid #334155; display: flex; flex-direction: column; }
        .questions-sidebar h4 { padding: 20px; margin: 0; color: #94a3b8; border-bottom: 1px solid #1f2937; }
        .q-list { flex: 1; overflow-y: auto; padding: 10px; }
        .q-item { padding: 12px; margin-bottom: 5px; background: #1f2937; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 10px; color: #cbd5e1; border: 1px solid transparent; }
        .q-item:hover, .q-item.active { background: #334155; border-color: #38bdf8; color: white; }
        .q-item .num { background: #0f172a; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 0.8rem; }
        .q-item .text { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.9rem; }
        .q-item .del { background: none; border: none; color: #ef4444; font-weight: bold; cursor: pointer; opacity: 0; }
        .q-item:hover .del { opacity: 1; }
        .q-item.new { justify-content: center; border: 1px dashed #475569; color: #38bdf8; }

        .exam-meta { padding: 20px; background: #1e293b; border-top: 1px solid #334155; }
        .exam-meta input { width: 100%; background: #0f172a; border: 1px solid #475569; padding: 10px; color: white; margin-bottom: 10px; border-radius: 6px; }
        .exam-meta label { display: block; font-size: 0.85rem; color: #94a3b8; margin-bottom: 5px; }
        .btn-submit { width: 100%; background: #22c55e; color: #0f172a; padding: 12px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; }

        .editor-area { flex: 1; padding: 30px; overflow-y: auto; background: #0f172a; }
        .editor-area h3 { color: #38bdf8; margin-top: 0; }
        .form-group textarea { width: 100%; background: #1e293b; border: 1px solid #334155; padding: 15px; color: white; border-radius: 8px; font-size: 1.1rem; resize: vertical; }
        
        .upload-box { margin: 20px 0; }
        .btn-outline { border: 1px dashed #475569; padding: 10px 20px; border-radius: 6px; color: #94a3b8; cursor: pointer; display: inline-block; }
        .img-preview img { max-height: 150px; margin-top: 10px; border-radius: 8px; border: 1px solid #334155; }

        .options-area { margin-top: 20px; }
        .option-row { display: flex; align-items: center; gap: 15px; margin-bottom: 12px; background: #1e293b; padding: 10px; border-radius: 8px; border: 1px solid transparent; transition: 0.2s; }
        .option-row.correct { border-color: #22c55e; background: rgba(34, 197, 94, 0.05); }
        .radio-circle { width: 24px; height: 24px; border: 2px solid #475569; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .option-row.correct .radio-circle { border-color: #22c55e; }
        .dot { width: 12px; height: 12px; background: #22c55e; border-radius: 50%; }
        .option-row input { flex: 1; background: transparent; border: none; color: white; outline: none; font-size: 1rem; }

        .editor-actions { margin-top: 30px; padding-top: 20px; border-top: 1px solid #1e293b; text-align: left; }

        /* --- Modals & Alerts --- */
        .alert-toast { position: fixed; bottom: 30px; left: 30px; padding: 15px 25px; border-radius: 8px; color: white; font-weight: bold; z-index: 2000; box-shadow: 0 10px 30px rgba(0,0,0,0.5); display: flex; gap: 10px; align-items: center; animation: slideUp 0.3s; }
        .alert-toast.success { background: #22c55e; color: #0f172a; }
        .alert-toast.error { background: #ef4444; }

        .confirm-overlay { position: fixed; top:0; left:0; right:0; bottom:0; background: rgba(0,0,0,0.8); z-index: 2000; display: flex; align-items: center; justify-content: center; }
        .confirm-box { background: #1e293b; padding: 30px; border-radius: 12px; width: 400px; text-align: center; border: 1px solid #475569; }
        .confirm-box h3 { color: #ef4444; margin-top: 0; }
        .confirm-box p { color: #cbd5e1; }
        .acts { display: flex; gap: 10px; justify-content: center; margin-top: 20px; }
        .btn-cancel { background: transparent; border: 1px solid #475569; color: #94a3b8; padding: 8px 20px; border-radius: 6px; cursor: pointer; }
        .btn-danger { background: #ef4444; color: white; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; }

        @keyframes slideUp { from { transform: translateY(50px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </AdminLayout>
  );
}

// Modal Component
const Modal = ({ title, children, onClose }) => (
    <div className="confirm-overlay" onClick={onClose}>
        <div className="confirm-box" style={{width:'500px', textAlign:'right'}} onClick={e => e.stopPropagation()}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                <h3 style={{margin:0, color:'white'}}>{title}</h3>
                <button onClick={onClose} style={{background:'none', border:'none', color:'#94a3b8', fontSize:'1.2rem', cursor:'pointer'}}>✕</button>
            </div>
            {children}
        </div>
        <style jsx>{`
            .form-group { margin-bottom: 15px; }
            .form-group label { display: block; color: #94a3b8; margin-bottom: 5px; font-size: 0.9rem; }
            .form-group input { width: 100%; background: #0f172a; border: 1px solid #334155; padding: 10px; border-radius: 6px; color: white; }
            .stats-box { display: flex; justify-content: space-around; margin-bottom: 20px; background: #0f172a; padding: 15px; border-radius: 8px; }
            .stats-box span { display: block; color: #94a3b8; font-size: 0.8rem; }
            .stats-box strong { font-size: 1.5rem; color: white; }
            .table-wrapper { max-height: 300px; overflow-y: auto; }
            .styled-table { width: 100%; border-collapse: collapse; }
            .styled-table th { text-align: right; color: #94a3b8; padding: 10px; border-bottom: 1px solid #334155; }
            .styled-table td { padding: 10px; border-bottom: 1px solid #334155; color: white; }
        `}</style>
    </div>
);
