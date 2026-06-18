import Head from 'next/head';
import { useState, useEffect, useCallback } from 'react';
import SuperLayout from '../../../components/SuperLayout';

// ─── SVG Icons ───────────────────────────────────────────────────────────────
const Icons = {
  add: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  search: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  edit: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  trash: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  close: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  eye: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  key: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  ),
  warn: (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  check: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  user: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  teachers: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
};

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <>
      <div className={`toast toast-${type}`}>
        <span className="toast-icon">{type === 'success' ? Icons.check : Icons.warn}</span>
        <span>{message}</span>
      </div>
      <style jsx>{`
        .toast {
          position: fixed; top: 80px; left: 20px; z-index: 3000;
          padding: 13px 20px; border-radius: 12px;
          display: flex; align-items: center; gap: 12px;
          min-width: 280px; max-width: 90vw;
          font-weight: 600; font-size: 0.9rem;
          box-shadow: 0 12px 40px rgba(0,0,0,0.4);
          animation: toastIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
          border: 1px solid var(--border-accent);
          background: var(--bg-surface);
          color: var(--text-primary);
        }
        .toast-success { border-right: 4px solid #4ade80; }
        .toast-error   { border-right: 4px solid #f87171; }
        .toast-icon { display: flex; align-items: center; }
        .toast-success .toast-icon { color: #4ade80; }
        .toast-error .toast-icon   { color: #f87171; }
        @keyframes toastIn {
          from { transform: translateX(-60px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SuperTeachers() {
  const [teachers, setTeachers]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [searchQuery, setSearchQuery]   = useState('');
  const [isDark, setIsDark]             = useState(true);

  // Modals
  const [formModalOpen, setFormModalOpen]     = useState(false);
  const [statsModalOpen, setStatsModalOpen]   = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen]   = useState(false);

  const [selectedStats, setSelectedStats]     = useState(null);
  const [loadingStats, setLoadingStats]       = useState(false);
  const [editingId, setEditingId]             = useState(null);
  const [teacherToDelete, setTeacherToDelete] = useState(null);
  const [teacherToLogin, setTeacherToLogin]   = useState(null);

  const [toast, setToast]       = useState(null);
  const [formError, setFormError] = useState('');

  const showToast = useCallback((message, type = 'success') => setToast({ message, type }), []);

  const emptyForm = {
    name: '', phone: '', specialty: '', bio: '', whatsapp_number: '',
    cash_numbers: '', instapay_numbers: '', instapay_links: '',
    dashboard_username: '', dashboard_password: '',
    app_username: '', app_password: '',
  };
  const [formData, setFormData] = useState(emptyForm);

  // Sync theme from localStorage
  useEffect(() => {
    const sync = () => setIsDark(localStorage.getItem('medaad_theme') !== 'light');
    sync();
    const id = setInterval(sync, 300);
    return () => clearInterval(id);
  }, []);

  // Fetch teachers
  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/super/teachers');
      if (res.ok) setTeachers(await res.json());
      else showToast('فشل جلب البيانات', 'error');
    } catch { showToast('خطأ في الاتصال بالسيرفر', 'error'); }
    finally   { setLoading(false); }
  }, [showToast]);

  useEffect(() => { fetchTeachers(); }, [fetchTeachers]);

  // Stats modal
  const handleViewStats = async (teacher) => {
    setStatsModalOpen(true);
    setLoadingStats(true);
    setSelectedStats({ ...teacher });
    try {
      const res = await fetch(`/api/dashboard/super/teacher-stats?id=${teacher.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedStats(prev => ({ ...prev, ...data }));
      }
    } catch { /* silent */ }
    finally { setLoadingStats(false); }
  };

  // Form open/close
  const handleOpenForm = (teacher = null) => {
    setFormError('');
    if (teacher) {
      setEditingId(teacher.id);
      const pd = teacher.payment_details || {};
      setFormData({
        name: teacher.name,
        phone: teacher.phone,
        specialty: teacher.specialty,
        bio: teacher.bio || '',
        whatsapp_number: teacher.whatsapp_number || '',
        cash_numbers:     Array.isArray(pd.cash_numbers)     ? pd.cash_numbers.join(', ')     : '',
        instapay_numbers: Array.isArray(pd.instapay_numbers) ? pd.instapay_numbers.join(', ') : '',
        instapay_links:   Array.isArray(pd.instapay_links)   ? pd.instapay_links.join(', ')   : '',
        dashboard_username: teacher.dashboard_username || '',
        dashboard_password: '',
        app_username: teacher.app_username || '',
        app_password: '',
      });
    } else {
      setEditingId(null);
      setFormData(emptyForm);
    }
    setFormModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      const payment_details = {
        cash_numbers:     formData.cash_numbers.split(',').map(s => s.trim()).filter(Boolean),
        instapay_numbers: formData.instapay_numbers.split(',').map(s => s.trim()).filter(Boolean),
        instapay_links:   formData.instapay_links.split(',').map(s => s.trim()).filter(Boolean),
      };
      const res = await fetch('/api/dashboard/super/teachers', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, payment_details, id: editingId }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchTeachers();
        setFormModalOpen(false);
        showToast(editingId ? 'تم تعديل البيانات بنجاح ✓' : 'تم إضافة المدرس بنجاح ✓');
      } else {
        setFormError(data.error || 'حدث خطأ غير معروف');
      }
    } catch { setFormError('خطأ في الاتصال بالشبكة'); }
  };

  // Delete
  const executeDelete = async () => {
    if (!teacherToDelete) return;
    try {
      const res = await fetch(`/api/dashboard/super/teachers?id=${teacherToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        setTeachers(prev => prev.filter(t => t.id !== teacherToDelete.id));
        setDeleteModalOpen(false);
        setTeacherToDelete(null);
        showToast('تم حذف المدرس نهائياً');
      } else showToast('فشل الحذف، حاول مرة أخرى', 'error');
    } catch { showToast('خطأ في الاتصال', 'error'); }
  };

  // Login as teacher
  const executeLogin = async () => {
    if (!teacherToLogin) return;
    try {
      const res = await fetch('/api/auth/super-login-as', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: teacherToLogin.dashboard_username }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.removeItem('admin_user_id');
        localStorage.removeItem('admin_name');
        localStorage.removeItem('is_admin_session');
        localStorage.setItem('admin_user_id', data.user.id);
        localStorage.setItem('admin_name', data.user.name);
        localStorage.setItem('is_admin_session', 'true');
        showToast(`تم الدخول لحساب ${teacherToLogin.name} بنجاح`);
        setLoginModalOpen(false);
        setTimeout(() => { window.location.href = '/admin/teacher'; }, 600);
      } else {
        const err = await res.json();
        showToast(err.error || 'فشل الدخول، تأكد من البيانات', 'error');
      }
    } catch { showToast('خطأ في الاتصال بالسيرفر', 'error'); }
  };

  const filtered = teachers.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.dashboard_username?.includes(searchQuery) ||
    t.specialty?.includes(searchQuery)
  );

  // Avatar color from name
  const avatarChar = (name) => name?.[0] || '?';

  return (
    <SuperLayout>
      <Head><title>إدارة المدرسين | Super Admin</title></Head>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-root">

        {/* ── PAGE HEADER ── */}
        <div className="page-header">
          <div className="header-info">
            <div className="header-icon-wrap">
              {Icons.teachers}
            </div>
            <div>
              <h1 className="page-title">إدارة المدرسين</h1>
              <p className="page-sub">إدارة الحسابات والبيانات المالية والمشرفين</p>
            </div>
          </div>
          <button className="btn-add" onClick={() => handleOpenForm()}>
            {Icons.add}
            <span>مدرس جديد</span>
          </button>
        </div>

        {/* ── SEARCH BAR ── */}
        <div className="search-wrap">
          <span className="search-icon">{Icons.search}</span>
          <input
            className="search-input"
            type="text"
            placeholder="بحث بالاسم، التخصص، أو اسم المستخدم..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery('')}>×</button>
          )}
        </div>

        {/* ── TEACHERS COUNT ── */}
        {!loading && (
          <div className="results-info">
            {filtered.length} مدرس {searchQuery ? 'في نتائج البحث' : 'مسجل في المنصة'}
          </div>
        )}

        {/* ── TABLE / CARDS ── */}
        {loading ? (
          <div className="loading-wrap">
            <div className="spinner" />
            <span>جاري تحميل البيانات...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">{Icons.teachers}</div>
            <p>{searchQuery ? 'لا توجد نتائج لهذا البحث' : 'لا يوجد مدرسين مسجلين بعد'}</p>
          </div>
        ) : (
          <>
            {/* ── DESKTOP TABLE ── */}
            <div className="table-card">
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>المدرس</th>
                      <th>بيانات الدخول</th>
                      <th>التخصص</th>
                      <th>الهاتف</th>
                      <th className="center-col">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(t => (
                      <tr key={t.id}>
                        <td>
                          <div className="user-cell">
                            <div className="avatar">{avatarChar(t.name)}</div>
                            <span className="teacher-name">{t.name}</span>
                          </div>
                        </td>
                        <td>
                          <div className="creds">
                            <div className="cred-row">
                              <span className="cred-lbl">Dashboard</span>
                              <span className="cred-val gold">@{t.dashboard_username}</span>
                            </div>
                            <div className="cred-row">
                              <span className="cred-lbl">App</span>
                              <span className="cred-val">@{t.app_username}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="specialty-badge">{t.specialty}</span>
                        </td>
                        <td dir="ltr" className="phone-cell">{t.phone}</td>
                        <td>
                          <div className="actions">
                            <button className="act-btn view"   onClick={() => handleViewStats(t)} title="التفاصيل والإحصائيات">{Icons.eye}</button>
                            <button className="act-btn edit"   onClick={() => handleOpenForm(t)}  title="تعديل">{Icons.edit}</button>
                            <button className="act-btn login"  onClick={() => { setTeacherToLogin(t); setLoginModalOpen(true); }} title="دخول للوحة" disabled={!t.dashboard_username}>{Icons.key}</button>
                            <button className="act-btn delete" onClick={() => { setTeacherToDelete(t); setDeleteModalOpen(true); }} title="حذف">{Icons.trash}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── MOBILE CARDS ── */}
            <div className="mobile-cards">
              {filtered.map(t => (
                <div key={t.id} className="mobile-card">
                  <div className="mc-top">
                    <div className="user-cell">
                      <div className="avatar">{avatarChar(t.name)}</div>
                      <div>
                        <div className="teacher-name">{t.name}</div>
                        <span className="specialty-badge">{t.specialty}</span>
                      </div>
                    </div>
                    <div className="actions">
                      <button className="act-btn view"   onClick={() => handleViewStats(t)}>{Icons.eye}</button>
                      <button className="act-btn edit"   onClick={() => handleOpenForm(t)}>{Icons.edit}</button>
                      <button className="act-btn login"  onClick={() => { setTeacherToLogin(t); setLoginModalOpen(true); }} disabled={!t.dashboard_username}>{Icons.key}</button>
                      <button className="act-btn delete" onClick={() => { setTeacherToDelete(t); setDeleteModalOpen(true); }}>{Icons.trash}</button>
                    </div>
                  </div>
                  <div className="mc-body">
                    <div className="creds">
                      <div className="cred-row">
                        <span className="cred-lbl">Dashboard</span>
                        <span className="cred-val gold">@{t.dashboard_username}</span>
                      </div>
                      <div className="cred-row">
                        <span className="cred-lbl">App</span>
                        <span className="cred-val">@{t.app_username}</span>
                      </div>
                      <div className="cred-row">
                        <span className="cred-lbl">الهاتف</span>
                        <span className="cred-val" dir="ltr">{t.phone}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ══════════ FORM MODAL ══════════ */}
      {formModalOpen && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setFormModalOpen(false)}>
          <div className="modal form-modal">
            <div className="modal-head">
              <h3>{editingId ? '✏️ تعديل بيانات مدرس' : '➕ إضافة مدرس جديد'}</h3>
              <button className="modal-close-btn" onClick={() => setFormModalOpen(false)}>{Icons.close}</button>
            </div>

            {formError && <div className="error-banner">⚠️ {formError}</div>}

            <form onSubmit={handleSave} className="form-body">

              {/* ─ Section 1 ─ */}
              <div className="form-section">
                <div className="section-label">
                  <span className="section-num">1</span>
                  البيانات الأساسية والاتصال
                </div>
                <div className="fg">
                  <label>الاسم بالكامل</label>
                  <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="مثال: أ. محمد أحمد" />
                </div>
                <div className="form-row">
                  <div className="fg">
                    <label>التخصص</label>
                    <input type="text" required value={formData.specialty} onChange={e => setFormData({ ...formData, specialty: e.target.value })} placeholder="مثال: رياضيات" />
                  </div>
                  <div className="fg">
                    <label>رقم الهاتف</label>
                    <input type="text" required dir="ltr" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="01xxxxxxxxx" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="fg">
                    <label>رقم واتساب <span className="opt">(اختياري)</span></label>
                    <input type="text" dir="ltr" value={formData.whatsapp_number} onChange={e => setFormData({ ...formData, whatsapp_number: e.target.value })} placeholder="01xxxxxxxxx" />
                  </div>
                  <div className="fg">
                    <label>نبذة مختصرة <span className="opt">(Bio)</span></label>
                    <input type="text" value={formData.bio} onChange={e => setFormData({ ...formData, bio: e.target.value })} placeholder="مدرس أول في..." />
                  </div>
                </div>
              </div>

              {/* ─ Section 2 ─ */}
              <div className="form-section">
                <div className="section-label">
                  <span className="section-num">2</span>
                  بيانات الدفع
                </div>
                <div className="fg">
                  <label>أرقام فودافون كاش <span className="opt">(افصل بفاصلة)</span></label>
                  <input type="text" dir="ltr" value={formData.cash_numbers} onChange={e => setFormData({ ...formData, cash_numbers: e.target.value })} placeholder="010xxxx, 012xxxx" />
                </div>
                <div className="form-row">
                  <div className="fg">
                    <label>أرقام إنستا باي</label>
                    <input type="text" dir="ltr" value={formData.instapay_numbers} onChange={e => setFormData({ ...formData, instapay_numbers: e.target.value })} placeholder="01xxxx, 012xxx" />
                  </div>
                  <div className="fg">
                    <label>روابط إنستا باي</label>
                    <input type="text" dir="ltr" value={formData.instapay_links} onChange={e => setFormData({ ...formData, instapay_links: e.target.value })} placeholder="name@instapay" />
                  </div>
                </div>
              </div>

              {/* ─ Section 3 ─ */}
              <div className="form-section">
                <div className="section-label">
                  <span className="section-num">3</span>
                  دخول لوحة التحكم
                </div>
                <div className="form-row">
                  <div className="fg">
                    <label>اسم المستخدم (Dashboard)</label>
                    <input type="text" required dir="ltr" className="dash-input" value={formData.dashboard_username} onChange={e => setFormData({ ...formData, dashboard_username: e.target.value })} />
                  </div>
                  <div className="fg">
                    <label>كلمة المرور {editingId && <span className="opt">(اختياري)</span>}</label>
                    <input type="password" dir="ltr" className="dash-input" value={formData.dashboard_password} onChange={e => setFormData({ ...formData, dashboard_password: e.target.value })} placeholder={editingId ? 'اتركها فارغة لعدم التغيير' : '••••••'} />
                  </div>
                </div>
              </div>

              {/* ─ Section 4 ─ */}
              <div className="form-section">
                <div className="section-label">
                  <span className="section-num">4</span>
                  دخول التطبيق
                </div>
                <div className="form-row">
                  <div className="fg">
                    <label>اسم المستخدم (App)</label>
                    <input type="text" required dir="ltr" value={formData.app_username} onChange={e => setFormData({ ...formData, app_username: e.target.value })} />
                  </div>
                  <div className="fg">
                    <label>كلمة المرور {editingId && <span className="opt">(اختياري)</span>}</label>
                    <input type="password" dir="ltr" value={formData.app_password} onChange={e => setFormData({ ...formData, app_password: e.target.value })} placeholder={editingId ? 'اتركها فارغة لعدم التغيير' : '••••••'} />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel-modal" onClick={() => setFormModalOpen(false)}>إلغاء</button>
                <button type="submit" className="btn-save">حفظ البيانات</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════ DELETE MODAL ══════════ */}
      {deleteModalOpen && teacherToDelete && (
        <div className="overlay">
          <div className="modal confirm-modal">
            <div className="confirm-icon danger">{Icons.warn}</div>
            <h3>تأكيد الحذف</h3>
            <p>هل أنت متأكد من حذف المدرس <strong className="gold-text">{teacherToDelete.name}</strong>؟</p>
            <p className="warn-note">⚠️ سيتم حذف كافة البيانات المرتبطة به (الكورسات، الطلاب، الأرصدة) نهائياً.</p>
            <div className="modal-footer centered">
              <button className="btn-cancel-modal" onClick={() => { setDeleteModalOpen(false); setTeacherToDelete(null); }}>تراجع</button>
              <button className="btn-danger" onClick={executeDelete}>نعم، احذف نهائياً</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ LOGIN MODAL ══════════ */}
      {loginModalOpen && teacherToLogin && (
        <div className="overlay">
          <div className="modal confirm-modal">
            <div className="confirm-icon purple">{Icons.key}</div>
            <h3>تأكيد الدخول</h3>
            <p>هل تريد الدخول إلى لوحة تحكم المدرس <strong className="gold-text">{teacherToLogin.name}</strong>؟</p>
            <p className="info-note">سيتم تحميل لوحة التحكم الخاصة به بصلاحيات كاملة.</p>
            <div className="modal-footer centered">
              <button className="btn-cancel-modal" onClick={() => { setLoginModalOpen(false); setTeacherToLogin(null); }}>إلغاء</button>
              <button className="btn-purple" onClick={executeLogin}>نعم، دخول</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ STATS MODAL ══════════ */}
      {statsModalOpen && selectedStats && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setStatsModalOpen(false)}>
          <div className="modal stats-modal">
            <div className="modal-head">
              <h3>📊 {selectedStats.name}</h3>
              <button className="modal-close-btn" onClick={() => setStatsModalOpen(false)}>{Icons.close}</button>
            </div>

            {loadingStats ? (
              <div className="loading-wrap"><div className="spinner" /><span>جاري التحميل...</span></div>
            ) : (
              <>
                <div className="stats-grid">
                  <div className="stat-tile blue">
                    <div className="tile-icon">👨‍🎓</div>
                    <div className="tile-val">{selectedStats.students_count || 0}</div>
                    <div className="tile-label">طلاب</div>
                  </div>
                  <div className="stat-tile green">
                    <div className="tile-icon">💰</div>
                    <div className="tile-val">{(selectedStats.balance || 0).toLocaleString()}</div>
                    <div className="tile-label">أرباح</div>
                  </div>
                  <div className="stat-tile yellow">
                    <div className="tile-icon">⏳</div>
                    <div className="tile-val">{selectedStats.pending_requests || 0}</div>
                    <div className="tile-label">طلبات</div>
                  </div>
                  <div className="stat-tile purple">
                    <div className="tile-icon">📚</div>
                    <div className="tile-val">{selectedStats.courses_count || 0}</div>
                    <div className="tile-label">كورسات</div>
                  </div>
                </div>

                <div className="mods-section">
                  <h4>👥 فريق العمل والمشرفين</h4>
                  {selectedStats.moderators?.length > 0 ? (
                    <div className="mods-list">
                      {selectedStats.moderators.map((mod, i) => (
                        <div key={i} className="mod-item">
                          <div className="mod-avatar">{mod.first_name?.[0] || '?'}</div>
                          <div className="mod-info">
                            <span className="mod-name">{mod.first_name}</span>
                            <span className="mod-user">@{mod.admin_username}</span>
                          </div>
                          <span className="mod-badge">مشرف</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-mods">لا يوجد مشرفين مساعدين لهذا المدرس.</p>
                  )}
                </div>
              </>
            )}

            <div className="modal-footer">
              <button className="btn-cancel-modal" style={{ width: '100%' }} onClick={() => setStatsModalOpen(false)}>إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ STYLES ══════════ */}
      <style jsx>{`

        /* ── Page Root ── */
        .page-root { padding-bottom: 60px; }

        /* ── Page Header ── */
        .page-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 24px; gap: 16px; flex-wrap: wrap;
        }
        .header-info { display: flex; align-items: center; gap: 16px; }
        .header-icon-wrap {
          width: 56px; height: 56px; border-radius: 14px;
          background: var(--gold-dim);
          border: 1px solid var(--border-accent);
          display: flex; align-items: center; justify-content: center;
          color: var(--gold); flex-shrink: 0;
        }
        .page-title { margin: 0 0 4px; font-size: 1.5rem; color: var(--text-primary); font-weight: 800; }
        .page-sub   { margin: 0; font-size: 0.88rem; color: var(--text-secondary); }

        .btn-add {
          display: flex; align-items: center; gap: 8px;
          background: var(--gold); color: #111009;
          padding: 10px 20px; border-radius: 10px; border: none;
          font-weight: 700; font-size: 0.9rem; cursor: pointer;
          transition: all 0.2s; white-space: nowrap;
        }
        .btn-add:hover { background: var(--gold-light); transform: translateY(-2px); box-shadow: 0 6px 20px rgba(201,168,76,0.3); }

        /* ── Search ── */
        .search-wrap {
          position: relative; display: flex; align-items: center;
          background: var(--bg-surface); border: 1px solid var(--border);
          border-radius: 12px; padding: 0 14px; gap: 10px;
          margin-bottom: 14px; transition: border-color 0.2s;
        }
        .search-wrap:focus-within { border-color: var(--gold); }
        .search-icon { color: var(--text-muted); flex-shrink: 0; }
        .search-input {
          flex: 1; background: transparent; border: none; outline: none;
          color: var(--text-primary); font-size: 0.95rem;
          padding: 13px 0; direction: rtl;
        }
        .search-input::placeholder { color: var(--text-muted); }
        .search-clear {
          background: none; border: none; color: var(--text-muted);
          font-size: 1.3rem; cursor: pointer; padding: 0 4px; line-height: 1;
        }
        .search-clear:hover { color: var(--text-primary); }

        .results-info { color: var(--text-muted); font-size: 0.83rem; margin-bottom: 16px; }

        /* ── Loading / Empty ── */
        .loading-wrap {
          display: flex; flex-direction: column; align-items: center; gap: 14px;
          padding: 60px 20px; color: var(--text-secondary);
        }
        .spinner {
          width: 40px; height: 40px;
          border: 3px solid var(--border);
          border-top-color: var(--gold);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .empty-state {
          display: flex; flex-direction: column; align-items: center; gap: 12px;
          padding: 60px 20px; color: var(--text-muted);
        }
        .empty-icon { color: var(--border-accent); opacity: 0.5; }

        /* ── Desktop Table ── */
        .table-card {
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: 16px; overflow: hidden;
          box-shadow: var(--shadow);
        }
        .table-scroll { overflow-x: auto; }

        table { width: 100%; border-collapse: collapse; min-width: 580px; }
        thead { background: var(--bg-elevated); }
        th {
          text-align: right; padding: 14px 20px;
          color: var(--text-muted); font-size: 0.8rem; font-weight: 700;
          letter-spacing: 0.04em; text-transform: uppercase;
          border-bottom: 1px solid var(--border);
          white-space: nowrap;
        }
        td {
          padding: 14px 20px; border-bottom: 1px solid var(--border);
          color: var(--text-primary); vertical-align: middle;
        }
        tr:last-child td { border-bottom: none; }
        tbody tr { transition: background 0.15s; }
        tbody tr:hover { background: var(--bg-hover); }
        .center-col { text-align: center; }

        /* ── User Cell ── */
        .user-cell { display: flex; align-items: center; gap: 12px; }
        .avatar {
          width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
          background: var(--gold-dim); border: 1px solid var(--border-accent);
          color: var(--gold); font-weight: 800; font-size: 1rem;
          display: flex; align-items: center; justify-content: center;
        }
        .teacher-name { font-weight: 700; font-size: 0.92rem; color: var(--text-primary); }

        /* ── Credentials ── */
        .creds { display: flex; flex-direction: column; gap: 4px; }
        .cred-row { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; }
        .cred-lbl {
          color: var(--text-muted); font-size: 0.72rem; font-weight: 600;
          width: 60px; flex-shrink: 0;
        }
        .cred-val {
          font-family: 'Courier New', monospace; font-size: 0.82rem;
          background: var(--bg-elevated); color: var(--text-secondary);
          padding: 2px 8px; border-radius: 6px; border: 1px solid var(--border);
        }
        .cred-val.gold { color: var(--gold); border-color: var(--border-accent); }

        /* ── Specialty Badge ── */
        .specialty-badge {
          background: var(--gold-dimmer); color: var(--gold);
          border: 1px solid var(--border-accent);
          padding: 3px 10px; border-radius: 20px;
          font-size: 0.8rem; font-weight: 600; white-space: nowrap;
        }

        .phone-cell { font-size: 0.88rem; color: var(--text-secondary); font-family: monospace; }

        /* ── Action Buttons ── */
        .actions { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
        .act-btn {
          width: 32px; height: 32px; border-radius: 8px; border: 1px solid transparent;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.2s;
        }
        .act-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .act-btn.view   { background: rgba(59,130,246,0.1);  color: #60a5fa; border-color: rgba(59,130,246,0.25); }
        .act-btn.edit   { background: var(--gold-dimmer);    color: var(--gold); border-color: var(--border-accent); }
        .act-btn.login  { background: rgba(168,85,247,0.1);  color: #c084fc; border-color: rgba(168,85,247,0.25); }
        .act-btn.delete { background: rgba(239,68,68,0.1);   color: #f87171; border-color: rgba(239,68,68,0.25); }
        .act-btn:not(:disabled):hover { transform: scale(1.12); filter: brightness(1.2); }

        /* ── Mobile Cards (hidden on desktop) ── */
        .mobile-cards { display: none; flex-direction: column; gap: 12px; }
        .mobile-card {
          background: var(--bg-surface); border: 1px solid var(--border);
          border-radius: 14px; overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .mc-top {
          display: flex; align-items: flex-start; justify-content: space-between;
          padding: 14px 14px 10px; gap: 10px; flex-wrap: wrap;
        }
        .mc-body { padding: 0 14px 14px; border-top: 1px solid var(--border); padding-top: 12px; margin-top: 2px; }

        /* ══ MODALS ══ */
        .overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(0,0,0,0.75);
          display: flex; align-items: center; justify-content: center;
          padding: 16px; backdrop-filter: blur(6px);
          animation: fadeIn 0.2s;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .modal {
          background: var(--bg-surface);
          border: 1px solid var(--border-accent);
          border-radius: 18px; width: 100%;
          box-shadow: 0 30px 60px rgba(0,0,0,0.5);
          animation: popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          max-height: 92vh; overflow-y: auto;
        }
        .form-modal  { max-width: 660px; }
        .confirm-modal { max-width: 400px; padding: 32px 28px; text-align: center; overflow: visible; }
        .stats-modal { max-width: 520px; }
        @keyframes popIn { from { transform: scale(0.93) translateY(20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }

        .modal-head {
          display: flex; justify-content: space-between; align-items: center;
          padding: 20px 24px 16px; border-bottom: 1px solid var(--border);
        }
        .modal-head h3 { margin: 0; color: var(--text-primary); font-size: 1.05rem; }
        .modal-close-btn {
          background: var(--bg-elevated); border: 1px solid var(--border);
          color: var(--text-muted); width: 32px; height: 32px;
          border-radius: 8px; cursor: pointer;
          display: flex; align-items: center; justify-content: center; transition: 0.2s;
        }
        .modal-close-btn:hover { color: var(--text-primary); border-color: var(--border-accent); }

        .error-banner {
          margin: 14px 24px 0;
          background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3);
          color: #fca5a5; padding: 10px 14px; border-radius: 10px; font-size: 0.88rem;
        }

        /* ─ Form ─ */
        .form-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 20px; }
        .form-section {
          border: 1px solid var(--border); border-radius: 12px;
          padding: 16px; background: var(--bg-elevated);
        }
        .section-label {
          display: flex; align-items: center; gap: 10px;
          font-size: 0.82rem; font-weight: 700; color: var(--text-secondary);
          text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 14px;
        }
        .section-num {
          width: 22px; height: 22px; background: var(--gold); color: #111009;
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
          font-size: 0.75rem; font-weight: 800; flex-shrink: 0;
        }
        .form-row { display: flex; gap: 12px; }
        .form-row .fg { flex: 1; min-width: 0; }
        .fg { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
        .fg:last-child { margin-bottom: 0; }
        label { font-size: 0.82rem; color: var(--text-secondary); font-weight: 600; }
        .opt { color: var(--text-muted); font-weight: 400; }
        input {
          background: var(--bg-surface); border: 1px solid var(--border);
          color: var(--text-primary); padding: 9px 12px; border-radius: 9px;
          font-size: 0.88rem; outline: none; transition: border-color 0.2s; width: 100%;
        }
        input:focus { border-color: var(--gold); }
        .dash-input:focus { border-color: #c084fc; }

        /* ─ Modal Footer ─ */
        .modal-footer {
          display: flex; gap: 10px; justify-content: flex-end;
          padding: 16px 24px; border-top: 1px solid var(--border);
          background: var(--bg-elevated); border-radius: 0 0 18px 18px;
        }
        .modal-footer.centered { justify-content: center; border: none; background: transparent; padding: 0; margin-top: 20px; }

        .btn-cancel-modal {
          background: transparent; border: 1px solid var(--border);
          color: var(--text-secondary); padding: 9px 20px;
          border-radius: 9px; cursor: pointer; font-weight: 600;
          font-size: 0.88rem; transition: 0.2s;
        }
        .btn-cancel-modal:hover { background: var(--bg-hover); color: var(--text-primary); }
        .btn-save {
          background: var(--gold); color: #111009; border: none;
          padding: 9px 22px; border-radius: 9px; font-weight: 700;
          font-size: 0.88rem; cursor: pointer; transition: 0.2s;
        }
        .btn-save:hover { background: var(--gold-light); transform: translateY(-1px); }
        .btn-danger {
          background: #ef4444; color: white; border: none;
          padding: 9px 22px; border-radius: 9px; font-weight: 700;
          font-size: 0.88rem; cursor: pointer; transition: 0.2s;
        }
        .btn-danger:hover { background: #dc2626; }
        .btn-purple {
          background: #a855f7; color: white; border: none;
          padding: 9px 22px; border-radius: 9px; font-weight: 700;
          font-size: 0.88rem; cursor: pointer; transition: 0.2s;
        }
        .btn-purple:hover { background: #9333ea; }

        /* ─ Confirm Modal ─ */
        .confirm-icon {
          width: 66px; height: 66px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 18px; border: 2px solid transparent;
        }
        .confirm-icon.danger { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.3); color: #f87171; }
        .confirm-icon.purple { background: rgba(168,85,247,0.1); border-color: rgba(168,85,247,0.3); color: #c084fc; }
        .confirm-modal h3 { margin: 0 0 10px; color: var(--text-primary); font-size: 1.1rem; }
        .confirm-modal p  { margin: 0 0 8px; color: var(--text-secondary); font-size: 0.9rem; line-height: 1.55; }
        .gold-text { color: var(--gold); }
        .warn-note { color: #f87171; background: rgba(239,68,68,0.07); padding: 10px; border-radius: 8px; font-size: 0.82rem !important; margin-top: 8px !important; }
        .info-note { color: #c084fc; background: rgba(168,85,247,0.07); padding: 10px; border-radius: 8px; font-size: 0.82rem !important; margin-top: 8px !important; }

        /* ─ Stats Modal ─ */
        .stats-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 12px; padding: 20px 24px 16px;
        }
        .stat-tile {
          background: var(--bg-elevated); border: 1px solid var(--border);
          border-radius: 12px; padding: 16px; text-align: center;
        }
        .tile-icon { font-size: 1.4rem; margin-bottom: 6px; }
        .tile-val  { font-size: 1.6rem; font-weight: 800; line-height: 1; }
        .tile-label { font-size: 0.78rem; color: var(--text-muted); margin-top: 4px; }
        .stat-tile.blue   .tile-val { color: #60a5fa; }
        .stat-tile.green  .tile-val { color: #4ade80; }
        .stat-tile.yellow .tile-val { color: var(--gold); }
        .stat-tile.purple .tile-val { color: #c084fc; }

        .mods-section { padding: 0 24px 20px; }
        .mods-section h4 { margin: 0 0 12px; color: var(--text-secondary); font-size: 0.9rem; }
        .mods-list { display: flex; flex-direction: column; gap: 8px; max-height: 180px; overflow-y: auto; }
        .mod-item {
          display: flex; align-items: center; gap: 10px;
          background: var(--bg-elevated); padding: 10px 12px;
          border-radius: 10px; border: 1px solid var(--border);
        }
        .mod-avatar {
          width: 32px; height: 32px; border-radius: 8px;
          background: var(--gold-dim); border: 1px solid var(--border-accent);
          color: var(--gold); font-weight: 800; font-size: 0.9rem;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .mod-info { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .mod-name { color: var(--text-primary); font-size: 0.88rem; font-weight: 600; }
        .mod-user { color: var(--text-muted); font-size: 0.75rem; font-family: monospace; }
        .mod-badge {
          background: var(--gold-dimmer); color: var(--gold);
          border: 1px solid var(--border-accent);
          font-size: 0.7rem; padding: 2px 8px; border-radius: 20px; white-space: nowrap;
        }
        .no-mods { color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 20px; font-style: italic; }

        /* ══ RESPONSIVE ══ */
        @media (max-width: 768px) {
          .page-title { font-size: 1.2rem; }
          .header-icon-wrap { width: 44px; height: 44px; border-radius: 10px; }
          .btn-add { padding: 9px 14px; font-size: 0.85rem; }

          /* Hide table, show cards */
          .table-card  { display: none; }
          .mobile-cards { display: flex; }

          /* Form rows stack */
          .form-row { flex-direction: column; gap: 0; }
          .form-body { padding: 16px; }
          .modal-head { padding: 16px 16px 12px; }
          .modal-footer { padding: 14px 16px; }
          .error-banner { margin: 10px 16px 0; }
          .stats-grid { padding: 16px 16px 12px; }
          .mods-section { padding: 0 16px 16px; }

          /* Confirm modals */
          .confirm-modal { padding: 24px 20px; }
        }

        @media (max-width: 420px) {
          .btn-add span { display: none; }
          .btn-add { padding: 9px 12px; }
        }
      `}</style>
    </SuperLayout>
  );
}
