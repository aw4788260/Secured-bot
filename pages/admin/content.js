import AdminLayout from '../../components/AdminLayout';
import { useState, useEffect } from 'react';

// --- أيقونات SVG أنيقة ---
const Icons = {
    back: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>,
    add: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
    trash: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
    edit: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>,
    video: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>,
    pdf: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f472b6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
    exam: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M9 15l2 2 4-4"></path></svg>,
    folder: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>,
    close: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
    image: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
};

export default function ContentManager() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Navigation
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);

  // Modals & UI
  const [modalType, setModalType] = useState(null); 
  const [formData, setFormData] = useState({ title: '', url: '' });
  const [alertData, setAlertData] = useState({ show: false, type: 'info', msg: '' });
  const [confirmData, setConfirmData] = useState({ show: false, msg: '', onConfirm: null });

  // Exam Builder
  const [examForm, setExamForm] = useState({
      id: null, title: '', duration: 30, requiresName: true, randQ: true, randO: true, questions: []
  });
  const [currentQ, setCurrentQ] = useState({ id: null, text: '', image: null, options: ['', '', '', ''], correctIndex: 0 });
  const [editingQIndex, setEditingQIndex] = useState(-1);
  const [deletedQIds, setDeletedQIds] = useState([]);
  const [uploadingImg, setUploadingImg] = useState(false);
  
  // Stats
  const [examStats, setExamStats] = useState(null);

  // --- Initial Fetch ---
  const fetchContent = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/manage-content');
        const data = await res.json();
        setCourses(data);
        
        // Refresh local view
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

  // --- Logic ---
  const openModal = (type, data = {}) => {
      setFormData({ title: '', url: '' });
      if (type === 'exam_editor') {
          if (data.id) {
              setExamForm({
                  id: data.id,
                  title: data.title,
                  duration: data.duration_minutes,
                  requiresName: data.requires_student_name,
                  randQ: data.randomize_questions,
                  randO: data.randomize_options,
                  questions: data.questions.map(q => ({
                      id: q.id,
                      text: q.question_text,
                      image: q.image_file_id,
                      options: q.options.map(o => o.option_text),
                      correctIndex: q.options.findIndex(o => o.is_correct)
                  }))
              });
          } else {
              setExamForm({ id: null, title: '', duration: 30, requiresName: true, randQ: true, randO: true, questions: [] });
          }
          setDeletedQIds([]);
          setEditingQIndex(-1);
          setCurrentQ({ id: null, text: '', image: null, options: ['', '', '', ''], correctIndex: 0 });
      }
      setModalType(type);
  };

  const apiCall = async (action, payload) => {
      setLoading(true);
      const res = await fetch('/api/admin/manage-content', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ action, payload })
      });
      if (res.ok) { fetchContent(); setModalType(null); }
      else { showAlert('error', 'حدث خطأ أثناء التنفيذ'); }
      setLoading(false);
  };

  const handleDelete = (type, id) => showConfirm('هل أنت متأكد من الحذف؟', () => apiCall('delete_item', { type, id }));

  // --- Exam Logic ---
  const handleImageUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setUploadingImg(true);
      const fd = new FormData();
      fd.append('file', file); fd.append('type', 'exam_image');
      const res = await fetch('/api/admin/upload-file', {method:'POST', body:fd});
      const data = await res.json();
      if(res.ok) setCurrentQ({...currentQ, image: data.fileName});
      setUploadingImg(false);
  };

  const saveQuestion = () => {
      if (!currentQ.text) return showAlert('error', 'نص السؤال مطلوب');
      const newQs = [...examForm.questions];
      if (editingQIndex >= 0) newQs[editingQIndex] = currentQ;
      else newQs.push(currentQ);
      
      setExamForm({ ...examForm, questions: newQs });
      setEditingQIndex(-1);
      setCurrentQ({ id: null, text: '', image: null, options: ['', '', '', ''], correctIndex: 0 });
  };

  const editQuestion = (i) => {
      setCurrentQ(examForm.questions[i]);
      setEditingQIndex(i);
  };

  const deleteQuestion = (i) => {
      const q = examForm.questions[i];
      if (q.id) setDeletedQIds([...deletedQIds, q.id]);
      setExamForm({ ...examForm, questions: examForm.questions.filter((_, idx) => idx !== i) });
      if (editingQIndex === i) {
          setEditingQIndex(-1);
          setCurrentQ({ id: null, text: '', image: null, options: ['', '', '', ''], correctIndex: 0 });
      }
  };

  const submitExam = async () => {
      if(!examForm.title || examForm.questions.length === 0) return showAlert('error', 'البيانات ناقصة');
      await apiCall('save_exam', {
          id: examForm.id,
          subjectId: selectedSubject.id,
          title: examForm.title,
          duration: examForm.duration,
          requiresName: examForm.requiresName,
          randQ: examForm.randQ,
          randO: examForm.randO,
          questions: examForm.questions,
          deletedQuestionIds: deletedQIds
      });
  };

  const loadStats = async (examId) => {
      setLoading(true);
      const res = await fetch(`/api/admin/exam-stats?examId=${examId}`);
      if(res.ok) {
          setExamStats(await res.json());
          setModalType('stats');
      } else {
          showAlert('error', 'فشل جلب الإحصائيات');
      }
      setLoading(false);
  };

  // --- Render ---
  return (
    <AdminLayout title="المحتوى">
      <div className="header-bar">
          <div>
              <h1>🗂️ إدارة المحتوى</h1>
              <div className="breadcrumbs">
                  <span onClick={() => {setSelectedCourse(null); setSelectedSubject(null); setSelectedChapter(null);}}>الرئيسية</span>
                  {selectedCourse && <span> / {selectedCourse.title}</span>}
                  {selectedSubject && <span> / {selectedSubject.title}</span>}
                  {selectedChapter && <span> / {selectedChapter.title}</span>}
              </div>
          </div>
          {(selectedCourse || selectedSubject || selectedChapter) && (
              <button className="btn-secondary" onClick={handleBack}>{Icons.back} رجوع</button>
          )}
      </div>

      {loading && <div className="loader-line"></div>}

      {/* 1. Courses View */}
      {!selectedCourse && (
          <div className="grid-cards">
              {courses.map(c => (
                  <div key={c.id} className="card folder-card" onClick={() => setSelectedCourse(c)}>
                      <div className="icon blue">{Icons.folder}</div>
                      <h3>{c.title}</h3>
                      <p>{c.subjects.length} مواد</p>
                  </div>
              ))}
          </div>
      )}

      {/* 2. Subjects View */}
      {selectedCourse && !selectedSubject && (
          <div className="grid-cards">
              {selectedCourse.subjects.map(s => (
                  <div key={s.id} className="card folder-card" onClick={() => setSelectedSubject(s)}>
                      <div className="icon green">{Icons.folder}</div>
                      <h3>{s.title}</h3>
                      <p>{s.chapters.length} فصول • {s.exams.length} امتحانات</p>
                  </div>
              ))}
          </div>
      )}

      {/* 3. Subject Details */}
      {selectedSubject && !selectedChapter && (
          <div className="content-layout">
              <div className="panel">
                  <div className="panel-head">
                      <h3>📂 الفصول الدراسية</h3>
                      <button className="btn-small" onClick={() => openModal('add_chapter')}>{Icons.add} إضافة</button>
                  </div>
                  <div className="list-group">
                      {selectedSubject.chapters.length === 0 && <div className="empty">لا توجد فصول</div>}
                      {selectedSubject.chapters.map(ch => (
                          <div key={ch.id} className="list-item clickable" onClick={() => setSelectedChapter(ch)}>
                              <div className="info"><strong>{ch.title}</strong><small>{ch.videos.length} فيديو</small></div>
                              <button className="btn-icon danger" onClick={(e) => {e.stopPropagation(); handleDelete('chapters', ch.id)}}>{Icons.trash}</button>
                          </div>
                      ))}
                  </div>
              </div>

              <div className="panel">
                  <div className="panel-head">
                      <h3>📝 الامتحانات</h3>
                      <button className="btn-small" onClick={() => openModal('exam_editor')}> {Icons.add} إنشاء</button>
                  </div>
                  <div className="exam-grid">
                      {selectedSubject.exams.length === 0 && <div className="empty">لا توجد امتحانات</div>}
                      {selectedSubject.exams.map(ex => (
                          <div key={ex.id} className="exam-card-item">
                              <div className="exam-icon">{Icons.exam}</div>
                              <div className="exam-info"><h4>{ex.title}</h4><span>{ex.duration_minutes} دقيقة</span></div>
                              <div className="exam-actions">
                                  <button title="إحصائيات" onClick={() => loadStats(ex.id)}>📊</button>
                                  <button title="تعديل" onClick={() => openModal('exam_editor', ex)}>{Icons.edit}</button>
                                  <button title="حذف" className="danger" onClick={() => handleDelete('exams', ex.id)}>{Icons.trash}</button>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* 4. Chapter Content */}
      {selectedChapter && (
          <div className="content-layout">
              <div className="panel">
                  <div className="panel-head">
                      <h3>🎬 الفيديوهات</h3>
                      <button className="btn-small" onClick={() => openModal('add_video')}> {Icons.add} إضافة</button>
                  </div>
                  <div className="media-grid">
                      {selectedChapter.videos.map(v => (
                          <div key={v.id} className="media-card">
                              <div className="thumb">{Icons.video}</div>
                              <div className="media-body">
                                  <h4>{v.title}</h4>
                                  <button className="btn-icon danger" onClick={() => handleDelete('videos', v.id)}>{Icons.trash}</button>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>

              <div className="panel">
                  <div className="panel-head">
                      <h3>📄 الملفات</h3>
                      <button className="btn-small" onClick={() => openModal('add_pdf')}> {Icons.add} رفع</button>
                  </div>
                  <div className="list-group">
                      {selectedChapter.pdfs.map(p => (
                          <div key={p.id} className="list-item">
                              <div className="info"><span className="icon-text">{Icons.pdf}</span><strong>{p.title}</strong></div>
                              <button className="btn-icon danger" onClick={() => handleDelete('pdfs', p.id)}>{Icons.trash}</button>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* --- Modals --- */}

      {/* Add Chapter */}
      {modalType === 'add_chapter' && (
          <Modal title="فصل جديد" onClose={() => setModalType(null)}>
              <input className="input" placeholder="عنوان الفصل" value={formData.title} onChange={e=>setFormData({...formData, title: e.target.value})} autoFocus />
              <button className="btn-primary full" onClick={() => apiCall('add_chapter', { subjectId: selectedSubject.id, title: formData.title })}>حفظ</button>
          </Modal>
      )}

      {/* Add Video */}
      {modalType === 'add_video' && (
          <Modal title="إضافة فيديو" onClose={() => setModalType(null)}>
              <input className="input" placeholder="عنوان الفيديو" value={formData.title} onChange={e=>setFormData({...formData, title: e.target.value})} />
              <input className="input" placeholder="رابط يوتيوب" value={formData.url} onChange={e=>setFormData({...formData, url: e.target.value})} dir="ltr" />
              <button className="btn-primary full" onClick={() => apiCall('add_video', { chapterId: selectedChapter.id, title: formData.title, url: formData.url })}>إضافة</button>
          </Modal>
      )}

      {/* Add PDF */}
      {modalType === 'add_pdf' && (
          <Modal title="رفع ملف PDF" onClose={() => setModalType(null)}>
              <form onSubmit={async (e) => {
                  e.preventDefault();
                  const file = e.target.file.files[0];
                  if(!file) return showAlert('error', 'اختر الملف');
                  setLoading(true);
                  const fd = new FormData();
                  fd.append('file', file); fd.append('title', e.target.title.value); fd.append('type', 'pdf'); fd.append('chapterId', selectedChapter.id);
                  const res = await fetch('/api/admin/upload-file', {method:'POST', body:fd});
                  if(res.ok) { fetchContent(); setModalType(null); }
                  setLoading(false);
              }}>
                  <input className="input" name="title" placeholder="اسم الملف" required />
                  <input className="input file" type="file" name="file" accept="application/pdf" required />
                  <button type="submit" className="btn-primary full">رفع</button>
              </form>
          </Modal>
      )}

      {/* Exam Editor (Fixed Dimensions) */}
      {modalType === 'exam_editor' && (
          <div className="modal-overlay">
              <div className="modal-box large">
                  <div className="modal-header">
                      <h3>{examForm.id ? 'تعديل الامتحان' : 'إنشاء امتحان جديد'}</h3>
                      <button onClick={() => setModalType(null)}>{Icons.close}</button>
                  </div>
                  <div className="modal-body split-view">
                      
                      <div className="sidebar">
                          <div className="meta-group">
                              <input className="input" placeholder="عنوان الامتحان" value={examForm.title} onChange={e=>setExamForm({...examForm, title: e.target.value})} />
                              <div className="row">
                                  <input className="input" type="number" placeholder="دقيقة" value={examForm.duration} onChange={e=>setExamForm({...examForm, duration: e.target.value})} style={{width: '80px'}} />
                                  <label className="checkbox"><input type="checkbox" checked={examForm.requiresName} onChange={e=>setExamForm({...examForm, requiresName: e.target.checked})} /> اسم الطالب</label>
                              </div>
                              <div className="row">
                                  <label className="checkbox"><input type="checkbox" checked={examForm.randQ} onChange={e=>setExamForm({...examForm, randQ: e.target.checked})} /> عشوائية الأسئلة</label>
                                  <label className="checkbox"><input type="checkbox" checked={examForm.randO} onChange={e=>setExamForm({...examForm, randO: e.target.checked})} /> عشوائية الإجابات</label>
                              </div>
                          </div>
                          
                          <div className="questions-list">
                              <h4>الأسئلة ({examForm.questions.length})</h4>
                              {examForm.questions.map((q, i) => (
                                  <div key={i} className={`q-item ${editingQIndex === i ? 'active' : ''}`} onClick={() => editQuestion(i)}>
                                      <span>{i+1}. {q.text.substring(0, 20)}...</span>
                                      <button className="del-btn" onClick={(e) => { e.stopPropagation(); deleteQuestion(i); }}>×</button>
                                  </div>
                              ))}
                              <button className="add-q-btn" onClick={() => { setEditingQIndex(-1); setCurrentQ({id:null, text:'', image:null, options:['','','',''], correctIndex:0}); }}>+ سؤال جديد</button>
                          </div>
                      </div>

                      <div className="editor">
                          <h4>{editingQIndex === -1 ? 'سؤال جديد' : `تعديل السؤال ${editingQIndex + 1}`}</h4>
                          <textarea className="input area" placeholder="نص السؤال" value={currentQ.text} onChange={e=>setCurrentQ({...currentQ, text: e.target.value})} rows="3"></textarea>
                          
                          <div className="image-upload">
                              <label>
                                  {Icons.image} {currentQ.image ? 'تغيير الصورة' : 'إرفاق صورة'}
                                  <input type="file" hidden accept="image/*" onChange={handleImageUpload} />
                              </label>
                              {uploadingImg && <span className="loading-text">جاري الرفع...</span>}
                              {currentQ.image && <img src={`/api/admin/file-proxy?type=exam_images&filename=${currentQ.image}`} alt="preview" />}
                          </div>

                          <div className="options-container">
                              {currentQ.options.map((opt, i) => (
                                  <div key={i} className={`option-row ${currentQ.correctIndex === i ? 'correct' : ''}`}>
                                      <div className="radio" onClick={() => setCurrentQ({...currentQ, correctIndex: i})}></div>
                                      <input className="input small" value={opt} onChange={e => {
                                          const newOpts = [...currentQ.options]; newOpts[i] = e.target.value;
                                          setCurrentQ({...currentQ, options: newOpts});
                                      }} placeholder={`الخيار ${i+1}`} />
                                  </div>
                              ))}
                          </div>
                          
                          <button className="btn-primary full" onClick={saveQuestion}>{editingQIndex === -1 ? 'إضافة للقائمة' : 'تحديث السؤال'}</button>
                      </div>
                  </div>
                  <div className="modal-footer">
                      <button className="btn-primary" onClick={submitExam}>حفظ الامتحان النهائي</button>
                  </div>
              </div>
          </div>
      )}

      {/* Stats Modal */}
      {modalType === 'stats' && examStats && (
          <Modal title="الإحصائيات" onClose={() => setModalType(null)}>
              <div className="stats-summary">
                  <div className="stat-card"><span>الطلاب</span><strong>{examStats.totalAttempts}</strong></div>
                  <div className="stat-card"><span>المتوسط</span><strong style={{color:'#facc15'}}>{examStats.averageScore}%</strong></div>
              </div>
              <div className="table-wrap">
                  <table>
                      <thead><tr><th>الطالب</th><th>الدرجة</th><th>التاريخ</th></tr></thead>
                      <tbody>
                          {examStats.attempts.map((a, i) => (
                              <tr key={i}>
                                  <td>{a.student_name_input}</td>
                                  <td style={{color: a.score >= 50 ? '#4ade80' : '#ef4444'}}>{a.score}%</td>
                                  <td>{new Date(a.completed_at).toLocaleDateString()}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </Modal>
      )}

      {/* Alerts */}
      {alertData.show && <div className={`alert-toast ${alertData.type}`}>{alertData.msg}</div>}
      {confirmData.show && <div className="confirm-overlay"><div className="confirm-box"><h3>تأكيد</h3><p>{confirmData.msg}</p><div className="acts"><button onClick={() => setConfirmData({ ...confirmData, show: false })}>إلغاء</button><button className="danger" onClick={confirmData.onConfirm}>نعم</button></div></div></div>}

      <style jsx>{`
        /* General */
        .header-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; border-bottom: 1px solid #334155; padding-bottom: 15px; }
        .header-bar h1 { margin: 0 0 5px 0; color: #38bdf8; font-size: 1.6rem; }
        .breadcrumbs { color: #94a3b8; font-size: 0.9rem; cursor: pointer; }
        .btn-secondary { background: #1e293b; color: #cbd5e1; border: 1px solid #334155; padding: 8px 16px; border-radius: 8px; cursor: pointer; display: flex; gap: 5px; }
        .loader-line { height: 3px; background: #38bdf8; width: 100%; position: fixed; top: 0; left: 0; z-index: 9999; }

        /* Grids & Cards */
        .grid-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px; }
        .folder-card { background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155; text-align: center; cursor: pointer; transition: 0.2s; }
        .folder-card:hover { transform: translateY(-4px); border-color: #38bdf8; }
        .folder-card .icon { width: 50px; height: 50px; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; }
        .folder-card .icon.blue { background: rgba(56, 189, 248, 0.1); color: #38bdf8; }
        .folder-card .icon.green { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
        
        /* Layout */
        .content-layout { display: grid; grid-template-columns: 1fr; gap: 30px; }
        .panel { background: #111827; border-radius: 12px; }
        .panel-head { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1f2937; padding-bottom: 15px; margin-bottom: 15px; }
        .panel-head h3 { margin: 0; color: white; font-size: 1.2rem; }
        .btn-small { background: #38bdf8; color: #0f172a; padding: 6px 12px; border-radius: 6px; border: none; font-weight: bold; cursor: pointer; display: flex; gap: 5px; }

        /* Lists & Items */
        .list-group { display: flex; flex-direction: column; gap: 10px; }
        .list-item { background: #1e293b; padding: 15px; border-radius: 8px; border: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; }
        .list-item.clickable { cursor: pointer; transition: 0.2s; }
        .list-item.clickable:hover { border-color: #38bdf8; }
        .list-item .info strong { display: block; color: white; }
        .list-item .info small { color: #94a3b8; }
        .btn-icon { background: rgba(255,255,255,0.05); width: 32px; height: 32px; border-radius: 6px; border: none; color: #cbd5e1; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .btn-icon:hover { background: rgba(255,255,255,0.1); color: white; }
        .btn-icon.danger:hover { background: rgba(239, 68, 68, 0.2); color: #ef4444; }

        /* Media & Exam Grids */
        .exam-grid, .media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px; }
        
        .exam-card-item { background: #1e293b; padding: 15px; border-radius: 8px; border: 1px solid #334155; display: flex; align-items: center; gap: 15px; }
        .exam-icon { color: #facc15; background: rgba(250, 204, 21, 0.1); padding: 10px; border-radius: 8px; }
        .exam-info h4 { margin: 0; color: white; font-size: 1rem; }
        .exam-info span { font-size: 0.8rem; color: #94a3b8; }
        .exam-actions { display: flex; gap: 5px; }
        .exam-actions button { background: #334155; border: none; padding: 5px; border-radius: 4px; color: #cbd5e1; cursor: pointer; }
        .exam-actions button:hover { background: #38bdf8; color: #0f172a; }
        .exam-actions button.danger:hover { background: #ef4444; color: white; }

        .media-card { background: #1e293b; border-radius: 8px; overflow: hidden; border: 1px solid #334155; }
        .media-card .thumb { height: 100px; background: #0f172a; display: flex; align-items: center; justify-content: center; color: #38bdf8; }
        .media-card.file .thumb { color: #f472b6; }
        .media-body { padding: 10px; display: flex; justify-content: space-between; align-items: center; }
        .media-body h4 { margin: 0; font-size: 0.9rem; color: white; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px; }

        /* --- Modals (Fixed & Centered) --- */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 2000; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(2px); }
        .modal-box { background: #1e293b; width: 90%; max-width: 450px; border-radius: 12px; border: 1px solid #475569; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
        .modal-box.large { max-width: 900px; height: 90vh; display: flex; flex-direction: column; }
        
        .modal-header { background: #1e293b; padding: 15px 20px; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; }
        .modal-header h3 { margin: 0; color: white; }
        .modal-header button { background: none; border: none; color: #94a3b8; cursor: pointer; }
        
        .modal-body { padding: 20px; overflow-y: auto; flex: 1; }
        .modal-body.split-view { display: flex; padding: 0; }
        
        .input { width: 100%; background: #0f172a; border: 1px solid #334155; color: white; padding: 10px; border-radius: 6px; margin-bottom: 15px; }
        .input.small { margin-bottom: 0; }
        .input.area { resize: vertical; }
        .btn-primary { background: #38bdf8; color: #0f172a; border: none; padding: 10px; border-radius: 6px; font-weight: bold; cursor: pointer; }
        .btn-primary.full { width: 100%; }

        /* Exam Editor Layout */
        .sidebar { width: 300px; background: #111827; border-left: 1px solid #334155; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; }
        .editor { flex: 1; background: #0f172a; padding: 30px; overflow-y: auto; }
        
        .meta-group { border-bottom: 1px solid #334155; padding-bottom: 15px; margin-bottom: 15px; }
        .meta-group .row { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; }
        .checkbox { color: #cbd5e1; font-size: 0.85rem; display: flex; align-items: center; gap: 5px; cursor: pointer; }
        
        .questions-list h4 { color: #94a3b8; margin: 0 0 10px; font-size: 0.9rem; }
        .q-item { padding: 10px; background: #1f2937; border-radius: 6px; margin-bottom: 8px; cursor: pointer; display: flex; justify-content: space-between; color: #cbd5e1; font-size: 0.9rem; }
        .q-item:hover, .q-item.active { background: #334155; border-color: #38bdf8; color: white; outline: 1px solid #38bdf8; }
        .del-btn { background: none; border: none; color: #ef4444; font-weight: bold; cursor: pointer; }
        .add-q-btn { width: 100%; padding: 8px; background: transparent; border: 1px dashed #475569; color: #38bdf8; border-radius: 6px; cursor: pointer; margin-top: 10px; }

        .image-upload { margin: 15px 0; }
        .image-upload label { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; color: #94a3b8; background: #1e293b; padding: 6px 12px; border-radius: 6px; font-size: 0.9rem; border: 1px solid #334155; }
        .image-upload img { max-height: 100px; margin-top: 10px; border-radius: 6px; border: 1px solid #334155; display: block; }

        .options-container { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px; margin-bottom: 20px; }
        .option-row { display: flex; align-items: center; gap: 10px; background: #1e293b; padding: 10px; border-radius: 8px; border: 1px solid transparent; }
        .option-row.correct { border-color: #22c55e; background: rgba(34, 197, 94, 0.05); }
        .radio { width: 20px; height: 20px; border: 2px solid #475569; border-radius: 50%; cursor: pointer; }
        .option-row.correct .radio { border-color: #22c55e; background: #22c55e; }

        .modal-footer { padding: 15px; border-top: 1px solid #334155; background: #1e293b; text-align: left; }

        /* Stats & Alerts */
        .stats-summary { display: flex; gap: 20px; margin-bottom: 20px; }
        .stat-card { flex: 1; background: #0f172a; padding: 15px; border-radius: 8px; text-align: center; }
        .stat-card strong { display: block; color: white; font-size: 1.4rem; }
        .table-wrap { max-height: 300px; overflow-y: auto; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: right; padding: 10px; color: #94a3b8; border-bottom: 1px solid #334155; }
        td { padding: 10px; color: white; border-bottom: 1px solid #334155; }

        .alert-toast { position: fixed; bottom: 30px; left: 30px; padding: 15px 25px; border-radius: 8px; color: white; font-weight: bold; z-index: 3000; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .alert-toast.success { background: #22c55e; color: #0f172a; }
        .alert-toast.error { background: #ef4444; }

        .confirm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 2500; display: flex; align-items: center; justify-content: center; }
        .confirm-box { background: #1e293b; padding: 30px; border-radius: 12px; width: 350px; text-align: center; border: 1px solid #475569; }
        .confirm-box h3 { color: #ef4444; margin-top: 0; }
        .confirm-box p { color: #cbd5e1; }
        .acts { display: flex; gap: 10px; justify-content: center; margin-top: 20px; }
        .acts button { padding: 8px 20px; border-radius: 6px; cursor: pointer; border: none; font-weight: bold; }
        .acts button.danger { background: #ef4444; color: white; }
      `}</style>
    </AdminLayout>
  );
}

// Modal Component
const Modal = ({ title, children, onClose }) => (
    <div className="modal-overlay" onClick={onClose}>
        <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
                <h3>{title}</h3>
                <button onClick={onClose}>✕</button>
            </div>
            <div style={{padding:'20px'}}>
                {children}
            </div>
        </div>
    </div>
);
