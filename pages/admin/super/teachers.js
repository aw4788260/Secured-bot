import Head from 'next/head';
import { useState, useEffect } from 'react';
import SuperLayout from '../../../components/SuperLayout';

// --- مكونات الأيقونات ---
const Icons = {
  add: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
  search: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  edit: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>,
  trash: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
  close: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
  eye: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>,
  key: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>,
  warn: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>,
  check: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>,
  user: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>,
  teachers: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
};

// --- مكون Toast للإشعارات ---
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast ${type}`}>
      <div className="icon">{type === 'success' ? Icons.check : Icons.warn}</div>
      <span>{message}</span>
      <style jsx>{`
        .toast {
          position: fixed; top: 20px; left: 20px; z-index: 2000;
          background: var(--bg-surface); color: var(--text-primary); padding: 12px 20px;
          border-radius: 12px; display: flex; align-items: center; gap: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          animation: slideIn 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55);
          border: 1px solid var(--border); min-width: 300px;
        }
        .toast.success { border-right: 4px solid #22c55e; }
        .toast.error { border-right: 4px solid #ef4444; }
        .toast.error .icon { stroke: #ef4444; }
        @keyframes slideIn { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
    </div>
  );
};

export default function SuperTeachers() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals States
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  
  const [selectedStats, setSelectedStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  
  const [editingId, setEditingId] = useState(null);
  const [teacherToDelete, setTeacherToDelete] = useState(null);

  // حالة الإشعارات (Toast)
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => setToast({ message, type });

  // حالة الأخطاء داخل الفورم
  const [formError, setFormError] = useState('');

  const [formData, setFormData] = useState({
    name: '', phone: '', specialty: '', bio: '', whatsapp_number: '',
    cash_numbers: '', instapay_numbers: '', instapay_links: '',
    dashboard_username: '', dashboard_password: '', 
    app_username: '', app_password: ''
  });
  // حالة مودال تسجيل الدخول
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [teacherToLogin, setTeacherToLogin] = useState(null);

  const fetchTeachers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/super/teachers'); 
      if (res.ok) {
        setTeachers(await res.json());
      } else {
        showToast('فشل جلب البيانات', 'error');
      }
    } catch (error) { 
      console.error(error);
      showToast('خطأ في الاتصال بالسيرفر', 'error');
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { fetchTeachers(); }, []);

  // --- دوال عرض التفاصيل والإحصائيات والمشرفين ---
  const handleViewStats = async (teacher) => {
    setStatsModalOpen(true);
    setLoadingStats(true);
    // دمج البيانات الأساسية فوراً
    setSelectedStats({ ...teacher }); 
    
    try {
      const res = await fetch(`/api/dashboard/super/teacher-stats?id=${teacher.id}`);
      if (res.ok) {
        const statsData = await res.json();
        setSelectedStats(prev => ({ ...prev, ...statsData }));
      }
    } catch (err) { console.error(err); } 
    finally { setLoadingStats(false); }
  };

  // --- دوال النموذج (إضافة/تعديل) ---
  const handleOpenForm = (teacher = null) => {
    setFormError('');
    if (teacher) {
      setEditingId(teacher.id);
      const pd = teacher.payment_details || {};
      
      const cashStr = Array.isArray(pd.cash_numbers) ? pd.cash_numbers.join(', ') : '';
      const instaNumStr = Array.isArray(pd.instapay_numbers) ? pd.instapay_numbers.join(', ') : '';
      const instaLinkStr = Array.isArray(pd.instapay_links) ? pd.instapay_links.join(', ') : '';

      setFormData({ 
        name: teacher.name, 
        phone: teacher.phone,
        specialty: teacher.specialty,
        bio: teacher.bio || '',
        whatsapp_number: teacher.whatsapp_number || '',
        cash_numbers: cashStr,
        instapay_numbers: instaNumStr,
        instapay_links: instaLinkStr,
        dashboard_username: teacher.dashboard_username || '', 
        dashboard_password: '', 
        app_username: teacher.app_username || '', 
        app_password: ''
      });
    } else {
      setEditingId(null);
      setFormData({ 
        name: '', phone: '', specialty: '', bio: '', whatsapp_number: '',
        cash_numbers: '', instapay_numbers: '', instapay_links: '',
        dashboard_username: '', dashboard_password: '',
        app_username: '', app_password: ''
      });
    }
    setFormModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');
    
    try {
      const url = '/api/dashboard/super/teachers';
      const method = editingId ? 'PUT' : 'POST';

      const payment_details = {
          cash_numbers: formData.cash_numbers.split(',').map(s => s.trim()).filter(Boolean),
          instapay_numbers: formData.instapay_numbers.split(',').map(s => s.trim()).filter(Boolean),
          instapay_links: formData.instapay_links.split(',').map(s => s.trim()).filter(Boolean)
      };

      const bodyData = { 
          ...formData, 
          payment_details, 
          id: editingId 
      };

      const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyData)
      });
      
      const data = await res.json();

      if (res.ok) {
          await fetchTeachers(); 
          setFormModalOpen(false);
          showToast(editingId ? 'تم تعديل البيانات بنجاح' : 'تم إضافة المدرس بنجاح', 'success');
      } else {
          setFormError(data.error || 'حدث خطأ غير معروف');
      }
    } catch (error) { 
      setFormError('خطأ في الاتصال بالشبكة');
    }
  };

  // --- دوال الحذف ---
  const confirmDelete = (teacher) => {
    setTeacherToDelete(teacher);
    setDeleteModalOpen(true);
  };

  const executeDelete = async () => {
    if (!teacherToDelete) return;
    try {
        const res = await fetch(`/api/dashboard/super/teachers?id=${teacherToDelete.id}`, { method: 'DELETE' });
        if (res.ok) {
            setTeachers(prev => prev.filter(t => t.id !== teacherToDelete.id));
            setDeleteModalOpen(false);
            setTeacherToDelete(null);
            showToast('تم حذف المدرس وجميع بياناته بنجاح', 'success');
        } else {
            showToast('فشل الحذف، حاول مرة أخرى', 'error');
        }
    } catch (err) { 
        showToast('خطأ في الاتصال', 'error');
    }
  };

  // --- دوال الدخول الفرعي لحساب المدرس ---
  const confirmLogin = (teacher) => {
    setTeacherToLogin(teacher);
    setLoginModalOpen(true);
  };

  const executeLogin = async () => {
    if (!teacherToLogin) return;
    
    try {
        const res = await fetch('/api/auth/super-login-as', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: teacherToLogin.dashboard_username })
        });

        if (res.ok) {
            const data = await res.json();
            
            localStorage.removeItem('admin_user_id');
            localStorage.removeItem('admin_name');
            localStorage.removeItem('is_admin_session');

            localStorage.setItem('admin_user_id', data.user.id);
            localStorage.setItem('admin_name', data.user.name);
            localStorage.setItem('is_admin_session', 'true');
            
            showToast(`تم الدخول لحساب ${teacherToLogin.name} بنجاح`, 'success');
            setLoginModalOpen(false);

            setTimeout(() => {
                window.location.href = '/admin/teacher';
            }, 500);
            
        } else {
            const errData = await res.json();
            showToast(errData.error || 'فشل الدخول، تأكد من البيانات', 'error');
        }
    } catch (err) { 
        console.error(err);
        showToast('خطأ في الاتصال بالسيرفر', 'error');
    }
  };
  
  const filteredTeachers = teachers.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.dashboard_username?.includes(searchQuery) ||
    t.specialty?.includes(searchQuery)
  );

  return (
    <SuperLayout>
      <Head><title>إدارة المدرسين | الإدارة العليا</title></Head>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-container">
        <div className="top-bar">
          <div>
            <div className="page-title">
              <div className="title-icon">{Icons.teachers}</div>
              <h1>إدارة المدرسين</h1>
            </div>
            <p>إدارة الحسابات، المشرفين، والبيانات المالية.</p>
          </div>
          <button className="btn-primary" onClick={() => handleOpenForm()}>
            {Icons.add} مدرس جديد
          </button>
        </div>

        <div className="search-bar">
          <div className="search-input">
            {Icons.search}
            <input type="text" placeholder="بحث بالاسم، التخصص، أو اسم المستخدم..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>

        <div className="table-wrapper">
          {loading ? <div className="loading">جاري التحميل...</div> : (
            <table>
              <thead>
                <tr>
                  <th>المدرس</th>
                  <th>بيانات الدخول</th>
                  <th>التخصص</th>
                  <th>الهاتف</th>
                  <th style={{textAlign:'center'}}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.map(t => (
                  <tr key={t.id}>
                    <td>
                      <div className="user-info">
                        <div className="avatar">{t.name[0]}</div>
                        <span className="name">{t.name}</span>
                      </div>
                    </td>
                    <td>
                        <div className="credentials-cell">
                            <div className="cred-row">
                                <span className="lbl">Dash:</span>
                                <span className="val highlight">@{t.dashboard_username}</span>
                            </div>
                            <div className="cred-row">
                                <span className="lbl">App:</span>
                                <span className="val">@{t.app_username}</span>
                            </div>
                        </div>
                    </td>
                    <td><span className="badge">{t.specialty}</span></td>
                    <td dir="ltr" className="phone-col">{t.phone}</td>
                    <td>
                      <div className="actions-wrapper">
                        <div className="main-actions">
                          <button className="btn-icon view" onClick={() => handleViewStats(t)} title="التفاصيل والمشرفين">{Icons.eye}</button>
                          <button className="btn-icon edit" onClick={() => handleOpenForm(t)} title="تعديل">{Icons.edit}</button>
                          <button className="btn-icon login" onClick={() => confirmLogin(t)} title="دخول للوحة" disabled={!t.dashboard_username}>{Icons.key}</button>
                        </div>
                        
                        {/* خط فاصل لفصل زر الحذف وتجنب الخطأ */}
                        <div className="action-divider"></div>
                        
                        <button className="btn-icon delete separated" onClick={() => confirmDelete(t)} title="حذف">{Icons.trash}</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredTeachers.length === 0 && (
                  <tr><td colSpan="5" className="empty-row">لا يوجد نتائج.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* --- نافذة الإضافة / التعديل المحسنة --- */}
      {formModalOpen && (
        <div className="modal-overlay">
          <div className="modal form-modal">
            <div className="modal-header">
              <h3>{editingId ? 'تعديل بيانات مدرس' : 'إضافة مدرس جديد'}</h3>
              <button onClick={() => setFormModalOpen(false)}>{Icons.close}</button>
            </div>
            
            {formError && (
                <div className="error-banner">
                    ⚠️ {formError}
                </div>
            )}

            <form onSubmit={handleSave}>
              
              {/* 1. البيانات الشخصية */}
              <div className="form-section">
                <h4>1. البيانات الأساسية والاتصال</h4>
                <div className="form-group">
                    <label>الاسم بالكامل</label>
                    <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="مثال: أ. محمد أحمد"/>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label>التخصص</label>
                        <input type="text" required value={formData.specialty} onChange={e => setFormData({...formData, specialty: e.target.value})}/>
                    </div>
                    <div className="form-group">
                        <label>رقم الهاتف (للدخول)</label>
                        <input type="text" required dir="ltr" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}/>
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label>رقم واتساب (اختياري)</label>
                        <input type="text" dir="ltr" value={formData.whatsapp_number} onChange={e => setFormData({...formData, whatsapp_number: e.target.value})} placeholder="مثال: 01xxxxxxxxx"/>
                    </div>
                    <div className="form-group">
                        <label>نبذة مختصرة (Bio)</label>
                        <input type="text" value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} placeholder="مدرس أول في..."/>
                    </div>
                </div>
              </div>

              {/* 2. البيانات المالية */}
              <div className="form-section">
                <h4>2. بيانات الدفع (Payment Details)</h4>
                <div className="form-group">
                    <label>أرقام فودافون كاش (افصل بفاصلة)</label>
                    <input type="text" dir="ltr" value={formData.cash_numbers} onChange={e => setFormData({...formData, cash_numbers: e.target.value})} placeholder="010xxxx, 012xxxx"/>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label>أرقام إنستا باي (IPN)</label>
                        <input type="text" dir="ltr" value={formData.instapay_numbers} onChange={e => setFormData({...formData, instapay_numbers: e.target.value})} placeholder="01xxxx, 012xxx"/>
                    </div>
                    <div className="form-group">
                        <label>روابط/يوزرنيم إنستا باي (Links)</label>
                        <input type="text" dir="ltr" value={formData.instapay_links} onChange={e => setFormData({...formData, instapay_links: e.target.value})} placeholder="name@instapay, url..."/>
                    </div>
                </div>
              </div>

              {/* 3. بيانات لوحة التحكم */}
              <div className="form-section">
                <h4>3. دخول لوحة التحكم (للمدرس)</h4>
                <div className="form-row">
                    <div className="form-group">
                        <label>اسم المستخدم (Dashboard)</label>
                        <input type="text" required dir="ltr" className="input-dash" value={formData.dashboard_username} onChange={e => setFormData({...formData, dashboard_username: e.target.value})}/>
                    </div>
                    <div className="form-group">
                        <label>كلمة المرور {editingId && '(اختياري)'}</label>
                        <input type="password" dir="ltr" className="input-dash" value={formData.dashboard_password} onChange={e => setFormData({...formData, dashboard_password: e.target.value})} placeholder={editingId ? "اتركها فارغة لعدم التغيير" : "******"}/>
                    </div>
                </div>
              </div>

              {/* 4. بيانات التطبيق */}
              <div className="form-section">
                <h4>4. دخول التطبيق (للطلاب)</h4>
                <div className="form-row">
                    <div className="form-group">
                        <label>اسم المستخدم (App)</label>
                        <input type="text" required dir="ltr" className="input-app" value={formData.app_username} onChange={e => setFormData({...formData, app_username: e.target.value})}/>
                    </div>
                    <div className="form-group">
                        <label>كلمة المرور {editingId && '(اختياري)'}</label>
                        <input type="password" dir="ltr" className="input-app" value={formData.app_password} onChange={e => setFormData({...formData, app_password: e.target.value})} placeholder={editingId ? "اتركها فارغة لعدم التغيير" : "******"}/>
                    </div>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setFormModalOpen(false)}>إلغاء</button>
                <button type="submit" className="btn-submit">حفظ البيانات</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- نافذة الحذف --- */}
      {deleteModalOpen && teacherToDelete && (
        <div className="modal-overlay">
            <div className="modal delete-modal">
                <div className="delete-icon">
                    {Icons.warn}
                </div>
                <h3>تأكيد الحذف</h3>
                <p>هل أنت متأكد من حذف المدرس <strong>{teacherToDelete.name}</strong>؟</p>
                <p className="warning-text">⚠️ سيتم حذف كافة البيانات المرتبطة به (الكورسات، الطلاب، الأرصدة) وحذف حسابات الدخول نهائياً.</p>
                
                <div className="modal-actions centered">
                    <button className="btn-cancel" onClick={() => setDeleteModalOpen(false)}>تراجع</button>
                    <button className="btn-danger" onClick={executeDelete}>نعم، احذف نهائياً</button>
                </div>
            </div>
        </div>
      )}

      {/* --- نافذة الإحصائيات --- */}
      {statsModalOpen && selectedStats && (
        <div className="modal-overlay">
          <div className="modal stats-modal">
            <div className="modal-header">
              <h3>📊 تفاصيل: {selectedStats.name}</h3>
              <button onClick={() => setStatsModalOpen(false)}>{Icons.close}</button>
            </div>
            
            {loadingStats ? <div className="loading">جاري التحميل...</div> : (
               <>
               <div className="stats-grid-modal">
                 <div className="stat-box blue"><h4>👨‍🎓 طلاب</h4><span className="val">{selectedStats.students_count || 0}</span></div>
                 <div className="stat-box green"><h4>💰 أرباح</h4><span className="val">{(selectedStats.balance || 0).toLocaleString()}</span></div>
                 <div className="stat-box yellow"><h4>⏳ طلبات</h4><span className="val">{selectedStats.pending_requests || 0}</span></div>
                 <div className="stat-box purple"><h4>📚 كورسات</h4><span className="val">{selectedStats.courses_count || 0}</span></div>
               </div>

               {/* المشرفون المساعدون */}
               <div className="moderators-section">
                  <h4>👥 فريق العمل والمشرفين</h4>
                  {selectedStats.moderators && selectedStats.moderators.length > 0 ? (
                      <div className="mods-list">
                          {selectedStats.moderators.map((mod, i) => (
                              <div key={i} className="mod-item">
                                  <div className="mod-icon">{Icons.user}</div>
                                  <div className="mod-info">
                                      <span className="mod-name">{mod.first_name}</span>
                                      <span className="mod-user">@{mod.admin_username}</span>
                                  </div>
                                  <span className="mod-role">مشرف</span>
                              </div>
                          ))}
                      </div>
                  ) : (
                      <p className="no-mods">لا يوجد مشرفين مساعدين لهذا المدرس.</p>
                  )}
               </div>
               </>
            )}
            <div className="modal-actions"><button className="btn-cancel full" onClick={() => setStatsModalOpen(false)}>إغلاق</button></div>
          </div>
        </div>
      )}

      {/* --- نافذة تأكيد الدخول لحساب المدرس --- */}
      {loginModalOpen && teacherToLogin && (
        <div className="modal-overlay">
            <div className="modal login-modal">
                <div className="login-icon-box">
                    {Icons.key}
                </div>
                <h3>تأكيد الدخول</h3>
                <p>هل أنت متأكد من الدخول إلى لوحة تحكم المدرس <strong>{teacherToLogin.name}</strong>؟</p>
                <p className="info-text">سيتم فتح لوحة التحكم الخاصة به في تبويب جديد بصلاحيات كاملة.</p>
                
                <div className="modal-actions centered">
                    <button className="btn-cancel" onClick={() => setLoginModalOpen(false)}>إلغاء</button>
                    <button className="btn-confirm" onClick={executeLogin}>نعم، دخول</button>
                </div>
            </div>
        </div>
      )}
  
      <style jsx>{`
        /* ================= Theme-Aware Styling ================= */
        .page-container { padding-bottom: 50px; }
        
        /* Title and Icon */
        .page-title { display: flex; align-items: center; gap: 12px; margin-bottom: 5px; }
        .title-icon { 
            color: var(--gold); 
            display: flex; align-items: center; justify-content: center; 
            background: var(--gold-dimmer); 
            padding: 8px; 
            border-radius: 10px; 
            border: 1px solid var(--border-accent);
        }
        
        .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; border-bottom: 1px solid var(--border); padding-bottom: 20px; }
        .top-bar h1 { margin: 0; color: var(--text-primary); font-size: 1.75rem; font-weight: 800; }
        .top-bar p { margin: 0; color: var(--text-muted); font-size: 0.95rem; }
        
        .btn-primary { background: var(--gold); color: #111009; padding: 10px 20px; border-radius: 8px; border: none; font-weight: bold; cursor: pointer; display: flex; gap: 8px; align-items: center; transition: 0.2s; }
        .btn-primary:hover { background: var(--gold-light); transform: translateY(-2px); box-shadow: 0 4px 12px var(--gold-dim); }

        .search-bar { margin-bottom: 20px; }
        .search-input { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px 15px; display: flex; align-items: center; gap: 10px; color: var(--text-muted); }
        .search-input input { background: transparent; border: none; color: var(--text-primary); font-size: 1rem; width: 100%; outline: none; }

        .table-wrapper { background: var(--bg-surface); border-radius: 16px; border: 1px solid var(--border); overflow: hidden; box-shadow: var(--shadow, 0 4px 24px rgba(0,0,0,0.1)); }
        table { width: 100%; border-collapse: collapse; }
        thead { background: var(--bg-elevated); }
        th { text-align: right; padding: 15px 20px; color: var(--text-muted); font-size: 0.9rem; font-weight: 700; border-bottom: 1px solid var(--border); text-transform: uppercase; }
        td { padding: 15px 20px; border-bottom: 1px solid var(--border); color: var(--text-secondary); vertical-align: middle; }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: var(--bg-hover); }
        
        .empty-row { text-align: center; padding: 40px !important; color: var(--text-muted) !important; }
        .phone-col { color: var(--text-secondary); font-size: 0.9rem; }

        .user-info { display: flex; align-items: center; gap: 12px; }
        .avatar { width: 40px; height: 40px; background: var(--gold-dim); color: var(--gold); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.1rem; border: 1px solid var(--border-accent); }
        .name { font-weight: bold; font-size: 0.95rem; color: var(--text-primary); }

        .credentials-cell { display: flex; flex-direction: column; gap: 5px; font-size: 0.85rem; }
        .cred-row { display: flex; gap: 8px; align-items: center; }
        .cred-row .lbl { color: var(--text-muted); font-size: 0.75rem; width: 35px; }
        .cred-row .val { font-family: monospace; color: var(--text-secondary); background: var(--bg-elevated); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border); }
        .cred-row .val.highlight { color: var(--gold); border-color: var(--border-accent); background: var(--gold-dimmer); }

        .badge { background: var(--gold-dimmer); color: var(--gold); padding: 4px 10px; border-radius: 20px; font-size: 0.85rem; border: 1px solid var(--border-accent); }
        
        /* Actions Layout */
        .actions-wrapper { display: flex; align-items: center; justify-content: center; gap: 8px; }
        .main-actions { display: flex; gap: 6px; }
        .action-divider { width: 2px; height: 26px; background-color: var(--border); border-radius: 2px; margin: 0 4px; }
        
        .btn-icon { background: var(--bg-elevated); border: 1px solid var(--border); width: 34px; height: 34px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
        .view { color: var(--gold); } .view:hover { background: var(--gold-dim); border-color: var(--gold); }
        .edit { color: #facc15; } .edit:hover { background: rgba(250, 204, 21, 0.1); border-color: #facc15; }
        .login { color: #a855f7; } .login:hover { background: rgba(168, 85, 247, 0.1); border-color: #a855f7; }
        
        /* Delete Button */
        .delete { color: #ef4444; } 
        .delete.separated { border: 1px dashed rgba(239, 68, 68, 0.4); margin-right: 4px; }
        .delete.separated:hover { background: rgba(239, 68, 68, 0.2); border-style: solid; }
        
        .btn-icon:hover { transform: scale(1.1); filter: brightness(1.2); }

        /* Modals */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(5px); }
        .modal { background: var(--bg-surface); border: 1px solid var(--border-accent); width: 90%; border-radius: 16px; padding: 25px; box-shadow: 0 30px 60px rgba(0,0,0,0.5); animation: popIn 0.2s ease-out; }
        .form-modal { max-width: 650px; max-height: 90vh; overflow-y: auto; }
        
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid var(--border); padding-bottom: 15px; }
        .modal-header h3 { margin: 0; color: var(--gold); font-size: 1.35rem; }
        .modal-header button { background: none; border: none; color: var(--text-muted); cursor: pointer; transition: 0.2s; }
        .modal-header button:hover { color: var(--text-primary); }

        .form-section { margin-bottom: 20px; border-bottom: 1px solid var(--border); padding-bottom: 15px; }
        .form-section:last-child { border-bottom: none; }
        .form-section h4 { margin: 0 0 15px 0; color: var(--gold); font-size: 0.9rem; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
        
        .form-group { margin-bottom: 12px; }
        .form-row { display: flex; gap: 15px; }
        .form-row .form-group { flex: 1; }
        label { display: block; color: var(--text-secondary); margin-bottom: 6px; font-size: 0.85rem; font-weight: 600; }
        input { width: 100%; background: var(--bg-elevated); border: 1px solid var(--border); padding: 10px; border-radius: 8px; color: var(--text-primary); outline: none; transition: 0.2s; }
        input:focus { border-color: var(--gold); box-shadow: 0 0 0 2px var(--gold-dim); }
        .input-dash:focus { border-color: var(--gold-light); }
        .input-app:focus { border-color: var(--gold-light); }

        .error-banner { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #fca5a5; padding: 10px; border-radius: 8px; margin-bottom: 15px; font-size: 0.9rem; }

        .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; }
        .modal-actions.centered { justify-content: center; margin-top: 20px; }
        .btn-cancel { background: transparent; border: 1px solid var(--border); color: var(--text-secondary); padding: 8px 16px; border-radius: 8px; cursor: pointer; transition: 0.2s; }
        .btn-cancel:hover { background: var(--bg-hover); color: var(--text-primary); }
        .btn-submit { background: var(--gold); border: none; color: #111009; padding: 8px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s; }
        .btn-submit:hover { background: var(--gold-light); transform: translateY(-2px); box-shadow: 0 4px 12px var(--gold-dim); }
        .btn-danger { background: #ef4444; border: none; color: white; padding: 8px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s; }
        .btn-danger:hover { background: #dc2626; transform: translateY(-2px); }

        .delete-modal { max-width: 400px; text-align: center; border: 1px solid #ef4444; }
        .delete-icon { background: rgba(239, 68, 68, 0.1); width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px auto; }
        .warning-text { color: #fca5a5; font-size: 0.85rem; background: rgba(239, 68, 68, 0.1); padding: 10px; border-radius: 8px; margin-top: 10px; border: 1px dashed rgba(239, 68, 68, 0.3); }

        /* Stats Modal */
        .stats-grid-modal { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
        .stat-box { background: var(--bg-elevated); padding: 15px; border-radius: 12px; border: 1px solid var(--border); text-align: center; }
        .stat-box h4 { margin: 0 0 5px 0; color: var(--text-muted); font-size: 0.85rem; font-weight: normal; }
        .stat-box .val { font-size: 1.5rem; font-weight: bold; display: block; color: var(--text-primary); }
        .blue .val { color: var(--gold); } .green .val { color: #4ade80; }
        .yellow .val { color: #facc15; } .purple .val { color: #c084fc; }
        .full { width: 100%; }

        .moderators-section { margin-top: 20px; border-top: 1px solid var(--border); padding-top: 15px; }
        .moderators-section h4 { color: var(--text-primary); font-size: 0.95rem; margin-bottom: 10px; }
        .mods-list { display: grid; grid-template-columns: 1fr; gap: 10px; max-height: 150px; overflow-y: auto; }
        .mod-item { display: flex; align-items: center; gap: 10px; background: var(--bg-elevated); padding: 10px; border-radius: 8px; border: 1px solid var(--border); }
        .mod-icon { color: var(--text-muted); }
        .mod-info { flex: 1; display: flex; flex-direction: column; }
        .mod-name { color: var(--text-primary); font-size: 0.9rem; font-weight: 600; }
        .mod-user { color: var(--text-muted); font-size: 0.8rem; font-family: monospace; }
        .mod-role { background: var(--gold-dimmer); color: var(--gold); font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-accent); font-weight: bold; }
        .no-mods { color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 10px; font-style: italic; }

        /* Login Modal */
        .login-modal { max-width: 400px; text-align: center; border: 1px solid var(--border-accent); }
        .login-icon-box { 
            background: var(--gold-dim); 
            width: 60px; height: 60px; 
            border-radius: 50%; 
            display: flex; align-items: center; justify-content: center; 
            margin: 0 auto 15px auto; 
            color: var(--gold);
            border: 1px solid var(--border-accent);
        }
        .info-text { 
            color: var(--text-secondary); 
            font-size: 0.85rem; 
            background: var(--bg-elevated); 
            padding: 10px; 
            border-radius: 8px; 
            margin-top: 10px; 
            border: 1px dashed var(--border);
        }
        .btn-confirm { 
            background: var(--gold); 
            border: none; 
            color: #111009; 
            padding: 8px 25px; 
            border-radius: 8px; 
            font-weight: bold; 
            cursor: pointer; 
            transition: 0.2s;
        }
        .btn-confirm:hover { background: var(--gold-light); transform: translateY(-2px); box-shadow: 0 4px 12px var(--gold-dim); }
        
        .loading { color: var(--gold); text-align: center; padding: 40px; font-weight: bold; }

        @keyframes popIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        
        @media (max-width: 768px) {
            .form-row { flex-direction: column; gap: 0; }
            td, th { padding: 12px 10px; font-size: 0.85rem; }
            .top-bar { flex-direction: column; align-items: flex-start; gap: 15px; }
            .btn-primary { width: 100%; justify-content: center; }
            .stats-grid-modal { grid-template-columns: 1fr; }
        }
      `}</style>
    </SuperLayout>
  );
}
