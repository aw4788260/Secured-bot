import { useState, useEffect } from 'react';
import Head from 'next/head';
import SuperLayout from '../../../components/SuperLayout';

// ─── SVG Icons ──────────────────────────────────────────
const ClipboardIcon = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1z"></path><rect x="4" y="4" width="16" height="18" rx="2"></rect><line x1="8" y1="11" x2="16" y2="11"></line><line x1="8" y1="15" x2="16" y2="15"></line></svg>);
const PlusIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>);
const TrashIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path></svg>);
const EditIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>);
const EyeIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>);
const StarIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>);
const CloseIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>);

const QUESTION_TYPES = [
  { value: 'mcq_single', label: 'اختيار واحد (Radio)' },
  { value: 'mcq_multiple', label: 'اختيار متعدد (Checkboxes)' },
  { value: 'written', label: 'إجابة كتابية' },
  { value: 'rating', label: 'تقييم بالنجوم' },
];

const emptyQuestion = () => ({ question_text: '', question_type: 'mcq_single', options: ['', ''], max_rating: 5, is_required: true });

export default function SurveysPage() {
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  const [showBuilder, setShowBuilder] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [lockQuestions, setLockQuestions] = useState(false); // true لو فيه ردود بالفعل
  const [form, setForm] = useState({ title: '', description: '', is_obligatory: false, expires_at: '', questions: [emptyQuestion()] });

  const [viewingSurvey, setViewingSurvey] = useState(null);
  const [viewData, setViewData] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ show: true, message: msg, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3500);
  };

  const fetchSurveys = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/super/surveys');
      const data = await res.json();
      if (res.ok) setSurveys(data.surveys || []);
    } catch (e) {
      showToast('فشل تحميل الاستبيانات', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSurveys(); }, []);

  const resetForm = () => {
    setForm({ title: '', description: '', is_obligatory: false, expires_at: '', questions: [emptyQuestion()] });
    setEditingId(null);
    setLockQuestions(false);
  };

  const openCreate = () => { resetForm(); setShowBuilder(true); };

  const openEdit = async (surveyId) => {
    try {
      const res = await fetch(`/api/dashboard/super/surveys?id=${surveyId}`);
      const data = await res.json();
      if (!res.ok) return showToast(data.message || 'فشل التحميل', 'error');
      setForm({
        title: data.survey.title || '',
        description: data.survey.description || '',
        is_obligatory: !!data.survey.is_obligatory,
        expires_at: data.survey.expires_at ? data.survey.expires_at.slice(0, 16) : '',
        questions: (data.questions || []).map(q => ({
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options && q.options.length ? q.options : ['', ''],
          max_rating: q.max_rating || 5,
          is_required: q.is_required !== false,
        })),
      });
      setEditingId(surveyId);
      setLockQuestions((data.responseCount || 0) > 0);
      setShowBuilder(true);
    } catch (e) {
      showToast('خطأ في الاتصال', 'error');
    }
  };

  const handleDelete = async (surveyId) => {
    if (!confirm('هل أنت متأكد من حذف هذا الاستبيان؟ سيتم حذف كل الردود المرتبطة به.')) return;
    try {
      const res = await fetch(`/api/dashboard/super/surveys?id=${surveyId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) { showToast('تم الحذف بنجاح'); fetchSurveys(); }
      else showToast(data.message || 'فشل الحذف', 'error');
    } catch (e) { showToast('خطأ في الاتصال', 'error'); }
  };

  const toggleActive = async (survey) => {
    try {
      const res = await fetch('/api/dashboard/super/surveys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: survey.id, is_active: !survey.is_active }),
      });
      const data = await res.json();
      if (res.ok) { fetchSurveys(); }
      else showToast(data.message || 'فشل التحديث', 'error');
    } catch (e) { showToast('خطأ في الاتصال', 'error'); }
  };

  // ── Question builder helpers ──
  const updateQuestion = (idx, patch) => {
    setForm(f => ({ ...f, questions: f.questions.map((q, i) => (i === idx ? { ...q, ...patch } : q)) }));
  };
  const addQuestion = () => setForm(f => ({ ...f, questions: [...f.questions, emptyQuestion()] }));
  const removeQuestion = (idx) => setForm(f => ({ ...f, questions: f.questions.filter((_, i) => i !== idx) }));
  const updateOption = (qIdx, oIdx, value) => {
    setForm(f => ({
      ...f,
      questions: f.questions.map((q, i) => i === qIdx ? { ...q, options: q.options.map((o, j) => j === oIdx ? value : o) } : q),
    }));
  };
  const addOption = (qIdx) => setForm(f => ({ ...f, questions: f.questions.map((q, i) => i === qIdx ? { ...q, options: [...q.options, ''] } : q) }));
  const removeOption = (qIdx, oIdx) => setForm(f => ({ ...f, questions: f.questions.map((q, i) => i === qIdx ? { ...q, options: q.options.filter((_, j) => j !== oIdx) } : q) }));

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return showToast('عنوان الاستبيان مطلوب', 'error');
    if (form.questions.length === 0) return showToast('أضف سؤالاً واحداً على الأقل', 'error');

    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        is_obligatory: form.is_obligatory,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      };
      if (!lockQuestions) payload.questions = form.questions;

      let res;
      if (editingId) {
        res = await fetch('/api/dashboard/super/surveys', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...payload }),
        });
      } else {
        res = await fetch('/api/dashboard/super/surveys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(editingId ? 'تم حفظ التعديلات' : 'تم إنشاء الاستبيان بنجاح');
        setShowBuilder(false);
        resetForm();
        fetchSurveys();
      } else {
        showToast(data.message || 'فشل الحفظ', 'error');
      }
    } catch (e) {
      showToast('خطأ في الاتصال بالخادم', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openResponses = async (survey) => {
    setViewingSurvey(survey);
    setViewLoading(true);
    setViewData(null);
    try {
      const res = await fetch(`/api/dashboard/super/survey-responses?survey_id=${survey.id}`);
      const data = await res.json();
      if (res.ok) setViewData(data);
      else showToast(data.message || 'فشل التحميل', 'error');
    } catch (e) {
      showToast('خطأ في الاتصال', 'error');
    } finally {
      setViewLoading(false);
    }
  };

  return (
    <SuperLayout title="الاستبيانات وآراء الطلاب">
      <Head><title>الاستبيانات | الإدارة العليا</title></Head>

      <div className={`toast ${toast.show ? 'show' : ''} ${toast.type}`}>{toast.message}</div>

      <div className="page-header">
        <div className="header-title-wrap">
          <div className="header-icon"><ClipboardIcon /></div>
          <div>
            <h1>الاستبيانات وآراء الطلاب</h1>
            <p>أنشئ استبيانات (اختيارات / كتابية / تقييم بالنجوم) تظهر للطلاب داخل التطبيق، وتابع نتائجها هنا.</p>
          </div>
        </div>
        <button className="primary-btn" onClick={openCreate}><PlusIcon /> استبيان جديد</button>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>جارِ التحميل...</div>
      ) : surveys.length === 0 ? (
        <div className="card empty-state">لا توجد استبيانات بعد. اضغط "استبيان جديد" للبدء.</div>
      ) : (
        <div className="card">
          <table className="surveys-table">
            <thead>
              <tr>
                <th>العنوان</th>
                <th>الحالة</th>
                <th>إلزامي؟</th>
                <th>الأسئلة</th>
                <th>الردود</th>
                <th>ينتهي في</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {surveys.map(s => (
                <tr key={s.id}>
                  <td className="title-cell">{s.title}</td>
                  <td>
                    <label className="switch">
                      <input type="checkbox" checked={s.is_active} onChange={() => toggleActive(s)} />
                      <span className="slider"></span>
                    </label>
                    <span className={`status-text ${s.is_active ? 'on' : 'off'}`}>{s.is_active ? 'مفعّل' : 'موقوف'}</span>
                  </td>
                  <td>{s.is_obligatory ? <span className="badge obligatory">إلزامي</span> : <span className="badge optional">اختياري</span>}</td>
                  <td>{s.question_count}</td>
                  <td>{s.response_count}</td>
                  <td>{s.expires_at ? new Date(s.expires_at).toLocaleString('ar-EG') : 'بدون انتهاء'}</td>
                  <td className="actions-cell">
                    <button className="icon-btn" title="عرض النتائج" onClick={() => openResponses(s)}><EyeIcon /></button>
                    <button className="icon-btn" title="تعديل" onClick={() => openEdit(s.id)}><EditIcon /></button>
                    <button className="icon-btn danger" title="حذف" onClick={() => handleDelete(s.id)}><TrashIcon /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ══════════════ Builder Modal ══════════════ */}
      {showBuilder && (
        <div className="modal-overlay" onClick={() => setShowBuilder(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? 'تعديل الاستبيان' : 'استبيان جديد'}</h3>
              <button className="icon-btn" onClick={() => setShowBuilder(false)}><CloseIcon /></button>
            </div>

            <form onSubmit={handleSubmitForm} className="modal-body">
              <div className="form-group">
                <label>عنوان الاستبيان</label>
                <input className="input-field" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required maxLength={120} />
              </div>

              <div className="form-group">
                <label>وصف مختصر (اختياري)</label>
                <textarea className="input-field textarea" rows="2" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} maxLength={300} />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>تاريخ انتهاء الصلاحية (اختياري)</label>
                  <input type="datetime-local" className="input-field" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} />
                </div>
                <div className="form-group toggle-group">
                  <label>استبيان إلزامي؟</label>
                  <label className="switch">
                    <input type="checkbox" checked={form.is_obligatory} onChange={e => setForm({ ...form, is_obligatory: e.target.checked })} />
                    <span className="slider"></span>
                  </label>
                  <span className="hint">لو مفعّل، الطالب لن يستطيع تجاوز الاستبيان دون الإجابة عليه.</span>
                </div>
              </div>

              <div className="section-divider"><span>الأسئلة</span></div>

              {lockQuestions && (
                <div className="info-box">
                  <strong>تنبيه</strong>
                  <p>هذا الاستبيان لديه ردود بالفعل من الطلاب، لذلك لا يمكن تعديل الأسئلة حفاظاً على سلامة النتائج. يمكنك تعديل العنوان/الوصف/الحالة فقط.</p>
                </div>
              )}

              {!lockQuestions && form.questions.map((q, qIdx) => (
                <div className="question-card" key={qIdx}>
                  <div className="question-card-header">
                    <span className="q-number">سؤال {qIdx + 1}</span>
                    {form.questions.length > 1 && (
                      <button type="button" className="icon-btn danger small" onClick={() => removeQuestion(qIdx)}><TrashIcon /></button>
                    )}
                  </div>

                  <div className="form-group">
                    <label>نص السؤال</label>
                    <input className="input-field" value={q.question_text} onChange={e => updateQuestion(qIdx, { question_text: e.target.value })} required maxLength={250} />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>نوع السؤال</label>
                      <select className="input-field" value={q.question_type} onChange={e => updateQuestion(qIdx, { question_type: e.target.value, options: ['', ''] })}>
                        {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div className="form-group toggle-group">
                      <label>مطلوب إجباري؟</label>
                      <label className="switch small">
                        <input type="checkbox" checked={q.is_required} onChange={e => updateQuestion(qIdx, { is_required: e.target.checked })} />
                        <span className="slider"></span>
                      </label>
                    </div>
                  </div>

                  {['mcq_single', 'mcq_multiple'].includes(q.question_type) && (
                    <div className="options-list">
                      <label>الخيارات</label>
                      {q.options.map((opt, oIdx) => (
                        <div className="option-row" key={oIdx}>
                          <input className="input-field" placeholder={`خيار ${oIdx + 1}`} value={opt} onChange={e => updateOption(qIdx, oIdx, e.target.value)} required />
                          {q.options.length > 2 && (
                            <button type="button" className="icon-btn danger small" onClick={() => removeOption(qIdx, oIdx)}><CloseIcon /></button>
                          )}
                        </div>
                      ))}
                      <button type="button" className="link-btn" onClick={() => addOption(qIdx)}>+ إضافة خيار</button>
                    </div>
                  )}

                  {q.question_type === 'rating' && (
                    <div className="form-group">
                      <label>عدد النجوم</label>
                      <select className="input-field" value={q.max_rating} onChange={e => updateQuestion(qIdx, { max_rating: parseInt(e.target.value) })}>
                        {[3, 5, 10].map(n => <option key={n} value={n}>{n} نجوم</option>)}
                      </select>
                    </div>
                  )}
                </div>
              ))}

              {!lockQuestions && (
                <button type="button" className="secondary-btn" onClick={addQuestion}><PlusIcon /> إضافة سؤال</button>
              )}

              <button type="submit" className="submit-btn" disabled={saving}>
                {saving ? 'جارِ الحفظ...' : (editingId ? 'حفظ التعديلات' : 'إنشاء الاستبيان')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════ Responses / Results Modal ══════════════ */}
      {viewingSurvey && (
        <div className="modal-overlay" onClick={() => setViewingSurvey(null)}>
          <div className="modal-box wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>نتائج: {viewingSurvey.title}</h3>
              <button className="icon-btn" onClick={() => setViewingSurvey(null)}><CloseIcon /></button>
            </div>
            <div className="modal-body">
              {viewLoading ? (
                <div style={{ textAlign: 'center', padding: 30 }}>جارِ التحميل...</div>
              ) : !viewData ? (
                <div style={{ textAlign: 'center', padding: 30 }}>لا توجد بيانات</div>
              ) : (
                <>
                  <p className="hint">إجمالي عدد الردود: <strong>{viewData.total_responses}</strong></p>

                  {viewData.stats.map(st => (
                    <div className="stat-card" key={st.question_id}>
                      <h4>{st.question_text}</h4>

                      {st.question_type === 'written' && (
                        <div className="written-list">
                          {st.written_feedback.length === 0 ? (
                            <p className="hint">لا توجد إجابات كتابية بعد</p>
                          ) : st.written_feedback.map((txt, i) => (
                            <div className="written-item" key={i}>{txt}</div>
                          ))}
                        </div>
                      )}

                      {st.question_type === 'rating' && (
                        <div className="rating-summary">
                          <div className="avg-rating"><StarIcon /> {st.average_rating} / {st.max_rating} <span className="hint">({st.total_ratings} تقييم)</span></div>
                          {Object.entries(st.distribution).reverse().map(([star, count]) => (
                            <div className="bar-row" key={star}>
                              <span>{star} ⭐</span>
                              <div className="bar-track"><div className="bar-fill" style={{ width: `${st.total_ratings ? (count / st.total_ratings) * 100 : 0}%` }}></div></div>
                              <span>{count}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {['mcq_single', 'mcq_multiple'].includes(st.question_type) && (
                        <div className="options-summary">
                          {st.options.map(opt => {
                            const count = st.option_counts[opt] || 0;
                            const pct = st.total_respondents ? Math.round((count / st.total_respondents) * 100) : 0;
                            return (
                              <div className="bar-row" key={opt}>
                                <span>{opt}</span>
                                <div className="bar-track"><div className="bar-fill" style={{ width: `${pct}%` }}></div></div>
                                <span>{count} ({pct}%)</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="section-divider"><span>الردود الفردية</span></div>
                  {viewData.responses.length === 0 ? (
                    <p className="hint">لا يوجد طلاب أجابوا بعد</p>
                  ) : viewData.responses.map(r => (
                    <div className="response-card" key={r.response_id}>
                      <div className="response-header">
                        <strong>{r.student_name}</strong>
                        <span className="hint">{new Date(r.submitted_at).toLocaleString('ar-EG')}</span>
                      </div>
                      {r.answers.map((a, i) => {
                        const q = viewData.questions.find(q => q.id === a.question_id);
                        return (
                          <div className="answer-line" key={i}>
                            <span className="q-label">{q?.question_text}:</span>{' '}
                            {a.answer_text || (a.selected_options || []).join('، ') || (a.rating_value ? `${a.rating_value} ⭐` : '-')}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .page-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 24px; }
        .header-title-wrap { display: flex; align-items: center; gap: 16px; }
        .header-icon { width: 52px; height: 52px; border-radius: 14px; background: var(--gold-dimmer); color: var(--gold); display: flex; align-items: center; justify-content: center; }
        .page-header h1 { margin: 0; font-size: 1.4rem; color: var(--text-primary); }
        .page-header p { margin: 4px 0 0; color: var(--text-secondary); font-size: 0.9rem; }

        .primary-btn { display: flex; align-items: center; gap: 8px; background: var(--gold); color: #111009; border: none; padding: 12px 20px; border-radius: 10px; font-weight: 700; cursor: pointer; transition: 0.2s; }
        .primary-btn:hover { background: var(--gold-light); transform: translateY(-1px); }
        .secondary-btn { display: flex; align-items: center; gap: 6px; background: var(--gold-dimmer); color: var(--gold); border: 1px solid var(--border-accent); padding: 10px 16px; border-radius: 10px; font-weight: 600; cursor: pointer; margin-top: 10px; }

        .card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 16px; padding: 20px; }
        .empty-state { text-align: center; color: var(--text-muted); padding: 40px; }

        .surveys-table { width: 100%; border-collapse: collapse; }
        .surveys-table th, .surveys-table td { padding: 12px 10px; text-align: right; border-bottom: 1px solid var(--border); font-size: 0.88rem; color: var(--text-primary); }
        .surveys-table th { color: var(--text-secondary); font-weight: 600; }
        .title-cell { font-weight: 700; }
        .status-text { margin-right: 8px; font-size: 0.8rem; }
        .status-text.on { color: #4ade80; }
        .status-text.off { color: var(--text-muted); }

        .badge { padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; }
        .badge.obligatory { background: rgba(248,113,113,0.15); color: #f87171; }
        .badge.optional { background: var(--gold-dimmer); color: var(--gold); }

        .actions-cell { display: flex; gap: 6px; }
        .icon-btn { background: var(--bg-elevated); border: 1px solid var(--border); color: var(--text-secondary); width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .icon-btn.danger { color: #f87171; }
        .icon-btn.small { width: 26px; height: 26px; }
        .icon-btn:hover { border-color: var(--gold); color: var(--gold); }
        .icon-btn.danger:hover { border-color: #f87171; color: #f87171; }

        .switch { position: relative; display: inline-block; width: 42px; height: 22px; vertical-align: middle; }
        .switch.small { width: 34px; height: 18px; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; inset: 0; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 22px; transition: 0.2s; }
        .slider:before { content: ''; position: absolute; height: 16px; width: 16px; left: 3px; bottom: 2px; background: white; border-radius: 50%; transition: 0.2s; }
        .switch.small .slider:before { height: 12px; width: 12px; }
        input:checked + .slider { background: var(--gold); }
        input:checked + .slider:before { transform: translateX(-20px); }
        .switch.small input:checked + .slider:before { transform: translateX(-16px); }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
        .modal-box { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 16px; width: 100%; max-width: 560px; max-height: 90vh; display: flex; flex-direction: column; }
        .modal-box.wide { max-width: 720px; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 18px 20px; border-bottom: 1px solid var(--border); }
        .modal-header h3 { margin: 0; color: var(--text-primary); font-size: 1.1rem; }
        .modal-body { padding: 20px; overflow-y: auto; }

        .form-group { margin-bottom: 16px; }
        .form-group label { display: block; margin-bottom: 6px; color: var(--text-secondary); font-size: 0.85rem; font-weight: 600; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .toggle-group { display: flex; flex-direction: column; gap: 6px; }
        .input-field { width: 100%; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; color: var(--text-primary); font-size: 0.9rem; }
        .input-field:focus { outline: none; border-color: var(--gold); }
        .textarea { resize: vertical; }
        .hint { color: var(--text-muted); font-size: 0.8rem; }

        .section-divider { display: flex; align-items: center; gap: 10px; margin: 22px 0 14px; color: var(--gold); font-weight: 700; font-size: 0.9rem; }
        .section-divider::before, .section-divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }

        .question-card { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 12px; padding: 14px; margin-bottom: 14px; }
        .question-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .q-number { font-weight: 700; color: var(--gold); font-size: 0.85rem; }

        .options-list label { display: block; margin-bottom: 6px; color: var(--text-secondary); font-size: 0.85rem; font-weight: 600; }
        .option-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
        .link-btn { background: none; border: none; color: var(--gold); cursor: pointer; font-size: 0.85rem; padding: 4px 0; }

        .submit-btn { width: 100%; background: var(--gold); color: #111009; border: none; padding: 14px; border-radius: 10px; font-weight: 800; font-size: 1rem; cursor: pointer; margin-top: 12px; }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .info-box { background: var(--gold-dimmer); border: 1px solid var(--border-accent); padding: 14px; border-radius: 10px; margin-bottom: 16px; }
        .info-box strong { color: var(--gold); display: block; margin-bottom: 4px; }
        .info-box p { margin: 0; color: var(--text-secondary); font-size: 0.85rem; }

        .stat-card { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 12px; padding: 14px; margin-bottom: 14px; }
        .stat-card h4 { margin: 0 0 10px; color: var(--text-primary); font-size: 0.95rem; }
        .avg-rating { display: flex; align-items: center; gap: 6px; color: var(--gold); font-weight: 700; margin-bottom: 10px; }
        .bar-row { display: grid; grid-template-columns: 90px 1fr 60px; align-items: center; gap: 10px; margin-bottom: 6px; font-size: 0.82rem; color: var(--text-secondary); }
        .bar-track { height: 8px; background: var(--bg-hover); border-radius: 6px; overflow: hidden; }
        .bar-fill { height: 100%; background: var(--gold); }
        .written-item { background: var(--bg-hover); padding: 10px; border-radius: 8px; margin-bottom: 8px; font-size: 0.85rem; color: var(--text-primary); }

        .response-card { border: 1px solid var(--border); border-radius: 10px; padding: 12px; margin-bottom: 10px; }
        .response-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .answer-line { font-size: 0.83rem; color: var(--text-secondary); margin-bottom: 4px; }
        .q-label { color: var(--text-primary); font-weight: 600; }

        .toast { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%) translateY(100px); background: var(--bg-surface); color: var(--text-primary); padding: 14px 28px; border-radius: 50px; font-weight: 700; box-shadow: 0 10px 40px rgba(0,0,0,0.6); z-index: 2000; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); opacity: 0; border: 1px solid var(--border); }
        .toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }
        .toast.success { border-bottom: 3px solid #4ade80; }
        .toast.error { border-bottom: 3px solid #f87171; }
      `}</style>
    </SuperLayout>
  );
}
