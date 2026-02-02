import TeacherLayout from '../../components/TeacherLayout';
import { useState, useEffect, useRef } from 'react';

// --- مكتبة الأيقونات (SVG Icons) ---
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
    image: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
    menu: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>,
    drag: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
};

export default function ContentManager() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Navigation State
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);

  // UI States
  const [modalType, setModalType] = useState(null); 
  const [formData, setFormData] = useState({ title: '', url: '', price: 0 });
  const [alertData, setAlertData] = useState({ show: false, type: 'info', msg: '' });
  const [confirmData, setConfirmData] = useState({ show: false, msg: '', onConfirm: null });
  
  // Drag & Drop Refs
  const dragItem = useRef();
  const dragOverItem = useRef();

  // Exam Editor States
  const [showExamSidebar, setShowExamSidebar] = useState(false);
  const [examForm, setExamForm] = useState({ id: null, title: '', duration: 30, requiresName: true, randQ: true, randO: true, questions: [] });
  const [currentQ, setCurrentQ] = useState({ id: null, text: '', image: null, options: ['', '', '', ''], correctIndex: 0 });
  const [editingQIndex, setEditingQIndex] = useState(-1);
  const [deletedQIds, setDeletedQIds] = useState([]);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [examStats, setExamStats] = useState(null);

  // ==========================================================
  // 1. جلب البيانات (Fetch Data)
  // ==========================================================
  const fetchContent = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/dashboard/teacher/content');
        const data = await res.json();
        
        // التحقق من صحة البيانات القادمة من API
        const items = data.courses || [];
        setCourses(items);
        
        // تحديث الحالة الداخلية (State Refresh) للحفاظ على التزامن عند التعديل
        if (selectedCourse) {
            const updatedC = items.find(c => c.id === selectedCourse.id);
            setSelectedCourse(updatedC);
            if (selectedSubject && updatedC) {
                const updatedS = updatedC.subjects?.find(s => s.id === selectedSubject.id);
                setSelectedSubject(updatedS);
                if (selectedChapter && updatedS) {
                    const updatedCh = updatedS.chapters?.find(ch => ch.id === selectedChapter.id);
                    setSelectedChapter(updatedCh);
                }
            }
        }
      } catch (err) { showAlert('error', 'فشل الاتصال بالسيرفر'); }
      setLoading(false);
  };

  useEffect(() => { 
      window.scrollTo(0, 0);
      fetchContent(); 
  }, []);

  // ==========================================================
  // 2. إدارة التنبيهات والتأكيدات (Alerts & Confirms)
  // ==========================================================
  const showAlert = (type, msg) => {
      setAlertData({ show: true, type, msg });
      setTimeout(() => setAlertData({ ...alertData, show: false }), 3000);
  };

  const showConfirm = (msg, action) => {
      setConfirmData({ show: true, msg, onConfirm: action });
  };

  const closeConfirm = () => {
      setConfirmData({ show: false, msg: '', onConfirm: null });
  };

  const handleBack = async () => {
      await fetchContent(); 
      if (selectedChapter) setSelectedChapter(null);
      else if (selectedSubject) setSelectedSubject(null);
      else if (selectedCourse) setSelectedCourse(null);
  };

  // ==========================================================
  // 3. السحب والإفلات (Drag & Drop)
  // ==========================================================
  const onDragStart = (e, index) => {
      dragItem.current = index;
      e.target.closest('.draggable-item').classList.add('dragging');
  };

  const onDragEnter = (e, index) => {
      dragOverItem.current = index;
  };

  const onDragEnd = async (e, listType) => { 
      e.target.closest('.draggable-item').classList.remove('dragging');
      
      let list = [];
      if (listType === 'courses') list = [...courses];
      else if (listType === 'subjects') list = [...selectedCourse.subjects];
      else if (listType === 'chapters') list = [...selectedSubject.chapters];
      else if (listType === 'exams') list = [...selectedSubject.exams]; 
      else if (listType === 'videos') list = [...selectedChapter.videos];
      else if (listType === 'pdfs') list = [...selectedChapter.pdfs];

      if (!list.length || dragItem.current === null || dragOverItem.current === null) return;

      const draggedItemContent = list[dragItem.current];
      list.splice(dragItem.current, 1);
      list.splice(dragOverItem.current, 0, draggedItemContent);

      dragItem.current = null;
      dragOverItem.current = null;

      // تحديث الواجهة فورياً
      if (listType === 'courses') setCourses(list);
      else if (listType === 'subjects') setSelectedCourse({ ...selectedCourse, subjects: list });
      else if (listType === 'chapters') setSelectedSubject({ ...selectedSubject, chapters: list });
      else if (listType === 'videos') setSelectedChapter({ ...selectedChapter, videos: list });
      else if (listType === 'pdfs') setSelectedChapter({ ...selectedChapter, pdfs: list });

      // إرسال الترتيب الجديد للسيرفر
      const updatedItems = list.map((item, index) => ({ id: item.id, sort_order: index }));
      try {
          await fetch('/api/dashboard/teacher/reorder', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ type: listType, items: updatedItems })
          });
      } catch (err) {
          console.error("Reorder failed", err);
      }
  };

  // ==========================================================
  // 4. تنفيذ العمليات (API Calls)
  // ==========================================================
  const apiCall = async (action, type, dataPayload) => {
      setLoading(true);
      try {
          const res = await fetch('/api/dashboard/teacher/content', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              // البنية المطابقة لملف content.js الجديد
              body: JSON.stringify({ action, type, data: dataPayload })
          });
          const data = await res.json();
          if (res.ok) { 
              await fetchContent(); 
              setModalType(null); 
              showAlert('success', 'تمت العملية بنجاح 🎉'); 
          } else { 
              showAlert('error', data.error || 'حدث خطأ غير متوقع ⚠️'); 
          }
      } catch (e) { showAlert('error', 'خطأ في الاتصال 🌐'); }
      setLoading(false);
  };

  // دالة الحذف الذكية
  const handleDelete = (type, id) => showConfirm('⚠️ هل أنت متأكد من الحذف النهائي؟ لا يمكن التراجع.', async () => {
      await apiCall('delete', type, { id }); 
      closeConfirm();
      // إعادة ضبط التحديد إذا تم حذف العنصر المفتوح حالياً
      if(type === 'courses' && selectedCourse?.id === id) setSelectedCourse(null);
      if(type === 'subjects' && selectedSubject?.id === id) setSelectedSubject(null);
      if(type === 'chapters' && selectedChapter?.id === id) setSelectedChapter(null);
  });

  // ==========================================================
  // 5. إدارة النوافذ المنبثقة (Modals)
  // ==========================================================
  const openModal = (type, data = {}) => {
      setFormData({ title: '', url: '', price: 0 }); 
      
      if (['edit_course', 'edit_subject', 'edit_chapter'].includes(type)) {
          setFormData({ 
              title: data.title || '', 
              url: '', 
              price: data.price || 0 
          });
      }

      if (type === 'exam_editor') {
          if (data.id && data.attempts_count > 0) {
              showAlert('error', '⛔ لا يمكن تعديل هذا الامتحان لأنه تم حله من قبل طلاب مسبقاً.');
              return; 
          }

          setShowExamSidebar(false);
          if (data.id) {
              // تحميل بيانات الامتحان الموجود
              setExamForm({
                  id: data.id, title: data.title, duration: data.duration_minutes,
                  requiresName: data.requires_student_name, randQ: data.randomize_questions,
                  randO: data.randomize_options,
                  questions: data.questions ? data.questions.map(q => ({
                      id: q.id, text: q.question_text, image: q.image_file_id,
                      options: q.options.map(o => o.option_text),
                      correctIndex: q.options.findIndex(o => o.is_correct)
                  })) : []
              });
          } else {
              // امتحان جديد
              setExamForm({ id: null, title: '', duration: 30, requiresName: true, randQ: true, randO: true, questions: [] });
          }
          setDeletedQIds([]); setEditingQIndex(-1); 
          setCurrentQ({ id: null, text: '', image: null, options: ['', '', '', ''], correctIndex: 0 });
      }
      setModalType(type);
  };

  const getModalTitle = () => {
      if(modalType?.includes('course')) return modalType.includes('add') ? '✨ إضافة كورس جديد' : '✏️ تعديل الكورس';
      if(modalType?.includes('subject')) return modalType.includes('add') ? '✨ إضافة مادة جديدة' : '✏️ تعديل المادة';
      if(modalType?.includes('chapter')) return modalType.includes('add') ? '✨ إضافة فصل جديد' : '✏️ تعديل الفصل';
      if(modalType === 'add_video') return '🎬 إضافة فيديو يوتيوب';
      return '';
  };

  // ==========================================================
  // 6. منطق الامتحانات والأسئلة (Exams Logic)
  // ==========================================================
  const handleImageUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setUploadingImg(true);
      const fd = new FormData();
      fd.append('file', file); fd.append('type', 'exam_image');
      try {
          const res = await fetch('/api/dashboard/teacher/upload', {method:'POST', body:fd});
          const data = await res.json();
          if(res.ok) setCurrentQ({...currentQ, image: data.fileName});
      } catch(e) {}
      setUploadingImg(false);
  };
  
  const handleOptionChange = (index, value) => {
      const newOpts = [...currentQ.options];
      newOpts[index] = value;
      setCurrentQ({ ...currentQ, options: newOpts });
  };
  const addOption = () => { setCurrentQ({ ...currentQ, options: [...currentQ.options, ''] }); };
  const removeOption = (index) => {
      if (currentQ.options.length <= 2) return showAlert('error', 'يجب أن يكون هناك خياران على الأقل');
      const newOpts = currentQ.options.filter((_, i) => i !== index);
      let newCorrect = currentQ.correctIndex;
      if (index < currentQ.correctIndex) newCorrect--;
      if (index === currentQ.correctIndex) newCorrect = 0;
      setCurrentQ({ ...currentQ, options: newOpts, correctIndex: newCorrect });
  };
  const resetCurrentQuestion = () => {
      setEditingQIndex(-1);
      setCurrentQ({ id: null, text: '', image: null, options: ['', '', '', ''], correctIndex: 0 });
  };
  const saveQuestion = () => {
      if (!currentQ.text || !currentQ.text.trim()) return showAlert('error', 'نص السؤال مطلوب');
      if (currentQ.options.some(opt => !opt || !opt.trim())) return showAlert('error', 'لا يمكن إضافة خيارات فارغة.');
      const newQs = [...examForm.questions];
      if (editingQIndex >= 0) newQs[editingQIndex] = currentQ;
      else newQs.push(currentQ);
      setExamForm({ ...examForm, questions: newQs });
      resetCurrentQuestion();
  };
  const editQuestion = (i) => {
      setCurrentQ(examForm.questions[i]);
      setEditingQIndex(i);
      setShowExamSidebar(false);
  };
  const deleteQuestion = (i) => {
      const q = examForm.questions[i];
      if (q.id) setDeletedQIds([...deletedQIds, q.id]);
      setExamForm({ ...examForm, questions: examForm.questions.filter((_, idx) => idx !== i) });
      if (editingQIndex === i) resetCurrentQuestion();
  };

  const submitExam = async () => {
      if(!examForm.title || examForm.questions.length === 0) return showAlert('error', 'البيانات ناقصة (العنوان أو الأسئلة)');
      setLoading(true);
      try {
        const res = await fetch('/api/dashboard/teacher/exams', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                action: 'save_exam',
                id: examForm.id, 
                subjectId: selectedSubject.id,
                title: examForm.title, duration: examForm.duration,
                requiresName: examForm.requiresName, randQ: examForm.randQ, randO: examForm.randO,
                questions: examForm.questions, deletedQuestionIds: deletedQIds
            })
        });
        const data = await res.json();
        if(res.ok) {
            showAlert('success', 'تم حفظ الامتحان بنجاح 💾');
            setModalType(null);
            fetchContent();
        } else {
            showAlert('error', data.error || 'فشل الحفظ');
        }
      } catch(e) { showAlert('error', 'خطأ في الاتصال'); }
      setLoading(false);
  };

  const loadStats = async (examId) => {
      setLoading(true);
      const res = await fetch(`/api/dashboard/teacher/exams?action=stats&examId=${examId}`);
      if(res.ok) { setExamStats(await res.json()); setModalType('stats'); }
      setLoading(false);
  };

  // ==========================================================
  // 7. واجهة المستخدم (Render UI)
  // ==========================================================
  return (
    <TeacherLayout title="المحتوى">
      
      {/* Header & Breadcrumbs */}
      <div className="header-bar">
          <div className="title-area">
              <h1>🗂️ إدارة المحتوى التعليمي</h1>
              <div className="breadcrumbs">
                  <span className={!selectedCourse ? 'active' : ''} onClick={() => {setSelectedCourse(null); setSelectedSubject(null); setSelectedChapter(null);}}>الرئيسية</span>
                  {selectedCourse && <span className={!selectedSubject ? 'active' : ''} onClick={() => {setSelectedSubject(null); setSelectedChapter(null);}}> / {selectedCourse.title}</span>}
                  {selectedSubject && <span className={!selectedChapter ? 'active' : ''} onClick={() => setSelectedChapter(null)}> / {selectedSubject.title}</span>}
                  {selectedChapter && <span className="active"> / {selectedChapter.title}</span>}
              </div>
          </div>
          <div className="actions-area">
              {selectedChapter && <button className="btn-secondary edit" onClick={() => openModal('edit_chapter', selectedChapter)}>{Icons.edit} تعديل الفصل</button>}
              {selectedSubject && !selectedChapter && <button className="btn-secondary edit" onClick={() => openModal('edit_subject', selectedSubject)}>{Icons.edit} تعديل المادة</button>}
              {selectedCourse && !selectedSubject && <button className="btn-secondary edit" onClick={() => openModal('edit_course', selectedCourse)}>{Icons.edit} تعديل الكورس</button>}
              
              {!selectedCourse && <button className="btn-primary" onClick={() => openModal('add_course')}>{Icons.add} كورس جديد</button>}
              {selectedCourse && !selectedSubject && <button className="btn-primary" onClick={() => openModal('add_subject')}>{Icons.add} مادة جديدة</button>}
              {(selectedCourse || selectedSubject || selectedChapter) && <button className="btn-secondary" onClick={handleBack}>{Icons.back} تحديث</button>}
          </div>
      </div>

      {loading && <div className="loader-line"></div>}

      {/* Level 1: Courses */}
      {!selectedCourse && (
          <div className="grid-cards">
              {courses.map((c, index) => (
                  <div key={c.id} className="card folder-card draggable-item" onClick={() => setSelectedCourse(c)} draggable onDragStart={(e) => onDragStart(e, index)} onDragEnter={(e) => onDragEnter(e, index)} onDragEnd={(e) => onDragEnd(e, 'courses')}>
                      <div className="card-actions-abs">
                          <button className="btn-icon danger" onClick={(e) => {e.stopPropagation(); handleDelete('courses', c.id)}}>{Icons.trash}</button>
                          <div className="drag-handle-abs" onClick={e => e.stopPropagation()}>{Icons.drag}</div>
                      </div>
                      <div className="icon blue">{Icons.folder}</div>
                      <h3>{c.title}</h3>
                      <div className="badge">{c.price > 0 ? `${c.price} جنية` : 'مجاني'}</div>
                      <div className="meta-info">{c.subjects?.length || 0} مواد تعليمية</div>
                  </div>
              ))}
              {courses.length === 0 && !loading && <div className="empty-state">لا توجد كورسات، أضف كورس جديد لتبدأ.</div>}
          </div>
      )}

      {/* Level 2: Subjects */}
      {selectedCourse && !selectedSubject && (
          <div className="grid-cards">
              {selectedCourse.subjects?.map((s, index) => (
                  <div key={s.id} className="card folder-card draggable-item" onClick={() => setSelectedSubject(s)} draggable onDragStart={(e) => onDragStart(e, index)} onDragEnter={(e) => onDragEnter(e, index)} onDragEnd={(e) => onDragEnd(e, 'subjects')}>
                      <div className="card-actions-abs">
                          <button className="btn-icon danger" onClick={(e) => {e.stopPropagation(); handleDelete('subjects', s.id)}}>{Icons.trash}</button>
                          <div className="drag-handle-abs" onClick={e => e.stopPropagation()}>{Icons.drag}</div>
                      </div>
                      <div className="icon green">{Icons.folder}</div>
                      <h3>{s.title}</h3>
                      <div className="badge">{s.price > 0 ? `${s.price} جنية` : 'مجاني'}</div>
                      <div className="meta-info">{s.chapters?.length || 0} فصول</div>
                  </div>
              ))}
              {selectedCourse.subjects?.length === 0 && !loading && <div className="empty-state">هذا الكورس فارغ، أضف مواد.</div>}
          </div>
      )}

      {/* Level 3: Chapters & Exams */}
      {selectedSubject && !selectedChapter && (
          <div className="content-layout">
              {/* Chapters List */}
              <div className="panel">
                  <div className="panel-head">
                      <h3>📂 الفصول الدراسية</h3>
                      <button className="btn-small" onClick={() => openModal('add_chapter')}>{Icons.add} إضافة فصل</button>
                  </div>
                  <div className="list-group">
                      {selectedSubject.chapters?.length === 0 && <div className="empty">لا توجد فصول بعد</div>}
                      {selectedSubject.chapters?.map((ch, index) => (
                          <div key={ch.id} className="list-item clickable draggable-item" onClick={() => setSelectedChapter(ch)} draggable onDragStart={(e) => onDragStart(e, index)} onDragEnter={(e) => onDragEnter(e, index)} onDragEnd={(e) => onDragEnd(e, 'chapters')}>
                              <div className="drag-handle" onClick={e => e.stopPropagation()}>{Icons.drag}</div>
                              <div className="info">
                                  <strong>{ch.title}</strong>
                                  <small>{ch.videos?.length || 0} فيديو • {ch.pdfs?.length || 0} ملف</small>
                              </div>
                              <button className="btn-icon danger" onClick={(e) => {e.stopPropagation(); handleDelete('chapters', ch.id)}}>{Icons.trash}</button>
                          </div>
                      ))}
                  </div>
              </div>

              {/* Exams Grid */}
              <div className="panel">
                  <div className="panel-head">
                      <h3>📝 الامتحانات</h3>
                      <button className="btn-small" onClick={() => openModal('exam_editor')}> {Icons.add} إنشاء امتحان</button>
                  </div>
                  <div className="exam-grid">
                      {selectedSubject.exams?.map((ex, index) => (
                          <div key={ex.id} className="exam-card-item draggable-item" draggable onDragStart={(e) => onDragStart(e, index)} onDragEnter={(e) => onDragEnter(e, index)} onDragEnd={(e) => onDragEnd(e, 'exams')}>
                              <div className="drag-handle-abs" onClick={e => e.stopPropagation()}>{Icons.drag}</div>
                              <div className="exam-icon">{Icons.exam}</div>
                              <div className="exam-info">
                                  <h4>{ex.title}</h4>
                                  <span>⏱ {ex.duration_minutes} دقيقة</span>
                              </div>
                              <div className="exam-actions">
                                  <button title="النتائج" onClick={() => loadStats(ex.id)}>📊</button>
                                  <button title="تعديل" onClick={() => openModal('exam_editor', ex)}>{Icons.edit}</button>
                                  <button title="حذف" className="danger" onClick={() => handleDelete('exams', ex.id)}>{Icons.trash}</button>
                              </div>
                          </div>
                      ))}
                      {(!selectedSubject.exams || selectedSubject.exams.length === 0) && <div className="empty">لا توجد امتحانات</div>}
                  </div>
              </div>
          </div>
      )}

      {/* Level 4: Videos & PDFs */}
      {selectedChapter && (
          <div className="content-layout">
              {/* Videos */}
              <div className="panel">
                  <div className="panel-head">
                      <h3>🎬 الفيديوهات</h3>
                      <button className="btn-small" onClick={() => openModal('add_video')}> {Icons.add} إضافة فيديو</button>
                  </div>
                  <div className="media-grid">
                      {selectedChapter.videos?.map((v, index) => (
                          <div key={v.id} className="media-card draggable-item" draggable onDragStart={(e) => onDragStart(e, index)} onDragEnter={(e) => onDragEnter(e, index)} onDragEnd={(e) => onDragEnd(e, 'videos')}>
                              <div className="drag-handle-abs" onClick={e => e.stopPropagation()}>{Icons.drag}</div>
                              <div className="thumb">{Icons.video}</div>
                              <div className="media-body">
                                  <h4 title={v.title}>{v.title}</h4>
                                  <button className="btn-icon danger" onClick={() => handleDelete('videos', v.id)}>{Icons.trash}</button>
                              </div>
                          </div>
                      ))}
                      {(!selectedChapter.videos || selectedChapter.videos.length === 0) && <div className="empty">لا توجد فيديوهات</div>}
                  </div>
              </div>

              {/* PDFs */}
              <div className="panel">
                  <div className="panel-head">
                      <h3>📄 الملفات (PDF)</h3>
                      <button className="btn-small" onClick={() => openModal('add_pdf')}> {Icons.add} رفع ملف</button>
                  </div>
                  <div className="list-group">
                      {selectedChapter.pdfs?.map((p, index) => (
                          <div key={p.id} className="list-item draggable-item" draggable onDragStart={(e) => onDragStart(e, index)} onDragEnter={(e) => onDragEnter(e, index)} onDragEnd={(e) => onDragEnd(e, 'pdfs')}>
                              <div className="drag-handle" onClick={e => e.stopPropagation()}>{Icons.drag}</div>
                              <div className="info file-info">
                                  <span className="icon-wrap">{Icons.pdf}</span>
                                  <strong>{p.title}</strong>
                              </div>
                              <button className="btn-icon danger" onClick={() => handleDelete('pdfs', p.id)}>{Icons.trash}</button>
                          </div>
                      ))}
                      {(!selectedChapter.pdfs || selectedChapter.pdfs.length === 0) && <div className="empty">لا توجد ملفات</div>}
                  </div>
              </div>
          </div>
      )}

      {/* --- Modals --- */}
      {['add_course', 'edit_course', 'add_subject', 'edit_subject', 'add_chapter', 'edit_chapter', 'add_video'].includes(modalType) && (
          <Modal title={getModalTitle()} onClose={() => setModalType(null)}>
              <div className="form-group">
                  <label>العنوان</label>
                  <input 
                    className="input" 
                    autoFocus 
                    value={formData.title} 
                    onChange={e=>setFormData({...formData, title: e.target.value})} 
                    placeholder="اكتب العنوان..." 
                  />
              </div>

              {['add_course', 'edit_course', 'add_subject', 'edit_subject'].includes(modalType) && (
                  <div className="form-group">
                      <label>السعر (جنية)</label>
                      <input 
                        type="number" 
                        className="input" 
                        value={formData.price} 
                        onChange={e=>setFormData({...formData, price: e.target.value})} 
                        placeholder="0 (اتركه 0 إذا كان مجاني)" 
                      />
                  </div>
              )}

              {modalType === 'add_video' && (
                  <div className="form-group">
                      <label>رابط الفيديو (YouTube)</label>
                      <input className="input" value={formData.url} onChange={e=>setFormData({...formData, url: e.target.value})} placeholder="https://youtube.com/..." dir="ltr" />
                  </div>
              )}
              
              <div className="acts">
                  <button className="btn-cancel" onClick={() => setModalType(null)}>إلغاء</button>
                  
                  <button className="btn-primary" onClick={() => {
                      if (modalType === 'add_course') apiCall('create', 'courses', { title: formData.title, price: formData.price });
                      else if (modalType === 'edit_course') apiCall('update', 'courses', { id: selectedCourse.id, title: formData.title, price: formData.price });
                      
                      else if (modalType === 'add_subject') apiCall('create', 'subjects', { course_id: selectedCourse.id, title: formData.title, price: formData.price });
                      else if (modalType === 'edit_subject') apiCall('update', 'subjects', { id: selectedSubject.id, title: formData.title, price: formData.price });
                      
                      else if (modalType === 'add_chapter') apiCall('create', 'chapters', { subject_id: selectedSubject.id, title: formData.title });
                      else if (modalType === 'edit_chapter') apiCall('update', 'chapters', { id: selectedChapter.id, title: formData.title });
                      
                      else if (modalType === 'add_video') apiCall('create', 'videos', { chapter_id: selectedChapter.id, title: formData.title, url: formData.url });
                  }}>حفظ</button>
              </div>
          </Modal>
      )}
      
    {modalType === 'add_pdf' && (
          <Modal title="رفع ملف PDF" onClose={() => setModalType(null)}>
              <form onSubmit={async (e) => {
                  e.preventDefault();
                  const file = e.target.file.files[0];
                  if(!file) return showAlert('error', 'اختر الملف');
                  
                  setLoading(true); 
                  const fd = new FormData();
                  fd.append('file', file); fd.append('title', e.target.title.value); fd.append('type', 'pdf'); fd.append('chapterId', selectedChapter.id);
                  try {
                      const res = await fetch('/api/dashboard/teacher/upload', {method:'POST', body:fd});
                      if(res.ok) { fetchContent(); setModalType(null); showAlert('success', 'تم الرفع بنجاح 📁'); }
                      else showAlert('error', 'فشل الرفع، تأكد من حجم الملف');
                  } catch(e) { showAlert('error', 'خطأ في الاتصال'); }
                  setLoading(false); 
              }}>
                  <div className="form-group">
                      <label>اسم الملف</label>
                      <input className="input" name="title" required placeholder="مثال: مذكرة الشرح..." />
                  </div>
                  <div className="form-group">
                      <label>اختر الملف</label>
                      <input className="input file" type="file" name="file" accept="application/pdf" required />
                  </div>
                  <div className="acts">
                      <button type="button" className="btn-cancel" onClick={() => setModalType(null)}>إلغاء</button>
                      <button type="submit" className="btn-primary" disabled={loading}>
                          {loading ? 'جاري الرفع... ⏳' : 'رفع الملف'}
                      </button>
                  </div>
              </form>
          </Modal>
      )}
      
      {modalType === 'stats' && examStats && (
          <Modal title="📊 تقرير الامتحان" onClose={() => setModalType(null)}>
              <div className="stats-summary">
                  <div className="stat-card"><span>عدد الطلاب</span><strong>{examStats.totalAttempts}</strong></div>
                  <div className="stat-card"><span>متوسط النسبة</span><strong style={{color:'#facc15'}}>{examStats.averageScore}%</strong></div>
                  <div className="stat-card"><span>متوسط الدرجات</span><strong style={{color:'#4ade80'}}>{Number(examStats.averageScore).toFixed(1)}</strong></div>
              </div>
              <div className="table-wrap">
                  <table>
                      <thead><tr><th>الطالب</th><th>النسبة</th><th>الدرجة</th><th>التاريخ</th></tr></thead>
                      <tbody>
                          {examStats.attempts.map((a, i) => (
                              <tr key={i}>
                                  <td>{a.student_name_input || 'غير معروف'}</td>
                                  <td style={{color: a.score >= 50 ? '#4ade80' : '#ef4444'}}>{a.score}%</td>
                                  <td>{a.score}</td>
                                  <td>{a.completed_at ? new Date(a.completed_at).toLocaleDateString('ar-EG') : '-'}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </Modal>
      )}

      {/* --- Exam Editor (Overlay) --- */}
      {modalType === 'exam_editor' && (
          <div className="editor-overlay">
              <div className="editor-container">
                  <div className="editor-header">
                      <h3>{examForm.id ? '✏️ تعديل الامتحان' : '📝 إنشاء امتحان جديد'}</h3>
                      <div className="header-actions">
                          <button className="mobile-toggle" onClick={() => setShowExamSidebar(!showExamSidebar)}>{Icons.menu} القائمة</button>
                          <button className="close-btn" onClick={() => setModalType(null)}>{Icons.close} خروج</button>
                      </div>
                  </div>
                  
                  <div className="editor-body">
                      <div className={`editor-sidebar ${showExamSidebar ? 'mobile-visible' : ''}`}>
                          <div className="meta-section styled">
                              <label className="field-label">عنوان الامتحان</label>
                              <input className="input" value={examForm.title} onChange={e=>setExamForm({...examForm, title: e.target.value})} placeholder="العنوان..." />
                              
                              <label className="field-label">المدة (بالدقائق)</label>
                              <div className="duration-input">
                                  <input type="number" value={examForm.duration} onChange={e=>setExamForm({...examForm, duration: e.target.value})} />
                                  <span>دقيقة</span>
                              </div>

                              <div className="toggles-group">
                                  <div className="toggle-row"><span>طلب اسم الطالب</span><label className="switch"><input type="checkbox" checked={examForm.requiresName} onChange={e=>setExamForm({...examForm, requiresName: e.target.checked})} /><span className="slider round"></span></label></div>
                                  <div className="toggle-row"><span>عشوائية الأسئلة</span><label className="switch"><input type="checkbox" checked={examForm.randQ} onChange={e=>setExamForm({...examForm, randQ: e.target.checked})} /><span className="slider round"></span></label></div>
                                  <div className="toggle-row"><span>عشوائية الاختيارات</span><label className="switch"><input type="checkbox" checked={examForm.randO} onChange={e=>setExamForm({...examForm, randO: e.target.checked})} /><span className="slider round"></span></label></div>
                              </div>
                          </div>
                          
                          <div className="q-list-scroll">
                              <h4 className="list-title">قائمة الأسئلة ({examForm.questions.length})</h4>
                              {examForm.questions.map((q, i) => (
                                  <div key={i} className={`q-item ${editingQIndex === i ? 'active' : ''}`} onClick={() => editQuestion(i)}>
                                      <span className="q-num">{i+1}</span>
                                      <span className="q-text">{q.text.substring(0, 15)}...</span>
                                      <button className="del-btn" onClick={(e) => { e.stopPropagation(); deleteQuestion(i); }}>×</button>
                                  </div>
                              ))}
                              <button className="add-q-btn" onClick={() => { resetCurrentQuestion(); setShowExamSidebar(false); }}>{Icons.add} سؤال جديد</button>
                          </div>
                          
                          <div className="sidebar-footer">
                              <button className="btn-save-exam" onClick={submitExam}>حفظ الامتحان</button>
                          </div>
                      </div>
                      
                      {showExamSidebar && <div className="sidebar-overlay" onClick={() => setShowExamSidebar(false)}></div>}

                      <div className="editor-main">
                          <h4>{editingQIndex === -1 ? 'إضافة سؤال جديد' : `تعديل السؤال رقم ${editingQIndex + 1}`}</h4>
                          <textarea className="input area" placeholder="اكتب نص السؤال هنا..." value={currentQ.text} onChange={e=>setCurrentQ({...currentQ, text: e.target.value})} rows="3"></textarea>
                          
                          <div className="image-upload">
                              <label style={{ opacity: uploadingImg ? 0.5 : 1 }}>
                                  {Icons.image} {currentQ.image ? 'تغيير الصورة' : 'إرفاق صورة'}
                                  <input type="file" hidden accept="image/*" onChange={handleImageUpload} disabled={uploadingImg} />
                              </label>
                              {uploadingImg && <span className="uploading-text">جاري الرفع... ⏳</span>}
                              {currentQ.image && <img src={`/api/dashboard/teacher/file-proxy?type=exam_images&filename=${currentQ.image}`} alt="preview" />}
                          </div>

                          <div className="options-section">
                              <label className="section-label">الاختيارات (اضغط على الدائرة لتحديد الإجابة الصحيحة):</label>
                              <div className="options-container dynamic">
                                  {currentQ.options.map((opt, i) => (
                                      <div key={i} className={`option-row ${currentQ.correctIndex === i ? 'correct' : ''}`}>
                                          <div className="radio" onClick={() => setCurrentQ({...currentQ, correctIndex: i})}>{currentQ.correctIndex === i && <div className="dot"></div>}</div>
                                          <input className="input small" value={opt} onChange={e => handleOptionChange(i, e.target.value)} placeholder={`الخيار ${i+1}`} />
                                          {currentQ.options.length > 2 && <button className="btn-remove-opt" onClick={() => removeOption(i)} title="حذف">×</button>}
                                      </div>
                                  ))}
                              </div>
                              <button className="btn-add-opt" onClick={addOption}>+ إضافة خيار</button>
                          </div>

                          <div className="editor-actions">
                              <button className="btn-primary full" onClick={saveQuestion}>{editingQIndex === -1 ? 'إضافة السؤال للقائمة' : 'تحديث السؤال'}</button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {confirmData.show && (
          <div className="modal-overlay">
              <div className="modal-box confirm-box">
                  <div className="modal-header"><h3>تأكيد الإجراء</h3></div>
                  <p className="confirm-msg">{confirmData.msg}</p>
                  <div className="acts">
                      <button className="btn-cancel" onClick={closeConfirm}>إلغاء</button>
                      <button className="btn-primary danger" onClick={confirmData.onConfirm}>نعم، احذف</button>
                  </div>
              </div>
          </div>
      )}

      {alertData.show && <div className={`alert-toast ${alertData.type}`}>{alertData.msg}</div>}

      <style jsx>{`
        /* --- General Layout --- */
        .header-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 1px solid #334155; padding-bottom: 20px; }
        .title-area h1 { margin: 0 0 10px 0; color: #38bdf8; font-size: 1.8rem; font-weight: 700; }
        .breadcrumbs { display: flex; align-items: center; gap: 5px; color: #94a3b8; font-size: 0.95rem; }
        .breadcrumbs span { cursor: pointer; transition: 0.2s; }
        .breadcrumbs span:hover { color: #fff; }
        .breadcrumbs span.active { color: #facc15; font-weight: bold; cursor: default; }

        .actions-area { display: flex; gap: 12px; }
        .btn-primary { background: #38bdf8; color: #0f172a; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; display: flex; gap: 8px; align-items: center; transition: 0.2s; }
        .btn-primary:hover { background: #0ea5e9; transform: translateY(-2px); }
        .btn-primary.danger { background: #ef4444; color: white; }
        .btn-primary.danger:hover { background: #dc2626; }
        .btn-primary.full { width: 100%; justify-content: center; }

        .btn-secondary { background: #1e293b; color: #cbd5e1; border: 1px solid #334155; padding: 10px 16px; border-radius: 8px; cursor: pointer; display: flex; gap: 6px; align-items: center; transition: 0.2s; }
        .btn-secondary:hover { background: #334155; color: white; }
        .btn-secondary.edit { color: #facc15; border-color: rgba(250, 204, 21, 0.3); background: rgba(250, 204, 21, 0.05); }
        .btn-secondary.edit:hover { background: rgba(250, 204, 21, 0.15); }

        .loader-line { height: 3px; background: linear-gradient(90deg, #38bdf8, #818cf8); width: 100%; position: fixed; top: 0; left: 0; z-index: 9999; animation: loading 1s infinite linear; }
        @keyframes loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }

        /* --- Cards Grid --- */
        .grid-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 25px; }
        .draggable-item.dragging { opacity: 0.5; border: 2px dashed #38bdf8 !important; transform: scale(0.95); }
        
        .folder-card { background: #1e293b; padding: 25px; border-radius: 16px; border: 1px solid #334155; text-align: center; cursor: pointer; transition: all 0.2s ease; position: relative; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .folder-card:hover { transform: translateY(-5px); border-color: #38bdf8; box-shadow: 0 10px 15px -3px rgba(56, 189, 248, 0.15); }
        .folder-card .icon { width: 60px; height: 60px; border-radius: 14px; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px; font-size: 1.5rem; }
        .folder-card .icon.blue { background: rgba(56, 189, 248, 0.1); color: #38bdf8; }
        .folder-card .icon.green { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
        
        .folder-card h3 { margin: 0 0 10px; color: white; font-size: 1.1rem; }
        .folder-card .badge { display: inline-block; background: #0f172a; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; color: #94a3b8; margin-bottom: 10px; border: 1px solid #334155; }
        .folder-card .meta-info { color: #64748b; font-size: 0.85rem; }

        .card-actions-abs { position: absolute; top: 12px; right: 12px; display: flex; gap: 8px; z-index: 20; opacity: 0; transition: 0.2s; }
        .folder-card:hover .card-actions-abs { opacity: 1; }
        .drag-handle-abs { cursor: grab; color: rgba(255,255,255,0.3); padding: 5px; border-radius: 4px; }
        .drag-handle-abs:hover { background: rgba(255,255,255,0.1); color: white; }

        /* --- Content Layout --- */
        .content-layout { display: grid; grid-template-columns: 1fr; gap: 30px; }
        .panel { background: #111827; border-radius: 16px; border: 1px solid #1f2937; padding: 25px; }
        .panel-head { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1f2937; padding-bottom: 15px; margin-bottom: 20px; }
        .panel-head h3 { margin: 0; color: white; font-size: 1.3rem; font-weight: 600; display: flex; align-items: center; gap: 10px; }
        .btn-small { background: #38bdf8; color: #0f172a; padding: 8px 14px; border-radius: 8px; border: none; font-weight: bold; cursor: pointer; display: flex; gap: 6px; font-size: 0.9rem; transition: 0.2s; }
        .btn-small:hover { background: #0ea5e9; }

        /* --- Lists --- */
        .list-group { display: flex; flex-direction: column; gap: 12px; }
        .list-item { background: #1e293b; padding: 15px 20px; border-radius: 12px; border: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; position: relative; transition: 0.2s; }
        .list-item.clickable:hover { border-color: #38bdf8; background: #253045; }
        .list-item .info { flex: 1; display: flex; flex-direction: column; }
        .list-item .info.file-info { flex-direction: row; align-items: center; gap: 10px; }
        .list-item .info strong { color: white; font-size: 1.05rem; }
        .list-item .info small { color: #94a3b8; font-size: 0.85rem; margin-top: 4px; }
        .drag-handle { cursor: grab; padding: 8px; color: #64748b; margin-left: 15px; }
        
        .btn-icon { background: rgba(255,255,255,0.05); width: 36px; height: 36px; border-radius: 8px; border: none; color: #cbd5e1; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; flex-shrink: 0; }
        .btn-icon:hover { background: rgba(255,255,255,0.1); color: white; transform: scale(1.05); }
        .btn-icon.danger:hover { background: rgba(239, 68, 68, 0.2); color: #ef4444; }

        /* --- Exam Grid --- */
        .exam-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 15px; }
        .exam-card-item { background: #1e293b; padding: 15px; border-radius: 12px; border: 1px solid #334155; display: flex; align-items: center; gap: 15px; position: relative; transition: 0.2s; }
        .exam-card-item:hover { border-color: #facc15; }
        .exam-icon { color: #facc15; background: rgba(250, 204, 21, 0.1); padding: 12px; border-radius: 10px; }
        .exam-info { flex: 1; }
        .exam-info h4 { margin: 0 0 5px 0; color: white; font-size: 1rem; }
        .exam-info span { font-size: 0.85rem; color: #94a3b8; display: block; }
        .exam-actions { display: flex; gap: 8px; z-index: 10; }
        .exam-actions button { background: #334155; border: none; width: 32px; height: 32px; border-radius: 6px; color: #cbd5e1; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .exam-actions button:hover { background: #38bdf8; color: #0f172a; }
        .exam-actions button.danger:hover { background: #ef4444; color: white; }

        /* --- Media Grid --- */
        .media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; }
        .media-card { background: #1e293b; border-radius: 12px; overflow: hidden; border: 1px solid #334155; transition: 0.2s; }
        .media-card:hover { border-color: #38bdf8; transform: translateY(-3px); }
        .media-card .thumb { height: 120px; background: #0f172a; display: flex; align-items: center; justify-content: center; color: #38bdf8; position: relative; }
        .media-body { padding: 12px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #334155; }
        .media-body h4 { margin: 0; font-size: 0.95rem; color: white; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 130px; }

        /* --- Empty States --- */
        .empty-state { grid-column: 1 / -1; padding: 40px; text-align: center; color: #64748b; background: #1e293b; border-radius: 12px; border: 2px dashed #334155; }
        .empty { text-align: center; color: #64748b; padding: 20px; width: 100%; }

        /* --- Modals & Forms --- */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 10000; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(8px); }
        .modal-box { background: #1e293b; width: 95%; max-width: 500px; border-radius: 20px; border: 1px solid #475569; padding: 30px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6); animation: popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        .modal-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 15px; margin-bottom: 25px; }
        .modal-header h3 { margin: 0; color: white; font-size: 1.4rem; }
        .close-btn { background: none; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer; padding: 5px; }
        
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; color: #cbd5e1; margin-bottom: 8px; font-weight: 500; font-size: 0.95rem; }
        .input { width: 100%; padding: 12px; background: #0f172a; border: 1px solid #334155; border-radius: 8px; color: white; font-size: 1rem; transition: 0.2s; }
        .input:focus { outline: none; border-color: #38bdf8; box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.2); }
        .input.file { padding: 10px; cursor: pointer; }
        
        .acts { display: flex; justify-content: flex-end; gap: 15px; margin-top: 30px; }
        .btn-cancel { background: transparent; color: #94a3b8; border: none; font-weight: bold; cursor: pointer; }
        .btn-cancel:hover { color: white; }

        /* --- Exam Editor Styling --- */
        .editor-overlay { position: fixed; inset: 0; background: #0f172a; z-index: 10000; display: flex; flex-direction: column; }
        .editor-container { display: flex; flex-direction: column; height: 100vh; }
        .editor-header { background: #1e293b; padding: 15px 30px; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
        .header-actions { display: flex; gap: 15px; }
        .mobile-toggle { display: none; background: #334155; border: none; color: white; padding: 8px 12px; border-radius: 6px; cursor: pointer; }

        .editor-body { flex: 1; display: flex; overflow: hidden; position: relative; }
        .editor-sidebar { width: 350px; background: #111827; border-left: 1px solid #334155; display: flex; flex-direction: column; flex-shrink: 0; height: 100%; z-index: 50; }
        
        .meta-section.styled { padding: 25px; border-bottom: 1px solid #334155; background: #162032; }
        .field-label { color: #94a3b8; font-size: 0.9rem; margin-bottom: 8px; display: block; }
        .duration-input { display: flex; align-items: center; gap: 10px; background: #0f172a; padding: 8px 12px; border-radius: 8px; border: 1px solid #334155; margin-bottom: 20px; }
        .duration-input input { background: transparent; border: none; color: white; width: 60px; font-weight: bold; text-align: center; font-size: 1.1rem; }
        
        .toggles-group { display: flex; flex-direction: column; gap: 15px; }
        .toggle-row { display: flex; justify-content: space-between; align-items: center; }
        .toggle-row span { color: #cbd5e1; font-size: 0.95rem; }

        .switch { position: relative; display: inline-block; width: 44px; height: 24px; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #334155; transition: .4s; border-radius: 24px; }
        .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
        input:checked + .slider { background-color: #38bdf8; }
        input:checked + .slider:before { transform: translateX(20px); }

        .q-list-scroll { flex: 1; overflow-y: auto; padding: 20px; }
        .list-title { color: #64748b; font-size: 0.9rem; margin: 0 0 15px; border-bottom: 1px dashed #334155; padding-bottom: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
        .q-item { padding: 12px 15px; background: #1f2937; border-radius: 8px; margin-bottom: 10px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; color: #cbd5e1; border: 1px solid transparent; transition: 0.2s; }
        .q-item:hover, .q-item.active { background: #334155; border-color: #38bdf8; color: white; transform: translateX(-5px); }
        .q-num { background: #0f172a; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold; }
        .del-btn { background: none; border: none; color: #ef4444; font-size: 1.2rem; font-weight: bold; cursor: pointer; padding: 0 5px; opacity: 0.5; transition: 0.2s; }
        .del-btn:hover { opacity: 1; }
        .add-q-btn { width: 100%; padding: 12px; background: transparent; border: 2px dashed #334155; color: #38bdf8; border-radius: 8px; cursor: pointer; margin-top: 15px; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; transition: 0.2s; }
        .add-q-btn:hover { border-color: #38bdf8; background: rgba(56, 189, 248, 0.05); }

        .sidebar-footer { padding: 20px; border-top: 1px solid #334155; background: #162032; }
        .btn-save-exam { width: 100%; background: #22c55e; color: #0f172a; padding: 14px; border: none; border-radius: 10px; font-weight: 800; cursor: pointer; font-size: 1rem; transition: 0.2s; }
        .btn-save-exam:hover { background: #4ade80; transform: translateY(-2px); box-shadow: 0 10px 20px -5px rgba(34, 197, 94, 0.3); }

        .editor-main { flex: 1; padding: 40px; overflow-y: auto; background: #0f172a; }
        .editor-main h4 { color: #38bdf8; margin-top: 0; font-size: 1.4rem; margin-bottom: 25px; }
        .input.area { resize: vertical; margin-bottom: 25px; line-height: 1.6; }
        
        .image-upload { margin-bottom: 30px; }
        .image-upload label { display: inline-flex; align-items: center; gap: 10px; cursor: pointer; background: #1e293b; padding: 10px 20px; border-radius: 8px; border: 1px solid #334155; color: #cbd5e1; transition: 0.2s; }
        .image-upload label:hover { border-color: #38bdf8; color: white; }
        .image-upload img { max-height: 200px; margin-top: 15px; border-radius: 12px; border: 1px solid #334155; display: block; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
        .uploading-text { margin-right: 15px; color: #38bdf8; font-weight: bold; font-size: 0.9rem; }

        .options-section { margin-bottom: 40px; background: #162032; padding: 25px; border-radius: 16px; border: 1px solid #1f2937; }
        .section-label { margin-bottom: 15px; }
        .options-container.dynamic { display: flex; flex-direction: column; gap: 15px; }
        .option-row { display: flex; align-items: center; gap: 15px; background: #0f172a; padding: 10px 15px; border-radius: 10px; border: 1px solid #334155; transition: 0.2s; }
        .option-row:hover { border-color: #64748b; }
        .option-row.correct { border-color: #22c55e; background: rgba(34, 197, 94, 0.05); }
        
        .radio { width: 24px; height: 24px; border: 2px solid #64748b; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: 0.2s; }
        .radio:hover { border-color: #38bdf8; }
        .option-row.correct .radio { border-color: #22c55e; background: rgba(34, 197, 94, 0.2); }
        .dot { width: 12px; height: 12px; background: #22c55e; border-radius: 50%; }
        
        .btn-remove-opt { background: #334155; border: none; color: #ef4444; width: 30px; height: 30px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
        .btn-add-opt { background: #1e293b; color: #38bdf8; border: 1px dashed #38bdf8; padding: 10px; width: 100%; border-radius: 8px; margin-top: 15px; cursor: pointer; font-weight: 600; transition: 0.2s; }
        .btn-add-opt:hover { background: rgba(56, 189, 248, 0.1); }
        
        .editor-actions { padding-top: 25px; border-top: 1px solid #1e293b; }

        /* --- Alert Toast --- */
        .alert-toast { position: fixed; bottom: 30px; left: 30px; padding: 15px 30px; border-radius: 12px; color: white; font-weight: bold; z-index: 20000; box-shadow: 0 10px 30px rgba(0,0,0,0.5); animation: slideIn 0.3s ease-out; display: flex; align-items: center; gap: 10px; }
        .alert-toast.success { background: linear-gradient(135deg, #22c55e, #16a34a); }
        .alert-toast.error { background: linear-gradient(135deg, #ef4444, #dc2626); }
        .alert-toast.info { background: #334155; }
        @keyframes slideIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        /* --- Stats Modal --- */
        .stats-summary { display: flex; gap: 20px; margin-bottom: 25px; }
        .stat-card { flex: 1; background: #0f172a; padding: 20px; border-radius: 12px; text-align: center; border: 1px solid #334155; }
        .stat-card span { display: block; color: #94a3b8; font-size: 0.9rem; margin-bottom: 8px; }
        .stat-card strong { display: block; color: white; font-size: 1.6rem; }
        .table-wrap { max-height: 400px; overflow-y: auto; border: 1px solid #334155; border-radius: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: right; padding: 15px; color: #94a3b8; background: #162032; border-bottom: 1px solid #334155; position: sticky; top: 0; }
        td { padding: 15px; color: white; border-bottom: 1px solid #334155; background: #0f172a; }
        tr:last-child td { border-bottom: none; }

        /* --- Mobile Responsiveness --- */
        @media (max-width: 768px) {
            .mobile-toggle { display: flex; align-items: center; gap: 5px; }
            .editor-sidebar { position: fixed; right: 0; top: 0; bottom: 0; width: 85%; transform: translateX(100%); transition: transform 0.3s ease; box-shadow: -10px 0 30px rgba(0,0,0,0.7); }
            .editor-sidebar.mobile-visible { transform: translateX(0); }
            .sidebar-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 40; backdrop-filter: blur(4px); }
            
            .header-bar { flex-direction: column; align-items: flex-start; gap: 15px; }
            .actions-area { width: 100%; overflow-x: auto; padding-bottom: 5px; }
            .grid-cards { grid-template-columns: 1fr; }
            .editor-main { padding: 20px; padding-bottom: 100px; }
            .modal-box { width: 90%; padding: 20px; }
            .stats-summary { flex-direction: column; }
        }

        /* --- Animations --- */
        @keyframes popIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </TeacherLayout>
  );
}

// مكون النافذة المنبثقة (Modal Component)
const Modal = ({ title, children, onClose }) => (
    <div className="modal-overlay" onClick={onClose}>
        <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
                <h3>{title}</h3>
                <button onClick={onClose} className="close-btn">✕</button>
            </div>
            {children}
        </div>
    </div>
);
