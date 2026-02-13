import TeacherLayout from '../../../../components/TeacherLayout';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';

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

  // جلب الإحصائيات العامة للامتحان
  useEffect(() => {
    if (!examId) return;
    const fetchStats = async () => {
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
    fetchStats();
  }, [examId]);

  // دالة فتح نتيجة الطالب التفصيلية (ورقة الإجابة)
  const openStudentResult = async (attempt_id) => {
    setSelectedAttempt(attempt_id);
    setLoadingAttempt(true);
    try {
      const res = await fetch(`/api/dashboard/teacher/get-attempt-details?attemptId=${attempt_id}`);
      if (res.ok) {
        const data = await res.json();
        setAttemptDetails(data);
      }
    } catch (err) {
      console.error("Failed to load attempt details", err);
    } finally {
      setLoadingAttempt(false);
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
          .loader-container { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; color: #38bdf8; }
          .spinner { width: 40px; height: 40px; border: 4px solid #334155; border-top: 4px solid #38bdf8; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 15px; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}</style>
      </TeacherLayout>
    );
  }

  if (!stats) return <TeacherLayout title="خطأ"><div style={{color:'white', padding:'20px'}}>حدث خطأ في تحميل البيانات.</div></TeacherLayout>;

  return (
    <TeacherLayout title={`إحصائيات | ${stats.examTitle}`}>
      
      {/* Header */}
      <div className="header-bar">
          <div className="title-area">
              <button className="back-btn" onClick={() => router.push('/admin/teacher/content')}>⬅️ رجوع</button>
              <div>
                  <h1>📊 إحصائيات: {stats.examTitle}</h1>
                  <p>تحليل أداء الطلاب ونتائج الامتحان</p>
              </div>
          </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
          <div className="stat-card">
              <div className="icon blue">👥</div>
              <div className="info"><span>إجمالي الطلاب</span><strong>{stats.totalAttempts}</strong></div>
          </div>
          <div className="stat-card">
              <div className="icon yellow">📈</div>
              <div className="info"><span>متوسط النسبة</span><strong style={{color:'#facc15'}}>{stats.averagePercentage}%</strong></div>
          </div>
          <div className="stat-card">
              <div className="icon green">🎯</div>
              <div className="info"><span>متوسط الدرجات</span><strong style={{color:'#4ade80'}}>{stats.averageScore}</strong></div>
          </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
          <button className={`tab ${activeTab === 'students' ? 'active' : ''}`} onClick={() => setActiveTab('students')}>
             👨‍🎓 نتائج الطلاب
          </button>
          <button className={`tab ${activeTab === 'analysis' ? 'active' : ''}`} onClick={() => setActiveTab('analysis')}>
             🔍 تحليل صعوبة الأسئلة
          </button>
      </div>

      {/* Tab Content 1: Students Table */}
      {activeTab === 'students' && (
          <div className="panel">
              <div className="table-responsive">
                  <table>
                      <thead>
                          <tr>
                              <th>م</th>
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
                              <tr key={a.attempt_id}>
                                  <td style={{color:'#64748b'}}>{i + 1}</td>
                                  <td style={{fontWeight:'bold', color:'white'}}>{a.student_name_input}</td>
                                  <td style={{textAlign:'center', fontFamily:'monospace'}} dir="ltr">{a.phone}</td>
                                  <td style={{textAlign:'center', color: a.percentage >= 50 ? '#4ade80' : '#ef4444', fontWeight:'bold'}}>
                                      {a.percentage}%
                                  </td>
                                  <td style={{textAlign:'center'}}>{a.score}</td>
                                  <td style={{textAlign:'center', color:'#94a3b8', fontSize:'0.9em'}}>
                                      {a.completed_at ? new Date(a.completed_at).toLocaleString('ar-EG') : '-'}
                                  </td>
                                  <td style={{textAlign:'center'}}>
                                      <button className="view-btn" onClick={() => openStudentResult(a.attempt_id)}>
                                          عرض الإجابات 👁️
                                      </button>
                                  </td>
                              </tr>
                          ))}
                          {stats.attempts.length === 0 && (
                              <tr><td colSpan="7" style={{textAlign:'center', padding:'30px', color:'#64748b'}}>لا يوجد طلاب قاموا بحل هذا الامتحان حتى الآن.</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* Tab Content 2: Question Analysis */}
      {activeTab === 'analysis' && (
          <div className="analysis-grid">
              {/* ✅ ترتيب الأسئلة بناءً على نسبة الخطأ (الأكثر خطأ يظهر أولاً) */}
              {[...(stats.questionStats || [])].sort((a, b) => {
                  const tA = parseInt(a.total_answers) || 0;
                  const wA = parseInt(a.wrong_answers) || 0;
                  const percA = tA > 0 ? (wA / tA) : 0;

                  const tB = parseInt(b.total_answers) || 0;
                  const wB = parseInt(b.wrong_answers) || 0;
                  const percB = tB > 0 ? (wB / tB) : 0;

                  return percB - percA; // ترتيب تنازلي للأكثر خطأ
              }).map((q, i) => {
                  const total = parseInt(q.total_answers) || 0;
                  const correct = parseInt(q.correct_answers) || 0;
                  const wrong = parseInt(q.wrong_answers) || 0;
                  
                  const correctPerc = total > 0 ? Math.round((correct / total) * 100) : 0;
                  const wrongPerc = total > 0 ? Math.round((wrong / total) * 100) : 0;

                  return (
                      <div key={q.question_id} className="q-stat-card">
                          <h4 className="q-text"><span>{i + 1}.</span> {q.question_text}</h4>
                          <div className="q-meta">أجاب على هذا السؤال: <strong>{total} طالب</strong></div>
                          
                          <div className="progress-wrapper">
                              <div className="progress-labels">
                                  <span style={{color:'#4ade80'}}>إجابات صحيحة ({correct})</span>
                                  <span style={{color:'#4ade80'}}>{correctPerc}%</span>
                              </div>
                              <div className="progress-bar"><div className="fill green" style={{width: `${correctPerc}%`}}></div></div>
                          </div>

                          <div className="progress-wrapper">
                              <div className="progress-labels">
                                  <span style={{color:'#ef4444'}}>إجابات خاطئة ({wrong})</span>
                                  <span style={{color:'#ef4444'}}>{wrongPerc}%</span>
                              </div>
                              <div className="progress-bar"><div className="fill red" style={{width: `${wrongPerc}%`}}></div></div>
                          </div>
                      </div>
                  );
              })}
              {(!stats.questionStats || stats.questionStats.length === 0) && (
                  <div style={{color:'#64748b', textAlign:'center', gridColumn:'1/-1', padding:'30px'}}>لا توجد إحصائيات للأسئلة حالياً.</div>
              )}
          </div>
      )}

      {/* Student Attempt Details Modal */}
      {selectedAttempt && (
          <div className="modal-overlay" onClick={() => setSelectedAttempt(null)}>
              <div className="modal-box" onClick={e => e.stopPropagation()}>
                  
                  <div className="modal-header">
                      <h3>📄 ورقة إجابة الطالب</h3>
                      <button className="close-btn" onClick={() => setSelectedAttempt(null)}>✕</button>
                  </div>

                  {loadingAttempt || !attemptDetails ? (
                      <div className="loader-container" style={{height:'200px'}}>
                          <div className="spinner"></div>
                          <p>جاري تحميل الإجابات...</p>
                      </div>
                  ) : (
                      <div className="modal-body">
                          {/* Student Info */}
                          <div className="student-info-card">
                              <div className="s-name">{attemptDetails.student.name}</div>
                              <div className="s-score">الدرجة: <span style={{color:'#facc15'}}>{attemptDetails.exam.score} / {attemptDetails.exam.total_questions}</span> ({attemptDetails.exam.percentage}%)</div>
                          </div>

                          {/* Questions List */}
                          <div className="questions-list">
                              {attemptDetails.questions_details.map((q, i) => (
                                  <div key={q.id} className="q-detail-card">
                                      
                                      <div className="q-head">
                                          <div className="q-title">
                                              <span className="q-num">{i + 1}</span>
                                              <p>{q.text}</p>
                                          </div>
                                          <div className="q-status">
                                              {q.is_student_correct ? <span className="badge green">✅ صحيح</span> : <span className="badge red">❌ خطأ</span>}
                                          </div>
                                      </div>

                                      {/* ✅ تصحيح مسار جلب الصور ليعمل بنجاح */}
                                      {q.image && (
                                          <div className="q-image">
                                              <img src={`/api/admin/file-proxy?type=exam_images&filename=${q.image}`} alt="Question Image" />
                                          </div>
                                      )}

                                      <div className="options-list">
                                          {q.options.map(opt => {
                                              let optClass = "opt-row ";
                                              let badge = null;

                                              if (opt.id === q.correct_option_id) {
                                                  optClass += "correct ";
                                                  badge = <span className="opt-badge green">الإجابة الصحيحة</span>;
                                              }
                                              
                                              if (opt.id === q.student_selected_option_id && !q.is_student_correct) {
                                                  optClass += "wrong ";
                                                  badge = <span className="opt-badge red">اختيار الطالب</span>;
                                              }

                                              if (opt.id === q.student_selected_option_id && q.is_student_correct) {
                                                  badge = <span className="opt-badge green">اختيار الطالب (صحيح)</span>;
                                              }

                                              return (
                                                  <div key={opt.id} className={optClass}>
                                                      <div className="opt-text">{opt.text}</div>
                                                      {badge}
                                                  </div>
                                              );
                                          })}
                                          {!q.student_selected_option_id && (
                                              <div style={{color:'#ef4444', fontSize:'0.85em', marginTop:'10px', padding:'5px', background:'rgba(239,68,68,0.1)', borderRadius:'6px', textAlign:'center'}}>
                                                  ⚠️ لم يقم الطالب باختيار أي إجابة لهذا السؤال.
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}
              </div>
          </div>
      )}

      <style jsx>{`
        /* Header & Common */
        .header-bar { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; border-bottom: 1px solid #334155; padding-bottom: 15px; }
        .title-area { display: flex; align-items: flex-start; gap: 15px; }
        .back-btn { background: #334155; color: #cbd5e1; border: none; padding: 8px 15px; border-radius: 8px; cursor: pointer; font-weight: bold; margin-top: 5px; transition: 0.2s; }
        .back-btn:hover { background: #475569; color: white; }
        .header-bar h1 { margin: 0 0 5px 0; color: #38bdf8; font-size: 1.6rem; }
        .header-bar p { margin: 0; color: #94a3b8; font-size: 0.95rem; }

        /* Summary Cards */
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155; display: flex; align-items: center; gap: 15px; }
        .stat-card .icon { width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; }
        .stat-card .icon.blue { background: rgba(56, 189, 248, 0.1); }
        .stat-card .icon.yellow { background: rgba(250, 204, 21, 0.1); }
        .stat-card .icon.green { background: rgba(34, 197, 94, 0.1); }
        .stat-card .info { display: flex; flex-direction: column; gap: 5px; }
        .stat-card .info span { color: #94a3b8; font-size: 0.9rem; }
        .stat-card .info strong { color: white; font-size: 1.5rem; }

        /* Tabs */
        .tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid #334155; padding-bottom: 10px; }
        .tab { background: transparent; color: #94a3b8; border: none; padding: 10px 20px; font-size: 1rem; font-weight: bold; cursor: pointer; border-radius: 8px; transition: 0.2s; }
        .tab:hover { background: rgba(255,255,255,0.05); color: white; }
        .tab.active { background: #38bdf8; color: #0f172a; }

        /* Table */
        .panel { background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; }
        .table-responsive { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: right; padding: 15px; color: #94a3b8; background: #0f172a; border-bottom: 1px solid #334155; font-size: 0.9rem; white-space: nowrap; }
        td { padding: 15px; color: #cbd5e1; border-bottom: 1px solid #334155; font-size: 0.95rem; }
        tr:hover td { background: rgba(255,255,255,0.02); }
        .view-btn { background: transparent; border: 1px solid #38bdf8; color: #38bdf8; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: bold; transition: 0.2s; }
        .view-btn:hover { background: #38bdf8; color: #0f172a; }

        /* Analysis Grid */
        .analysis-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 20px; }
        .q-stat-card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; }
        .q-text { margin: 0 0 10px 0; color: white; font-size: 1.05rem; line-height: 1.5; }
        .q-text span { color: #38bdf8; margin-left: 5px; }
        .q-meta { color: #94a3b8; font-size: 0.85rem; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px dashed #334155; }
        .progress-wrapper { margin-bottom: 12px; }
        .progress-wrapper:last-child { margin-bottom: 0; }
        .progress-labels { display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 5px; font-weight: bold; }
        .progress-bar { width: 100%; height: 8px; background: #0f172a; border-radius: 10px; overflow: hidden; }
        .fill { height: 100%; border-radius: 10px; transition: width 0.5s ease; }
        .fill.green { background: #4ade80; }
        .fill.red { background: #ef4444; }

        /* Modal Styles */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 1000; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(4px); }
        .modal-box { background: #0f172a; width: 95%; max-width: 800px; height: 90vh; border-radius: 16px; border: 1px solid #334155; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px rgba(0,0,0,0.5); animation: popIn 0.3s; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px; background: #1e293b; border-bottom: 1px solid #334155; }
        .modal-header h3 { margin: 0; color: white; }
        .close-btn { background: none; border: none; color: #94a3b8; font-size: 1.5rem; cursor: pointer; }
        .modal-body { padding: 20px; overflow-y: auto; flex: 1; }

        /* Attempt Details Inside Modal */
        .student-info-card { background: linear-gradient(135deg, #1e293b, #0f172a); border: 1px solid #334155; padding: 20px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
        .s-name { font-size: 1.3rem; font-weight: bold; color: white; }
        .s-score { font-size: 1.1rem; color: #cbd5e1; font-weight: bold; }

        .questions-list { display: flex; flex-direction: column; gap: 20px; }
        .q-detail-card { background: #1e293b; border: 1px solid #334155; padding: 20px; border-radius: 12px; }
        .q-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; gap: 15px; }
        .q-title { display: flex; gap: 10px; align-items: flex-start; }
        .q-num { background: #334155; color: white; width: 25px; height: 25px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; flex-shrink: 0; font-weight: bold; }
        .q-title p { margin: 0; color: white; font-size: 1.05rem; line-height: 1.5; }
        .badge { padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: bold; white-space: nowrap; }
        .badge.green { background: rgba(74, 222, 128, 0.1); color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.3); }
        .badge.red { background: rgba(239, 68, 68, 0.1); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.3); }

        .q-image img { max-height: 200px; max-width: 100%; border-radius: 8px; border: 1px solid #334155; margin-bottom: 15px; }

        .options-list { display: flex; flex-direction: column; gap: 8px; }
        .opt-row { display: flex; justify-content: space-between; align-items: center; background: #0f172a; padding: 10px 15px; border-radius: 8px; border: 1px solid #334155; color: #cbd5e1; }
        .opt-row.correct { background: rgba(34, 197, 94, 0.05); border-color: #22c55e; color: white; }
        .opt-row.wrong { background: rgba(239, 68, 68, 0.05); border-color: #ef4444; color: white; }
        
        .opt-badge { font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; font-weight: bold; }
        .opt-badge.green { background: #22c55e; color: #0f172a; }
        .opt-badge.red { background: #ef4444; color: white; }

        @keyframes popIn { from { transform: scale(0.95) translateY(10px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }

        @media (max-width: 768px) {
            .header-bar .title-area { flex-direction: column; gap: 10px; align-items: flex-start; }
            .analysis-grid { grid-template-columns: 1fr; }
            .student-info-card { flex-direction: column; align-items: flex-start; gap: 10px; }
            .q-head { flex-direction: column; }
            .opt-row { flex-direction: column; align-items: flex-start; gap: 10px; }
        }
      `}</style>
    </TeacherLayout>
  );
}
