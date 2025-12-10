import AdminLayout from '../../components/AdminLayout';
import { useState, useEffect } from 'react';

export default function ContentManager() {
  // --- States ---
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // list, add_video, add_pdf, add_exam, view_stats

  // Exam Builder State
  const [examForm, setExamForm] = useState({ title: '', duration: 30, questions: [] });
  const [currentQuestion, setCurrentQuestion] = useState({ text: '', image: null, options: ['', '', '', ''], correctIndex: 0 });
  const [uploadingImg, setUploadingImg] = useState(false);

  // Stats State
  const [examStats, setExamStats] = useState(null);

  // --- Initial Fetch ---
  const fetchContent = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/public/get-courses');
        const data = await res.json();
        setCourses(data);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
  };

  useEffect(() => { fetchContent(); }, []);

  // --- Handlers ---
  
  // 1. Upload PDF
  const handlePdfUpload = async (e) => {
      e.preventDefault();
      const file = e.target.file.files[0];
      const title = e.target.title.value;
      if (!file) return alert("يرجى اختيار ملف");

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      formData.append('type', 'pdf');
      formData.append('chapterId', selectedChapter.id);

      setLoading(true);
      const res = await fetch('/api/admin/upload-file', { method: 'POST', body: formData });
      if (res.ok) {
          alert('تم رفع ملف PDF بنجاح ✅');
          setViewMode('list');
          fetchContent();
      } else {
          alert('فشل عملية الرفع');
      }
      setLoading(false);
  };

  // 2. Add Video
  const handleVideoAdd = async (e) => {
      e.preventDefault();
      const title = e.target.title.value;
      const url = e.target.url.value;

      setLoading(true);
      const res = await fetch('/api/admin/manage-content', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
              action: 'add_video',
              payload: { title, url, chapterId: selectedChapter.id }
          })
      });
      
      const data = await res.json();
      if (res.ok) {
          alert('تم إضافة الفيديو بنجاح ✅');
          setViewMode('list');
          fetchContent();
      } else {
          alert('خطأ: ' + data.error);
      }
      setLoading(false);
  };

  // 3. Exam Functions
  const handleQuestionImageUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      setUploadingImg(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'exam_image');

      const res = await fetch('/api/admin/upload-file', { method: 'POST', body: formData });
      const data = await res.json();
      
      if (res.ok) {
          setCurrentQuestion({ ...currentQuestion, image: data.fileName });
      }
      setUploadingImg(false);
  };

  const addQuestionToExam = () => {
      if (!currentQuestion.text) return alert("يرجى كتابة نص السؤال");
      setExamForm({
          ...examForm,
          questions: [...examForm.questions, currentQuestion]
      });
      // Reset current question
      setCurrentQuestion({ text: '', image: null, options: ['', '', '', ''], correctIndex: 0 });
  };

  const saveExam = async () => {
      if (examForm.questions.length === 0) return alert("يجب إضافة سؤال واحد على الأقل");
      if (!examForm.title) return alert("يرجى تحديد عنوان للامتحان");

      setLoading(true);
      const res = await fetch('/api/admin/manage-content', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
              action: 'save_exam',
              payload: {
                  subjectId: selectedSubject.id,
                  title: examForm.title,
                  duration: examForm.duration,
                  questions: examForm.questions
              }
          })
      });

      if (res.ok) {
          alert("تم حفظ الامتحان بنجاح 🎉");
          setViewMode('list');
          setExamForm({ title: '', duration: 30, questions: [] });
      } else {
          alert("فشل الحفظ");
      }
      setLoading(false);
  };

  // 4. View Stats
  const loadExamStats = async (examId) => {
      setLoading(true);
      const res = await fetch(`/api/admin/exam-stats?examId=${examId}`);
      const data = await res.json();
      setExamStats(data);
      setViewMode('view_stats');
      setLoading(false);
  };

  // 5. Delete Item
  const deleteItem = async (type, id) => {
      if (!confirm("هل أنت متأكد من الحذف؟ هذا الإجراء لا يمكن التراجع عنه.")) return;
      await fetch('/api/admin/manage-content', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ action: 'delete_item', payload: { type, id } })
      });
      fetchContent();
  };

  // --- Helper to verify selection before action ---
  const checkSelectionAndSetMode = (mode) => {
      if (mode === 'add_exam' && !selectedSubject) return alert("يرجى اختيار المادة أولاً لإضافة امتحان");
      if ((mode === 'add_video' || mode === 'add_pdf') && !selectedChapter) return alert("يرجى اختيار الشابتر أولاً لإضافة محتوى");
      setViewMode(mode);
  };

  return (
    <AdminLayout title="إدارة المحتوى">
      
      {/* Header Title */}
      <h1 style={{marginBottom:'30px', borderBottom:'1px solid #334155', paddingBottom:'15px', color:'#38bdf8'}}>
        🗂️ إدارة المحتوى والامتحانات
      </h1>

      {/* Top Action Cards (Like Index Page) */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:'20px', marginBottom:'30px'}}>
        
        {/* Card 1: Create Exam */}
        <div 
            onClick={() => checkSelectionAndSetMode('add_exam')}
            style={{background:'#1e293b', padding:'25px', borderRadius:'12px', border:'1px solid #334155', boxShadow:'0 4px 6px rgba(0,0,0,0.1)', cursor:'pointer', transition:'0.2s'}}
            onMouseOver={e => e.currentTarget.style.borderColor = '#38bdf8'}
            onMouseOut={e => e.currentTarget.style.borderColor = '#334155'}
        >
            <h3 style={{color:'#94a3b8', marginBottom:'10px', fontSize:'0.9em'}}>إنشاء امتحان</h3>
            <div style={{fontSize:'24px', fontWeight:'bold', color:'#facc15'}}>📝 إضافة جديد</div>
            <p style={{fontSize:'12px', color:'#64748b'}}>داخل المادة المختارة</p>
        </div>

        {/* Card 2: Upload Video */}
        <div 
            onClick={() => checkSelectionAndSetMode('add_video')}
            style={{background:'#1e293b', padding:'25px', borderRadius:'12px', border:'1px solid #334155', boxShadow:'0 4px 6px rgba(0,0,0,0.1)', cursor:'pointer', transition:'0.2s'}}
            onMouseOver={e => e.currentTarget.style.borderColor = '#38bdf8'}
            onMouseOut={e => e.currentTarget.style.borderColor = '#334155'}
        >
            <h3 style={{color:'#94a3b8', marginBottom:'10px', fontSize:'0.9em'}}>رفع فيديو</h3>
            <div style={{fontSize:'24px', fontWeight:'bold', color:'#ef4444'}}>🎬 يوتيوب</div>
            <p style={{fontSize:'12px', color:'#64748b'}}>إضافة رابط للشابتر</p>
        </div>

        {/* Card 3: Upload PDF */}
        <div 
            onClick={() => checkSelectionAndSetMode('add_pdf')}
            style={{background:'#1e293b', padding:'25px', borderRadius:'12px', border:'1px solid #334155', boxShadow:'0 4px 6px rgba(0,0,0,0.1)', cursor:'pointer', transition:'0.2s'}}
            onMouseOver={e => e.currentTarget.style.borderColor = '#38bdf8'}
            onMouseOut={e => e.currentTarget.style.borderColor = '#334155'}
        >
            <h3 style={{color:'#94a3b8', marginBottom:'10px', fontSize:'0.9em'}}>رفع ملفات</h3>
            <div style={{fontSize:'24px', fontWeight:'bold', color:'#38bdf8'}}>📄 ملف PDF</div>
            <p style={{fontSize:'12px', color:'#64748b'}}>رفع مباشر للسيرفر</p>
        </div>

        {/* Card 4: Navigation Info */}
        <div style={{background:'#1e293b', padding:'25px', borderRadius:'12px', border:'1px solid #334155', boxShadow:'0 4px 6px rgba(0,0,0,0.1)'}}>
            <h3 style={{color:'#94a3b8', marginBottom:'10px', fontSize:'0.9em'}}>المسار الحالي</h3>
            <div style={{fontSize:'16px', fontWeight:'bold', color:'#fff'}}>
                {selectedCourse ? selectedCourse.title : 'اختر كورس'} 
                {selectedSubject ? ` > ${selectedSubject.title}` : ''}
                {selectedChapter ? ` > ${selectedChapter.title}` : ''}
            </div>
            <p style={{fontSize:'12px', color:'#64748b'}}>تصفح لاختيار مكان الإضافة</p>
        </div>

      </div>

      {/* Breadcrumbs Navigation */}
      <div style={{marginBottom: '20px', color: '#38bdf8', cursor: 'pointer', fontSize: '1.1em'}}>
          <span onClick={() => { setSelectedCourse(null); setSelectedSubject(null); setSelectedChapter(null); setViewMode('list'); }}>الرئيسية</span>
          {selectedCourse && <span onClick={() => { setSelectedSubject(null); setSelectedChapter(null); setViewMode('list'); }}> &gt; {selectedCourse.title}</span>}
          {selectedSubject && <span onClick={() => { setSelectedChapter(null); setViewMode('list'); }}> &gt; {selectedSubject.title}</span>}
          {selectedChapter && <span> &gt; {selectedChapter.title}</span>}
      </div>

      {loading && <div style={{textAlign:'center', padding:'20px', color:'#38bdf8'}}>جاري التحميل...</div>}

      {/* Main Content Area */}
      <div className="content-area" style={{background:'#111827', padding:'20px', borderRadius:'12px', minHeight:'400px'}}>
          
          {/* Level 1: Courses */}
          {!selectedCourse && !loading && (
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:'15px'}}>
                  {courses.map(c => (
                      <div key={c.id} onClick={() => setSelectedCourse(c)} style={cardStyle}>
                          <h3>📦 {c.title}</h3>
                      </div>
                  ))}
              </div>
          )}

          {/* Level 2: Subjects */}
          {selectedCourse && !selectedSubject && !loading && (
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:'15px'}}>
                  {selectedCourse.subjects.map(s => (
                      <div key={s.id} onClick={() => setSelectedSubject(s)} style={cardStyle}>
                          <h3>📖 {s.title}</h3>
                      </div>
                  ))}
              </div>
          )}

          {/* Level 3: Chapters & Exams List */}
          {selectedSubject && !selectedChapter && viewMode === 'list' && !loading && (
              <div>
                  <h3 style={{color:'#fff', marginBottom:'15px'}}>📂 شباتر المادة (اضغط للدخول وإضافة محتوى):</h3>
                  {/* هنا يجب عرض الشباتر، سنفترض وجودها أو يمكن إضافتها */}
                  <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:'15px', marginBottom:'30px'}}>
                      <div style={cardStyle} onClick={() => setSelectedChapter({id: 1, title: 'شابتر افتراضي 1'})}>
                          <h3>📁 شابتر 1 (مثال)</h3>
                      </div>
                      {/* عرض باقي الشباتر هنا */}
                  </div>

                  <h3 style={{color:'#fff', marginBottom:'15px', borderTop:'1px solid #334155', paddingTop:'20px'}}>📝 الامتحانات الحالية:</h3>
                  <div style={{background:'#1e293b', padding:'15px', borderRadius:'8px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                        <span style={{color:'white'}}>امتحان شامل (مثال)</span>
                        <div>
                            <button onClick={() => loadExamStats(1)} style={btnStylePrimary}>📊 إحصائيات</button>
                            <button onClick={() => deleteItem('exams', 1)} style={btnStyleDanger}>🗑️ حذف</button>
                        </div>
                  </div>
              </div>
          )}

          {/* View: Add Video */}
          {viewMode === 'add_video' && (
            <div style={formBoxStyle}>
                <h3>🎬 إضافة فيديو يوتيوب</h3>
                <form onSubmit={handleVideoAdd}>
                    <label style={labelStyle}>عنوان الفيديو</label>
                    <input name="title" required placeholder="مثال: شرح الدرس الأول" style={inputStyle} />
                    <label style={labelStyle}>رابط الفيديو (YouTube)</label>
                    <input name="url" required placeholder="https://youtu.be/..." style={inputStyle} />
                    <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
                        <button type="submit" style={btnStylePrimary}>حفظ</button>
                        <button type="button" style={btnStyleDanger} onClick={() => setViewMode('list')}>إلغاء</button>
                    </div>
                </form>
            </div>
          )}

          {/* View: Add PDF */}
          {viewMode === 'add_pdf' && (
            <div style={formBoxStyle}>
                <h3>📄 رفع ملف PDF</h3>
                <form onSubmit={handlePdfUpload}>
                    <label style={labelStyle}>عنوان الملف</label>
                    <input name="title" required placeholder="مثال: ملزمة المراجعة" style={inputStyle} />
                    <label style={labelStyle}>اختر الملف</label>
                    <input type="file" name="file" accept="application/pdf" required style={inputStyle} />
                    <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
                        <button type="submit" style={btnStylePrimary}>رفع وحفظ</button>
                        <button type="button" style={btnStyleDanger} onClick={() => setViewMode('list')}>إلغاء</button>
                    </div>
                </form>
            </div>
          )}

          {/* View: Add Exam */}
          {viewMode === 'add_exam' && (
            <div style={{maxWidth:'800px', margin:'0 auto'}}>
                <h3 style={{color:'white'}}>📝 إنشاء امتحان جديد</h3>
                <div style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
                    <input value={examForm.title} onChange={e=>setExamForm({...examForm, title: e.target.value})} placeholder="عنوان الامتحان" style={inputStyle} />
                    <input type="number" value={examForm.duration} onChange={e=>setExamForm({...examForm, duration: e.target.value})} placeholder="المدة (د)" style={{...inputStyle, width:'100px'}} />
                </div>

                <div style={{background:'#1f2937', padding:'20px', borderRadius:'10px', border:'1px dashed #38bdf8'}}>
                    <h4 style={{color:'#38bdf8', marginTop:0}}>إضافة سؤال:</h4>
                    <textarea 
                        value={currentQuestion.text} 
                        onChange={e=>setCurrentQuestion({...currentQuestion, text: e.target.value})} 
                        placeholder="نص السؤال..." 
                        rows="2"
                        style={inputStyle}
                    ></textarea>
                    
                    <div style={{margin:'10px 0'}}>
                        <label style={{color:'#cbd5e1', fontSize:'0.9em'}}>صورة السؤال (اختياري): {uploadingImg && 'جاري الرفع...'}</label>
                        <input type="file" accept="image/*" onChange={handleQuestionImageUpload} style={{...inputStyle, padding:'5px'}} />
                        {currentQuestion.image && <span style={{color:'#4ade80', fontSize:'0.9em'}}> تم إرفاق الصورة ✅</span>}
                    </div>

                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
                        {currentQuestion.options.map((opt, idx) => (
                            <div key={idx} style={{display:'flex', alignItems:'center', gap:'5px'}}>
                                <input 
                                    type="radio" 
                                    name="correctOpt" 
                                    checked={currentQuestion.correctIndex === idx} 
                                    onChange={() => setCurrentQuestion({...currentQuestion, correctIndex: idx})}
                                    style={{accentColor:'#38bdf8'}}
                                />
                                <input 
                                    value={opt} 
                                    onChange={e => {
                                        const newOpts = [...currentQuestion.options];
                                        newOpts[idx] = e.target.value;
                                        setCurrentQuestion({...currentQuestion, options: newOpts});
                                    }}
                                    placeholder={`الخيار ${idx + 1}`}
                                    style={inputStyle}
                                />
                            </div>
                        ))}
                    </div>
                    <button onClick={addQuestionToExam} style={{...btnStylePrimary, width:'100%', marginTop:'15px'}}>➕ إضافة السؤال للقائمة</button>
                </div>

                {/* Exam Preview */}
                <div style={{marginTop:'20px'}}>
                    <h4 style={{color:'white'}}>الأسئلة المضافة ({examForm.questions.length}):</h4>
                    {examForm.questions.map((q, i) => (
                        <div key={i} style={{background:'#1e293b', padding:'10px', margin:'5px 0', borderRadius:'6px'}}>
                            <strong style={{color:'white'}}>{i+1}. {q.text}</strong>
                            {q.image && <span style={{color:'#facc15', fontSize:'0.8em'}}> [صورة] </span>}
                            <div style={{color:'#4ade80', fontSize:'0.9em'}}>الإجابة: {q.options[q.correctIndex]}</div>
                        </div>
                    ))}
                </div>

                <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
                    <button onClick={saveExam} style={btnStylePrimary}>حفظ الامتحان النهائي 💾</button>
                    <button onClick={() => setViewMode('list')} style={btnStyleDanger}>إلغاء</button>
                </div>
            </div>
          )}

          {/* View: Stats */}
          {viewMode === 'view_stats' && examStats && (
            <div style={formBoxStyle}>
                <h3 style={{textAlign:'center', color:'white'}}>📊 إحصائيات الامتحان</h3>
                <div style={{display:'flex', gap:'40px', justifyContent:'center', margin:'30px 0'}}>
                    <div style={{textAlign:'center'}}>
                        <h1 style={{margin:0, color:'white'}}>{examStats.totalAttempts}</h1>
                        <span style={{color:'#94a3b8'}}>عدد المحاولات</span>
                    </div>
                    <div style={{textAlign:'center'}}>
                        <h1 style={{margin:0, color:'#facc15'}}>{examStats.averageScore}%</h1>
                        <span style={{color:'#94a3b8'}}>متوسط الدرجات</span>
                    </div>
                </div>
                
                <table style={{width:'100%', borderCollapse:'collapse', color:'white'}}>
                    <thead>
                        <tr style={{background:'#334155'}}>
                            <th style={{padding:'10px'}}>الطالب</th>
                            <th style={{padding:'10px'}}>الدرجة</th>
                            <th style={{padding:'10px'}}>التاريخ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {examStats.attempts.map((att, i) => (
                            <tr key={i} style={{borderBottom:'1px solid #334155'}}>
                                <td style={{padding:'10px', textAlign:'center'}}>{att.student_name_input || 'غير معروف'}</td>
                                <td style={{padding:'10px', textAlign:'center', color: att.score >= 50 ? '#4ade80' : '#ef4444'}}>{att.score}%</td>
                                <td style={{padding:'10px', textAlign:'center'}}>{new Date(att.created_at).toLocaleDateString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <button onClick={() => setViewMode('list')} style={{...btnStylePrimary, marginTop:'20px', width:'100%'}}>عودة</button>
            </div>
          )}

      </div>
    </AdminLayout>
  );
}

// --- Inline Styles for Consistency ---
const cardStyle = {
    background: '#1e293b', 
    padding: '20px', 
    borderRadius: '10px', 
    border: '1px solid #334155', 
    cursor: 'pointer', 
    textAlign: 'center',
    color: 'white',
    transition: '0.2s'
};

const formBoxStyle = {
    background: '#1e293b', 
    padding: '30px', 
    borderRadius: '12px', 
    maxWidth: '600px', 
    margin: '0 auto', 
    border: '1px solid #334155',
    color: 'white'
};

const inputStyle = {
    width: '100%', 
    padding: '12px', 
    margin: '8px 0', 
    background: '#0f172a', 
    border: '1px solid #475569', 
    color: 'white', 
    borderRadius: '6px'
};

const labelStyle = {
    display: 'block', 
    marginTop: '10px', 
    color: '#cbd5e1'
};

const btnStylePrimary = {
    padding: '10px 20px', 
    borderRadius: '6px', 
    border: 'none', 
    cursor: 'pointer', 
    fontWeight: 'bold', 
    background: '#38bdf8', 
    color: '#0f172a'
};

const btnStyleDanger = {
    padding: '10px 20px', 
    borderRadius: '6px', 
    border: 'none', 
    cursor: 'pointer', 
    fontWeight: 'bold', 
    background: '#ef4444', 
    color: 'white'
};
