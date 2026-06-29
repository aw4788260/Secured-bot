import TeacherLayout from '../../../../components/TeacherLayout';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';

// --- أيقونات SVG الاحترافية ---
const Icons = {
    back: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>,
    chart: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>,
    users: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
    percent: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="5" x2="5" y2="19"></line><circle cx="6.5" cy="6.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle></svg>,
    target: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>,
    studentTab: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>,
    analysisTab: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
    eye: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>,
    zoom: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>,
    check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>,
    close: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
    doc: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
    alert: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
};

export default function ExamStatsPage() {
  const router = useRouter();
  const { id: examId } = router.query;

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('students'); // 'students' | 'analysis'

  // حالات نافذة تفاصيل إجابة الطالب
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [attemptDetails, setAttemptDetails] = useState(null);
  const [loadingAttempt, setLoadingAttempt] = useState(false);

  // ✅ حالات تصحيح الأسئلة المقالية يدوياً
  const [gradingInputs, setGradingInputs] = useState({}); // { [questionId]: { score, feedback } }
  const [savingGrades, setSavingGrades] = useState(false);
  const [gradeError, setGradeError] = useState('');

  // حالة الصورة المكبرة
  const [zoomedImage, setZoomedImage] = useState(null);

  const fetchStats = async () => {
    if (!examId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/teacher/exam-stats?examId=${examId}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to load stats", err);
    } finally {
      setLoading(false);
    }
  };

  // جلب الإحصائيات العامة للامتحان
  useEffect(() => {
    fetchStats();
  }, [examId]);

  // دالة فتح نتيجة الطالب التفصيلية (ورقة الإجابة)
  const openStudentResult = async (attempt_id) => {
    setSelectedAttempt(attempt_id);
    setLoadingAttempt(true);
    setGradeError('');
    try {
      const res = await fetch(`/api/dashboard/teacher/get-attempt-details?attemptId=${attempt_id}`);
      if (res.ok) {
        const data = await res.json();
        setAttemptDetails(data);

        // ✅ تهيئة قيم التصحيح الابتدائية من البيانات المحفوظة (إن وجدت)
        const initialInputs = {};
        (data.questions_details || []).forEach(q => {
          if (q.question_type === 'essay') {
            initialInputs[q.id] = {
              score: q.earned_score !== null && q.earned_score !== undefined ? String(q.earned_score) : '',
              feedback: q.teacher_feedback || ''
            };
          }
        });
        setGradingInputs(initialInputs);
      }
    } catch (err) {
      console.error("Failed to load attempt details", err);
    } finally {
      setLoadingAttempt(false);
    }
  };

  const updateGradingInput = (questionId, field, value) => {
    setGradingInputs(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], [field]: value }
    }));
  };

  // ✅ نشر تصحيح الأسئلة المقالية وحساب الدرجة النهائية
  const publishGrades = async () => {
    if (!attemptDetails) return;
    setGradeError('');

    const essayQuestions = (attemptDetails.questions_details || []).filter(q => q.question_type === 'essay');

    const grades = [];
    for (const q of essayQuestions) {
      const input = gradingInputs[q.id];
      const scoreVal = parseFloat(input?.score);
      if (input?.score === '' || input?.score === undefined || isNaN(scoreVal)) {
        setGradeError(`يجب إدخال درجة لكل سؤال مقالي قبل النشر (السؤال غير مصحح: "${q.text?.substring(0, 30)}...")`);
        return;
      }
      if (scoreVal < 0 || scoreVal > q.max_score) {
        setGradeError(`الدرجة المدخلة لسؤال "${q.text?.substring(0, 30)}..." يجب أن تكون بين 0 و ${q.max_score}`);
        return;
      }
      grades.push({ questionId: q.id, earnedScore: scoreVal, feedback: input.feedback || '' });
    }

    setSavingGrades(true);
    try {
      const res = await fetch('/api/dashboard/teacher/publish-grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId: selectedAttempt, grades })
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedAttempt(null);
        setAttemptDetails(null);
        await fetchStats();
      } else {
        setGradeError(data.error || 'فشل حفظ التصحيح');
      }
    } catch (err) {
      setGradeError('حدث خطأ في الاتصال بالسيرفر');
    } finally {
      setSavingGrades(false);
    }
  };

  if (loading) {
    return (
      <TeacherLayout title="جاري التحميل...">
        <div className="loader-container">
            <div className="spinner"></div>
            <p>جاري تحميل إحصائيات الامتحان...</p>
        </div>
        <style jsx>{`
          .loader-container { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; color: var(--gold); font-weight: bold; }
          .spinner { width: 44px; height: 44px; border: 4px solid var(--border); border-top: 4px solid var(--gold); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 15px; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}</style>
      </TeacherLayout>
    );
  }

  if (!stats) return <TeacherLayout title="خطأ"><div className="empty-state">حدث خطأ في تحميل البيانات.</div></TeacherLayout>;

  return (
    <TeacherLayout title={`إحصائيات | ${stats.examTitle}`}>
      
      {/* ── PAGE HEADER ── */}
      <div className="page-header">
          <div className="title-area">
              <div className="title-icon">{Icons.chart}</div>
              <div>
                  <h1 className="page-title">إحصائيات: {stats.examTitle}</h1>
                  <p className="page-sub">تحليل شامل لأداء الطلاب ونتائج الامتحان.</p>
              </div>
          </div>
          <button className="btn-secondary" onClick={() => router.push('/admin/teacher/content')}>
              <span className="icon-wrap">{Icons.back}</span> رجوع
          </button>
      </div>

      {/* ── SUMMARY CARDS ── */}
      <div className="summary-grid">
          <div className="stat-card">
              <div className="stat-icon blue-icon">{Icons.users}</div>
              <div className="stat-info">
                  <span className="stat-label">إجمالي الطلاب</span>
                  <span className="stat-value">{stats.totalAttempts}</span>
              </div>
          </div>
          <div className="stat-card">
              <div className="stat-icon yellow-icon">{Icons.percent}</div>
              <div className="stat-info">
                  <span className="stat-label">متوسط النسبة</span>
                  <span className="stat-value highlight-yellow">{stats.averagePercentage}%</span>
              </div>
          </div>
          <div className="stat-card">
              <div className="stat-icon green-icon">{Icons.target}</div>
              <div className="stat-info">
                  <span className="stat-label">متوسط الدرجات</span>
                  <span className="stat-value highlight-green">{stats.averageScore}</span>
              </div>
          </div>
      </div>

      {/* ── TABS SWITCHER ── */}
      <div className="tabs-wrapper">
          <div className="tabs-container">
              <button className={`tab ${activeTab === 'students' ? 'active' : ''}`} onClick={() => setActiveTab('students')}>
                  <span className="icon-wrap">{Icons.studentTab}</span> نتائج الطلاب
              </button>
              <button className={`tab ${activeTab === 'analysis' ? 'active' : ''}`} onClick={() => setActiveTab('analysis')}>
                  <span className="icon-wrap">{Icons.analysisTab}</span> تحليل صعوبة الأسئلة
              </button>
          </div>
      </div>

      {/* ── TAB CONTENT 1: STUDENTS TABLE ── */}
      {activeTab === 'students' && (
          <>
          {/* ✅ لوحة المحاولات بانتظار التصحيح اليدوي (أسئلة مقالية) */}
          {stats.pendingAttempts && stats.pendingAttempts.length > 0 && (
              <div className="panel animate-fade pending-panel">
                  <div className="pending-header">
                      <span className="icon-wrap" style={{color: '#facc15'}}>{Icons.alert}</span>
                      <h4>بانتظار التصحيح اليدوي ({stats.pendingAttempts.length})</h4>
                  </div>
                  <div className="table-responsive">
                      <table className="custom-table">
                          <thead>
                              <tr>
                                  <th style={{width: '50px'}}>م</th>
                                  <th>اسم الطالب</th>
                                  <th style={{textAlign:'center'}}>رقم الهاتف</th>
                                  <th style={{textAlign:'center'}}>تاريخ التسليم</th>
                                  <th style={{textAlign:'center'}}>التصحيح</th>
                              </tr>
                          </thead>
                          <tbody>
                              {stats.pendingAttempts.map((a, i) => (
                                  <tr key={a.attempt_id} className="hover-row">
                                      <td className="muted-text">{i + 1}</td>
                                      <td className="primary-text bold-text">{a.student_name_input}</td>
                                      <td className="mono-text center-text ltr-dir">{a.phone}</td>
                                      <td className="center-text muted-text text-sm">
                                          {a.completed_at ? new Date(a.completed_at).toLocaleString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                      </td>
                                      <td className="center-text">
                                          <button className="btn-view pending-btn" onClick={() => openStudentResult(a.attempt_id)} title="تصحيح الإجابات">
                                              <span className="icon-wrap">{Icons.eye}</span> تصحيح الآن
                                          </button>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          )}

          <div className="panel animate-fade">
              <div className="table-responsive">
                  <table className="custom-table">
                      <thead>
                          <tr>
                              <th style={{width: '50px'}}>م</th>
                              <th>اسم الطالب</th>
                              <th style={{textAlign:'center'}}>رقم الهاتف</th>
                              <th style={{textAlign:'center'}}>النسبة</th>
                              <th style={{textAlign:'center'}}>الدرجة</th>
                              <th style={{textAlign:'center'}}>تاريخ التسليم</th>
                              <th style={{textAlign:'center'}}>ورقة الإجابة</th>
                          </tr>
                      </thead>
                      <tbody>
                          {stats.attempts.map((a, i) => (
                              <tr key={a.attempt_id} className="hover-row">
                                  <td className="muted-text">{i + 1}</td>
                                  <td className="primary-text bold-text">{a.student_name_input}</td>
                                  <td className="mono-text center-text ltr-dir">{a.phone}</td>
                                  <td className="center-text bold-text" style={{color: a.percentage >= 50 ? '#22c55e' : '#ef4444'}}>
                                      {a.percentage}%
                                  </td>
                                  <td className="center-text bold-text primary-text">{a.score}</td>
                                  <td className="center-text muted-text text-sm">
                                      {a.completed_at ? new Date(a.completed_at).toLocaleString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                  </td>
                                  <td className="center-text">
                                      <button className="btn-view" onClick={() => openStudentResult(a.attempt_id)} title="عرض الإجابات">
                                          <span className="icon-wrap">{Icons.eye}</span> عرض
                                      </button>
                                  </td>
                              </tr>
                          ))}
                          {stats.attempts.length === 0 && (
                              <tr><td colSpan="7" className="empty-row">لا يوجد طلاب قاموا بحل هذا الامتحان حتى الآن.</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
          </>
      )}

      {/* ── TAB CONTENT 2: QUESTION ANALYSIS ── */}
      {activeTab === 'analysis' && (
          <div className="analysis-grid animate-fade">
              {[...(stats.questionStats || [])].sort((a, b) => {
                  const tA = parseInt(a.total_answers) || 0;
                  const wA = parseInt(a.wrong_answers) || 0;
                  const percA = tA > 0 ? (wA / tA) : 0;

                  const tB = parseInt(b.total_answers) || 0;
                  const wB = parseInt(b.wrong_answers) || 0;
                  const percB = tB > 0 ? (wB / tB) : 0;

                  return percB - percA; 
              }).map((q, i) => {
                  const total = parseInt(q.total_answers) || 0;
                  const correct = parseInt(q.correct_answers) || 0;
                  const wrong = parseInt(q.wrong_answers) || 0;
                  
                  const correctPerc = total > 0 ? Math.round((correct / total) * 100) : 0;
                  const wrongPerc = total > 0 ? Math.round((wrong / total) * 100) : 0;

                  return (
                      <div key={q.question_id} className="q-stat-card">
                          
                          {q.image_file_id && (
                              <div className="q-image" onClick={() => setZoomedImage(`/api/admin/file-proxy?type=exam_images&filename=${q.image_file_id}`)}>
                                  <img src={`/api/admin/file-proxy?type=exam_images&filename=${q.image_file_id}`} alt="Question" loading="lazy" />
                                  <div className="zoom-hint"><span className="icon-wrap">{Icons.zoom}</span> تكبير</div>
                              </div>
                          )}

                          <div className="question-text-box">
                              <h4 className="q-text"><span className="q-num-highlight">{i + 1}.</span> {q.question_text}</h4>
                          </div>

                          <div className="q-meta">
                              أجاب على هذا السؤال: <strong>{total} طالب</strong>
                          </div>
                          
                          <div className="overall-summary">
                              <span className="badge-pill green-pill">إجابات صحيحة: {correctPerc}%</span>
                              <span className="badge-pill red-pill">إجابات خاطئة: {wrongPerc}%</span>
                          </div>

                          <div className="options-breakdown">
                              <h5 className="breakdown-title">تحليل اختيار الطلاب للإجابات:</h5>
                              
                              {q.options?.sort((o1, o2) => parseInt(o2.selection_count) - parseInt(o1.selection_count)).map(opt => {
                                  const optCount = parseInt(opt.selection_count) || 0;
                                  const optPerc = total > 0 ? Math.round((optCount / total) * 100) : 0;
                                  const isCorrect = opt.is_correct;

                                  return (
                                      <div key={opt.option_id} className={`opt-stat-row ${isCorrect ? 'is-correct' : ''}`}>
                                          <div className="opt-stat-info">
                                              <span className="opt-text">
                                                  <span className="icon-wrap opt-icon">{isCorrect ? Icons.check : Icons.close}</span>
                                                  {opt.option_text}
                                              </span>
                                              <span className="opt-count">{optPerc}% ({optCount} طالب)</span>
                                          </div>
                                          <div className="opt-progress-bar">
                                              <div className={`opt-fill ${isCorrect ? 'green-fill' : 'gray-fill'}`} style={{width: `${optPerc}%`}}></div>
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      </div>
                  );
              })}
              {(!stats.questionStats || stats.questionStats.length === 0) && (
                  <div className="empty-state full-span">لا توجد إحصائيات للأسئلة حالياً.</div>
              )}
          </div>
      )}

      {/* ── MODAL: STUDENT ATTEMPT DETAILS ── */}
      {selectedAttempt && (
          <div className="modal-overlay" onClick={() => setSelectedAttempt(null)}>
              <div className="modal-box large" onClick={e => e.stopPropagation()}>
                  
                  <div className="modal-header">
                      <div className="modal-title">
                          <span className="icon-wrap" style={{color: 'var(--gold)'}}>{Icons.doc}</span>
                          <h3>ورقة إجابة الطالب</h3>
                      </div>
                      <button className="close-btn" onClick={() => setSelectedAttempt(null)}>{Icons.close}</button>
                  </div>

                  {loadingAttempt || !attemptDetails ? (
                      <div className="loading-state inner-modal">
                          <div className="spinner"></div>
                          <p>جاري تحميل الإجابات...</p>
                      </div>
                  ) : (
                      <>
                      <div className="modal-body custom-scrollbar">
                          <div className="student-info-card">
                              <div className="s-name">{attemptDetails.student.name}</div>
                              {attemptDetails.status === 'pending_grading' ? (
                                  <div className="s-score">
                                      <span className="badge-pill pending-pill">
                                          <span className="icon-wrap">{Icons.alert}</span> بانتظار التصحيح اليدوي
                                      </span>
                                  </div>
                              ) : (
                                  <div className="s-score">
                                      الدرجة: <span className="highlight-yellow">{attemptDetails.exam.score} / {attemptDetails.exam.total_questions}</span> 
                                      <span className="perc-bracket">({attemptDetails.exam.percentage}%)</span>
                                  </div>
                              )}
                          </div>

                          <div className="questions-list">
                              {attemptDetails.questions_details.map((q, i) => (
                                  <div key={q.id} className="q-detail-card">
                                      
                                      {q.image && (
                                          <div className="q-image" onClick={() => setZoomedImage(`/api/admin/file-proxy?type=exam_images&filename=${q.image}`)}>
                                              <img src={`/api/admin/file-proxy?type=exam_images&filename=${q.image}`} alt="Question" loading="lazy" />
                                              <div className="zoom-hint"><span className="icon-wrap">{Icons.zoom}</span> تكبير</div>
                                          </div>
                                      )}

                                      <div className="q-head">
                                          <div className="question-text-box flex-row">
                                              <span className="q-num-circle">{i + 1}</span>
                                              <p>{q.text}</p>
                                          </div>
                                          <div className="q-status">
                                              {q.question_type === 'essay' ? (
                                                  q.is_graded ? (
                                                      <span className="badge-pill green-pill">{q.earned_score} / {q.max_score}</span>
                                                  ) : (
                                                      <span className="badge-pill pending-pill"><span className="icon-wrap">{Icons.alert}</span> غير مُصحح</span>
                                                  )
                                              ) : (
                                                  q.is_student_correct ? (
                                                      <span className="badge-pill green-pill"><span className="icon-wrap">{Icons.check}</span> صحيح</span>
                                                  ) : (
                                                      <span className="badge-pill red-pill"><span className="icon-wrap">{Icons.close}</span> خطأ</span>
                                                  )
                                              )}
                                          </div>
                                      </div>

                                      {q.question_type === 'essay' ? (
                                          <div className="essay-grading-box">
                                              <label className="section-label">إجابة الطالب:</label>
                                              <div className="essay-answer-text">
                                                  {q.text_answer ? q.text_answer : <span className="no-answer-inline">لم يكتب الطالب إجابة لهذا السؤال.</span>}
                                              </div>

                                              <div className="grading-row">
                                                  <div className="grading-field">
                                                      <label className="field-label">الدرجة (من {q.max_score})</label>
                                                      <input
                                                          type="number"
                                                          min="0"
                                                          max={q.max_score}
                                                          step="0.5"
                                                          className="input small"
                                                          placeholder={`0 - ${q.max_score}`}
                                                          value={gradingInputs[q.id]?.score ?? ''}
                                                          onChange={e => updateGradingInput(q.id, 'score', e.target.value)}
                                                          disabled={attemptDetails.status !== 'pending_grading'}
                                                      />
                                                  </div>
                                                  <div className="grading-field grow">
                                                      <label className="field-label">ملاحظات للطالب (اختياري)</label>
                                                      <input
                                                          type="text"
                                                          className="input small"
                                                          placeholder="ملاحظة على إجابة الطالب..."
                                                          value={gradingInputs[q.id]?.feedback ?? ''}
                                                          onChange={e => updateGradingInput(q.id, 'feedback', e.target.value)}
                                                          disabled={attemptDetails.status !== 'pending_grading'}
                                                      />
                                                  </div>
                                              </div>
                                          </div>
                                      ) : (
                                          <div className="options-list">
                                              {q.options.map(opt => {
                                                  let optClass = "opt-row ";
                                                  let badge = null;

                                                  if (opt.id === q.correct_option_id) {
                                                      optClass += "correct-opt ";
                                                      badge = <span className="opt-badge green-badge">الإجابة الصحيحة</span>;
                                                  }
                                                  
                                                  if (opt.id === q.student_selected_option_id && !q.is_student_correct) {
                                                      optClass += "wrong-opt ";
                                                      badge = <span className="opt-badge red-badge">اختيار الطالب</span>;
                                                  }

                                                  if (opt.id === q.student_selected_option_id && q.is_student_correct) {
                                                      badge = <span className="opt-badge green-badge">اختيار الطالب (صحيح)</span>;
                                                  }

                                                  return (
                                                      <div key={opt.id} className={optClass}>
                                                          <div className="opt-text-inner">{opt.text}</div>
                                                          {badge}
                                                      </div>
                                                  );
                                              })}
                                              {!q.student_selected_option_id && (
                                                  <div className="no-answer-warning">
                                                      <span className="icon-wrap">{Icons.alert}</span> لم يقم الطالب باختيار أي إجابة لهذا السؤال.
                                                  </div>
                                              )}
                                          </div>
                                      )}
                                  </div>
                              ))}
                          </div>
                      </div>

                      {attemptDetails.status === 'pending_grading' && (
                          <div className="grading-footer">
                              {gradeError && <p className="grade-error">{gradeError}</p>}
                              <button className="btn-save-exam" disabled={savingGrades} onClick={publishGrades}>
                                  {savingGrades ? 'جاري الحفظ...' : 'حفظ التصحيح ونشر النتيجة للطالب'}
                              </button>
                          </div>
                      )}
                      </>
                  )}
              </div>
          </div>
      )}

      {/* ── MODAL: IMAGE ZOOM ── */}
      {zoomedImage && (
          <div className="modal-overlay image-zoom-overlay" onClick={() => setZoomedImage(null)}>
              <div className="zoomed-image-container" onClick={e => e.stopPropagation()}>
                  <button className="abs-close-btn" onClick={() => setZoomedImage(null)}>{Icons.close}</button>
                  <img src={zoomedImage} alt="Zoomed" />
              </div>
          </div>
      )}

      <style jsx>{`
        /* ── THEME VARS ── */
        .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; flex-wrap: wrap; gap: 20px; border-bottom: 1px solid var(--border); padding-bottom: 20px; }
        .title-area { display: flex; align-items: center; gap: 16px; }
        .title-icon { width: 50px; height: 50px; background: var(--gold-dim); color: var(--gold); border-radius: 14px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border-accent); }
        .page-title { margin: 0 0 6px 0; color: var(--text-primary); font-size: 1.6rem; font-weight: 800; }
        .page-sub { margin: 0; color: var(--text-secondary); font-size: 0.95rem; }

        .btn-secondary { background: var(--bg-elevated); color: var(--text-secondary); border: 1px solid var(--border); padding: 10px 20px; border-radius: 10px; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; font-size: 0.95rem; transition: 0.2s; }
        .btn-secondary:hover { background: var(--bg-hover); color: var(--text-primary); border-color: var(--text-muted); }
        
        .icon-wrap { display: flex; align-items: center; justify-content: center; }

        /* ── SUMMARY CARDS ── */
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 35px; }
        .stat-card { background: var(--bg-surface); padding: 20px; border-radius: 16px; border: 1px solid var(--border); display: flex; align-items: center; gap: 16px; box-shadow: var(--shadow); transition: transform 0.2s; }
        .stat-card:hover { transform: translateY(-4px); border-color: var(--border-accent); }
        .stat-icon { width: 54px; height: 54px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid transparent; }
        .blue-icon { background: rgba(56, 189, 248, 0.1); color: #38bdf8; border-color: rgba(56, 189, 248, 0.2); }
        .yellow-icon { background: rgba(250, 204, 21, 0.1); color: #facc15; border-color: rgba(250, 204, 21, 0.2); }
        .green-icon { background: rgba(34, 197, 94, 0.1); color: #4ade80; border-color: rgba(34, 197, 94, 0.2); }
        .stat-info { display: flex; flex-direction: column; gap: 4px; }
        .stat-label { color: var(--text-muted); font-size: 0.9rem; font-weight: bold; }
        .stat-value { color: var(--text-primary); font-size: 1.6rem; font-weight: 900; }
        .highlight-yellow { color: #facc15; }
        .highlight-green { color: #4ade80; }

        /* ── TABS ── */
        .tabs-wrapper { display: flex; justify-content: center; margin-bottom: 30px; }
        .tabs-container { display: inline-flex; background: var(--bg-surface); padding: 6px; border-radius: 14px; border: 1px solid var(--border); gap: 5px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .tab { background: transparent; color: var(--text-secondary); border: none; padding: 12px 24px; font-size: 1rem; font-weight: bold; cursor: pointer; border-radius: 10px; transition: all 0.3s ease; display: inline-flex; align-items: center; gap: 8px; }
        .tab:hover { color: var(--text-primary); background: var(--bg-hover); }
        .tab.active { background: var(--gold-dim); color: var(--gold); box-shadow: 0 2px 10px rgba(201,168,76,0.1); border: 1px solid var(--border-accent); }

        .animate-fade { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        /* ── TABLE ── */
        .panel { background: var(--bg-surface); border-radius: 16px; border: 1px solid var(--border); overflow: hidden; box-shadow: var(--shadow); }
        .table-responsive { overflow-x: auto; }
        .custom-table { width: 100%; border-collapse: collapse; min-width: 800px; text-align: right; }
        .custom-table th { padding: 16px; color: var(--text-secondary); background: var(--bg-elevated); border-bottom: 1px solid var(--border); font-size: 0.9rem; font-weight: bold; white-space: nowrap; }
        .custom-table td { padding: 16px; border-bottom: 1px solid var(--border); color: var(--text-primary); font-size: 0.95rem; vertical-align: middle; }
        .custom-table tbody tr:last-child td { border-bottom: none; }
        .hover-row { transition: background 0.2s; }
        .hover-row:hover { background: var(--bg-hover); }
        
        .muted-text { color: var(--text-muted); }
        .primary-text { color: var(--text-primary); }
        .bold-text { font-weight: 700; }
        .mono-text { font-family: monospace; }
        .center-text { text-align: center; }
        .ltr-dir { direction: ltr; }
        .text-sm { font-size: 0.85rem; }

        .btn-view { background: var(--gold-dimmer); border: 1px solid var(--border-accent); color: var(--gold); padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; font-weight: bold; transition: 0.2s; display: inline-flex; align-items: center; gap: 6px; }
        .btn-view:hover { background: var(--gold-dim); border-color: var(--gold); }
        .empty-row { text-align: center; padding: 40px; color: var(--text-muted); font-style: italic; }

        /* ── ANALYSIS GRID ── */
        .analysis-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 24px; }
        .q-stat-card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 16px; padding: 24px; box-shadow: var(--shadow); transition: transform 0.2s; }
        .q-stat-card:hover { border-color: var(--border-accent); transform: translateY(-3px); }
        
        .q-meta { color: var(--text-muted); font-size: 0.9rem; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px dashed var(--border); font-weight: bold; }
        .q-meta strong { color: var(--gold); }

        .question-text-box { background: var(--bg-elevated); border: 1px solid var(--border); border-right: 4px solid var(--gold); padding: 16px; border-radius: 10px; margin-bottom: 18px; }
        .question-text-box.flex-row { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 0; flex: 1; border-right: none; background: transparent; border: none; padding: 0; }
        .question-text-box h4, .question-text-box p { margin: 0; color: var(--text-primary); font-size: 1.05rem; line-height: 1.6; }
        .q-num-highlight { color: var(--gold); font-weight: 900; margin-left: 4px; }
        .q-num-circle { background: var(--gold-dim); color: var(--gold); width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; font-weight: bold; flex-shrink: 0; border: 1px solid var(--border-accent); }

        /* Image Zoom Styles */
        .q-image { position: relative; display: inline-block; cursor: zoom-in; margin-bottom: 18px; border-radius: 12px; overflow: hidden; border: 1px solid var(--border); transition: border-color 0.2s; background: var(--bg-base); max-width: 100%; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        .q-image:hover { border-color: var(--gold); }
        .q-image img { display: block; max-height: 220px; width: auto; object-fit: contain; transition: transform 0.4s ease; }
        .q-image:hover img { opacity: 0.7; transform: scale(1.03); filter: blur(1px); }
        .zoom-hint { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: var(--text-primary); background: rgba(0,0,0,0.6); padding: 10px 20px; border-radius: 20px; font-size: 0.95rem; font-weight: bold; opacity: 0; transition: opacity 0.3s; pointer-events: none; white-space: nowrap; display: flex; align-items: center; gap: 8px; backdrop-filter: blur(4px); }
        .q-image:hover .zoom-hint { opacity: 1; }
        
        .image-zoom-overlay { z-index: 20000; padding: 20px; }
        .zoomed-image-container { position: relative; display: flex; justify-content: center; align-items: center; max-width: 95vw; max-height: 95vh; animation: popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        .zoomed-image-container img { max-width: 100%; max-height: 90vh; border-radius: 16px; box-shadow: 0 15px 50px rgba(0,0,0,0.8); object-fit: contain; background: var(--bg-surface); }
        .abs-close-btn { position: absolute; top: -20px; right: -20px; background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border); border-radius: 50%; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.4); z-index: 10; transition: 0.2s; }
        .abs-close-btn:hover { transform: scale(1.1); background: #ef4444; color: white; border-color: #ef4444; }

        /* Options Breakdown */
        .overall-summary { display: flex; gap: 10px; margin-bottom: 24px; flex-wrap: wrap; }
        .badge-pill { padding: 6px 14px; border-radius: 8px; font-size: 0.85rem; font-weight: bold; display: inline-flex; align-items: center; gap: 6px; border: 1px solid transparent; }
        .green-pill { background: rgba(34, 197, 94, 0.1); color: #4ade80; border-color: rgba(34, 197, 94, 0.2); }
        .red-pill { background: rgba(239, 68, 68, 0.1); color: #fca5a5; border-color: rgba(239, 68, 68, 0.2); }

        .options-breakdown { background: var(--bg-base); padding: 18px; border-radius: 12px; border: 1px solid var(--border); }
        .breakdown-title { color: var(--text-muted); margin: 0 0 16px 0; font-size: 0.95rem; font-weight: bold; }
        .opt-stat-row { margin-bottom: 14px; }
        .opt-stat-row:last-child { margin-bottom: 0; }
        .opt-stat-info { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.9rem; color: var(--text-secondary); align-items: center; }
        .opt-stat-row.is-correct .opt-stat-info { color: #4ade80; font-weight: bold; }
        .opt-text { display: flex; align-items: center; gap: 8px; }
        .opt-icon { font-size: 0.8rem; }
        .opt-count { font-family: monospace; color: var(--text-muted); }
        
        .opt-progress-bar { width: 100%; height: 6px; background: var(--bg-elevated); border-radius: 10px; overflow: hidden; }
        .opt-fill { height: 100%; border-radius: 10px; transition: width 0.8s cubic-bezier(0.16, 1, 0.3, 1); }
        .green-fill { background: #4ade80; }
        .gray-fill { background: var(--border-accent); }

        /* ── MODAL (Attempt Details) ── */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 1000; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(5px); padding: 20px; }
        .modal-box { background: var(--bg-surface); width: 100%; border-radius: 20px; border: 1px solid var(--border-accent); display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px rgba(0,0,0,0.5); animation: popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        .modal-box.large { max-width: 850px; height: 90vh; }
        
        .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; background: var(--bg-elevated); border-bottom: 1px solid var(--border); }
        .modal-title { display: flex; align-items: center; gap: 10px; }
        .modal-title h3 { margin: 0; color: var(--text-primary); font-size: 1.2rem; font-weight: bold; }
        .close-btn { background: var(--bg-surface); border: 1px solid var(--border); color: var(--text-secondary); width: 34px; height: 34px; border-radius: 8px; cursor: pointer; display: flex; justify-content: center; align-items: center; transition: 0.2s; }
        .close-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
        
        .modal-body { padding: 24px; overflow-y: auto; flex: 1; background: var(--bg-base); }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border-accent); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--gold); }

        .inner-modal { height: 100%; display: flex; flex-direction: column; justify-content: center; }

        .student-info-card { background: var(--bg-elevated); border: 1px solid var(--border); padding: 20px 24px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; border-right: 4px solid var(--gold); }
        .s-name { font-size: 1.3rem; font-weight: 900; color: var(--text-primary); }
        .s-score { font-size: 1.1rem; color: var(--text-secondary); font-weight: bold; }
        .perc-bracket { font-size: 0.95rem; color: var(--text-muted); margin-right: 6px; }

        .questions-list { display: flex; flex-direction: column; gap: 20px; }
        .q-detail-card { background: var(--bg-surface); border: 1px solid var(--border); padding: 24px; border-radius: 16px; box-shadow: var(--shadow); }
        .q-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; gap: 20px; }
        .q-status { flex-shrink: 0; }

        .options-list { display: flex; flex-direction: column; gap: 10px; }
        .opt-row { display: flex; justify-content: space-between; align-items: center; background: var(--bg-base); padding: 12px 16px; border-radius: 10px; border: 1px solid var(--border); color: var(--text-secondary); transition: 0.2s; }
        .opt-row.correct-opt { background: rgba(34, 197, 94, 0.05); border-color: #22c55e; color: var(--text-primary); }
        .opt-row.wrong-opt { background: rgba(239, 68, 68, 0.05); border-color: #ef4444; color: var(--text-primary); }
        .opt-text-inner { font-size: 0.95rem; line-height: 1.5; }

        .opt-badge { font-size: 0.8rem; padding: 4px 10px; border-radius: 6px; font-weight: bold; white-space: nowrap; flex-shrink: 0; }
        .green-badge { background: #22c55e; color: #111009; }
        .red-badge { background: #ef4444; color: white; }

        .no-answer-warning { color: #fca5a5; font-size: 0.9rem; margin-top: 15px; padding: 10px; background: rgba(239, 68, 68, 0.1); border-radius: 8px; text-align: center; border: 1px dashed rgba(239, 68, 68, 0.3); display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: bold; }

        /* ── PENDING GRADING PANEL ── */
        .pending-panel { margin-bottom: 24px; border-color: rgba(250, 204, 21, 0.3); }
        .pending-header { display: flex; align-items: center; gap: 10px; padding: 16px 20px; background: rgba(250, 204, 21, 0.08); border-bottom: 1px solid rgba(250, 204, 21, 0.2); }
        .pending-header h4 { margin: 0; color: #facc15; font-size: 1rem; font-weight: 800; }
        .pending-btn { background: rgba(250, 204, 21, 0.12); border-color: rgba(250, 204, 21, 0.4); color: #facc15; }
        .pending-btn:hover { background: rgba(250, 204, 21, 0.2); border-color: #facc15; }
        .pending-pill { background: rgba(250, 204, 21, 0.1); color: #facc15; border-color: rgba(250, 204, 21, 0.25); }

        /* ── ESSAY GRADING UI ── */
        .essay-grading-box { background: var(--bg-base); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-top: 4px; }
        .essay-answer-text { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 8px; padding: 14px; color: var(--text-primary); line-height: 1.7; white-space: pre-wrap; margin-bottom: 16px; font-size: 0.95rem; }
        .no-answer-inline { color: var(--text-muted); font-style: italic; }
        .grading-row { display: flex; gap: 16px; flex-wrap: wrap; }
        .grading-field { display: flex; flex-direction: column; gap: 6px; min-width: 140px; }
        .grading-field.grow { flex: 1; min-width: 220px; }
        .grading-footer { padding: 18px 24px; border-top: 1px solid var(--border); background: var(--bg-elevated); display: flex; flex-direction: column; gap: 10px; align-items: stretch; }
        .grade-error { color: #fca5a5; background: rgba(239, 68, 68, 0.1); border: 1px dashed rgba(239, 68, 68, 0.3); padding: 10px; border-radius: 8px; text-align: center; font-size: 0.9rem; font-weight: bold; margin: 0; }
        .btn-save-exam { background: linear-gradient(135deg, var(--gold), #b8923f); color: #111009; border: none; padding: 14px 24px; border-radius: 10px; font-weight: 800; font-size: 1rem; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 15px rgba(201,168,76,0.25); }
        .btn-save-exam:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(201,168,76,0.35); }
        .btn-save-exam:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .section-label { display: block; color: var(--text-secondary); font-size: 0.9rem; font-weight: bold; margin-bottom: 10px; }
        .field-label { color: var(--text-muted); font-size: 0.82rem; font-weight: bold; }
        .input { background: var(--bg-elevated); border: 1px solid var(--border); color: var(--text-primary); border-radius: 8px; padding: 10px 12px; font-size: 0.95rem; width: 100%; box-sizing: border-box; font-family: inherit; }
        .input:focus { outline: none; border-color: var(--gold); }
        .input.small { padding: 9px 12px; font-size: 0.9rem; }
        .input:disabled { opacity: 0.6; cursor: not-allowed; }

        .empty-state { text-align: center; padding: 40px; color: var(--text-muted); font-size: 1.05rem; }
        .full-span { grid-column: 1 / -1; }

        @keyframes popIn { from { transform: scale(0.95) translateY(10px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }

        @media (max-width: 768px) {
            .page-header { flex-direction: column; align-items: flex-start; gap: 15px; }
            .analysis-grid { grid-template-columns: 1fr; }
            .student-info-card { flex-direction: column; align-items: flex-start; gap: 12px; }
            .q-head { flex-direction: column; }
            .opt-row { flex-direction: column; align-items: flex-start; gap: 12px; }
            .tabs-container { flex-direction: column; width: 100%; }
            .tab { width: 100%; justify-content: center; }
        }
      `}</style>
    </TeacherLayout>
  );
}
