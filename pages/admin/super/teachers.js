import Head from 'next/head';
import { useState, useEffect } from 'react';
import SuperLayout from '../../../components/SuperLayout';

// تعريف الأيقونات
const Icons = {
  add: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
  search: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  edit: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>,
  trash: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
  close: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
  eye: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>,
  key: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>,
  warn: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
};

export default function SuperTeachers() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // حالات المودال المختلفة
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false); // ✅ مودال الحذف الجديد

  // حالة البيانات
  const [selectedStats, setSelectedStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  
  const [editingId, setEditingId] = useState(null);
  const [teacherToDelete, setTeacherToDelete] = useState(null); // ✅ لتخزين المدرس المراد حذفه

  // بيانات النموذج الشاملة
  const [formData, setFormData] = useState({
    name: '', 
    phone: '', 
    specialty: '',
    dashboard_username: '', dashboard_password: '', // للدخول للوحة التحكم
    app_username: '', app_password: '' // للدخول للتطبيق
  });

  // --- جلب البيانات ---
  const fetchTeachers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/super/teachers'); 
      if (res.ok) setTeachers(await res.json());
    } catch (error) { console.error(error); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTeachers(); }, []);

  // --- دوال عرض التفاصيل والإحصائيات ---
  const handleViewStats = async (teacher) => {
    setStatsModalOpen(true);
    setLoadingStats(true);
    setSelectedStats({ ...teacher }); 
    try {
      const res = await fetch(`/api/dashboard/super/teacher-stats?id=${teacher.id}`);
      if (res.ok) setSelectedStats(prev => ({ ...prev, ...(await res.json()) }));
    } catch (err) { console.error(err); } 
    finally { setLoadingStats(false); }
  };

  // --- فتح وتجهيز نموذج الإضافة/التعديل ---
  const handleOpenForm = (teacher = null) => {
    if (teacher) {
      setEditingId(teacher.id);
      setFormData({ 
        name: teacher.name, 
        phone: teacher.phone || '',
        specialty: teacher.specialty || '',
        dashboard_username: teacher.dashboard_username || '', dashboard_password: '', 
        app_username: teacher.app_username || '', app_password: ''
      });
    } else {
      setEditingId(null);
      setFormData({ 
        name: '', phone: '', specialty: '',
        dashboard_username: '', dashboard_password: '',
        app_username: '', app_password: ''
      });
    }
    setFormModalOpen(true);
  };

  // --- حفظ البيانات ---
  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const url = '/api/dashboard/super/teachers';
      const method = editingId ? 'PUT' : 'POST';
      const bodyData = editingId ? { ...formData, id: editingId } : formData;

      const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyData)
      });
      
      if (res.ok) {
          await fetchTeachers(); 
          setFormModalOpen(false);
      } else {
          const d = await res.json();
          alert('خطأ: ' + (d.error || 'فشل الحفظ'));
      }
    } catch (error) { alert("حدث خطأ أثناء الحفظ"); }
  };

  // --- دوال الحذف الأنيقة ---
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
        } else {
            alert("فشل الحذف");
        }
    } catch (err) { alert("خطأ في الاتصال"); }
  };

  // --- الدخول كـ مدرس ---
  const handleLoginAs = async (username) => {
    if (!username || !confirm(`الدخول كـ ${username}؟`)) return;
    try {
        const res = await fetch('/api/auth/super-login-as', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        if (res.ok) window.open('/admin', '_blank');
        else alert('فشل الدخول');
    } catch (err) { console.error(err); }
  };

  const filteredTeachers = teachers.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.dashboard_username?.includes(searchQuery) ||
    t.phone?.includes(searchQuery)
  );

  return (
    <SuperLayout>
      <Head><title>إدارة المدرسين</title></Head>

      <div className="page-container">
        {/* الشريط العلوي */}
        <div className="top-bar">
          <div>
            <h1>👨‍🏫 إدارة المدرسين</h1>
            <p>إدارة الحسابات الشاملة (التطبيق ولوحة التحكم) ومتابعة الإحصائيات.</p>
          </div>
          <button className="btn-primary" onClick={() => handleOpenForm()}>
            {Icons.add} مدرس جديد
          </button>
        </div>

        {/* البحث */}
        <div className="search-bar">
          <div className="search-input">
            {Icons.search}
            <input type="text" placeholder="بحث بالاسم، الهاتف، أو اسم المستخدم..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>

        {/* الجدول */}
        <div className="table-wrapper">
          {loading ? <div className="loading">جاري التحميل...</div> : (
            <table>
              <thead>
                <tr>
                  <th>المدرس</th>
                  <th>بيانات الدخول (Dash / App)</th>
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
                        <div className="avatar">{t.name ? t.name[0] : '?'}</div>
                        <span className="name">{t.name}</span>
                      </div>
                    </td>
                    <td>
                        <div className="credentials-cell">
                            <div className="cred-row">
                                <span className="lbl">Dash:</span>
                                <span className="val highlight" dir="ltr">@{t.dashboard_username}</span>
                            </div>
                            <div className="cred-row">
                                <span className="lbl">App:</span>
                                <span className="val" dir="ltr">@{t.app_username}</span>
                            </div>
                        </div>
                    </td>
                    <td><span className="badge">{t.specialty}</span></td>
                    <td dir="ltr" style={{color:'#cbd5e1', fontSize:'0.9rem'}}>{t.phone || '-'}</td>
                    <td>
                      <div className="actions">
                        <button className="btn-icon view" onClick={() => handleViewStats(t)} title="الإحصائيات">{Icons.eye}</button>
                        <button className="btn-icon edit" onClick={() => handleOpenForm(t)} title="تعديل">{Icons.edit}</button>
                        <button className="btn-icon login" onClick={() => handleLoginAs(t.dashboard_username)} title="دخول للوحة" disabled={!t.dashboard_username}>{Icons.key}</button>
                        <button className="btn-icon delete" onClick={() => confirmDelete(t)} title="حذف">{Icons.trash}</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredTeachers.length === 0 && (
                    <tr><td colSpan="5" style={{textAlign:'center', padding:'40px', color:'#94a3b8'}}>لا يوجد نتائج.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* --- مودال الإضافة / التعديل (المقسم) --- */}
      {formModalOpen && (
        <div className="modal-overlay">
          <div className="modal form-modal">
            <div className="modal-header">
              <h3>{editingId ? 'تعديل بيانات مدرس' : 'إضافة مدرس جديد'}</h3>
              <button onClick={() => setFormModalOpen(false)}>{Icons.close}</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-section">
                <h4>1. البيانات الشخصية</h4>
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
                        <label>الهاتف</label>
                        <input type="text" required dir="ltr" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}/>
                    </div>
                </div>
              </div>

              <div className="form-section">
                <h4>2. بيانات دخول لوحة التحكم (للمدرس)</h4>
                <div className="form-row">
                    <div className="form-group">
                        <label>اسم المستخدم</label>
                        <input type="text" required dir="ltr" className="input-dash" value={formData.dashboard_username} onChange={e => setFormData({...formData, dashboard_username: e.target.value})}/>
                    </div>
                    <div className="form-group">
                        <label>كلمة المرور {editingId && '(اختياري)'}</label>
                        <input type="password" dir="ltr" className="input-dash" value={formData.dashboard_password} onChange={e => setFormData({...formData, dashboard_password: e.target.value})} placeholder={editingId ? "اتركها فارغة لعدم التغيير" : "******"}/>
                    </div>
                </div>
              </div>

              <div className="form-section">
                <h4>3. بيانات دخول التطبيق (للطلاب)</h4>
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

      {/* --- مودال الحذف الأنيق --- */}
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

      {/* --- مودال الإحصائيات --- */}
      {statsModalOpen && selectedStats && (
        <div className="modal-overlay">
          <div className="modal stats-modal">
            <div className="modal-header">
              <h3>📊 إحصائيات: {selectedStats.name}</h3>
              <button onClick={() => setStatsModalOpen(false)}>{Icons.close}</button>
            </div>
            {loadingStats ? <div className="loading">جاري الحساب...</div> : (
               <div className="stats-grid-modal">
                 <div className="stat-box blue"><h4>👨‍🎓 طلاب</h4><span className="val">{selectedStats.students_count || 0}</span></div>
                 <div className="stat-box green"><h4>💰 أرباح</h4><span className="val">{(selectedStats.balance || 0).toLocaleString()}</span></div>
                 <div className="stat-box yellow"><h4>⏳ طلبات</h4><span className="val">{selectedStats.pending_requests || 0}</span></div>
                 <div className="stat-box purple"><h4>📚 كورسات</h4><span className="val">{selectedStats.courses_count || 0}</span></div>
               </div>
            )}
            <div className="modal-actions"><button className="btn-cancel full" onClick={() => setStatsModalOpen(false)}>إغلاق</button></div>
          </div>
        </div>
      )}

      <style jsx>{`
        /* تنسيقات عامة */
        .page-container { padding-bottom: 50px; }
        .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; border-bottom: 1px solid #334155; padding-bottom: 20px; }
        .top-bar h1 { margin: 0 0 5px 0; color: #f8fafc; font-size: 1.6rem; }
        .top-bar p { margin: 0; color: #94a3b8; font-size: 0.95rem; }
        
        .btn-primary { background: #38bdf8; color: #0f172a; padding: 10px 20px; border-radius: 8px; border: none; font-weight: bold; cursor: pointer; display: flex; gap: 8px; align-items: center; transition: 0.2s; }
        .btn-primary:hover { background: #0ea5e9; }

        .search-bar { margin-bottom: 20px; }
        .search-input { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 12px 15px; display: flex; align-items: center; gap: 10px; color: #94a3b8; }
        .search-input input { background: transparent; border: none; color: white; font-size: 1rem; width: 100%; outline: none; }

        /* تنسيقات الجدول */
        .table-wrapper { background: #1e293b; border-radius: 16px; border: 1px solid #334155; overflow: hidden; }
        table { width: 100%; border-collapse: collapse; }
        thead { background: #0f172a; }
        th { text-align: right; padding: 15px 20px; color: #94a3b8; font-size: 0.9rem; font-weight: 600; border-bottom: 1px solid #334155; }
        td { padding: 15px 20px; border-bottom: 1px solid #334155; color: #e2e8f0; vertical-align: middle; }
        tr:last-child td { border-bottom: none; }
        tr:hover { background: #263345; }

        .user-info { display: flex; align-items: center; gap: 12px; }
        .avatar { width: 40px; height: 40px; background: #334155; color: #38bdf8; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.1rem; }
        .name { font-weight: bold; font-size: 0.95rem; }

        .credentials-cell { display: flex; flexDirection: column; gap: 5px; font-size: 0.85rem; }
        .cred-row { display: flex; gap: 8px; align-items: center; }
        .cred-row .lbl { color: #64748b; font-size: 0.75rem; width: 35px; }
        .cred-row .val { font-family: monospace; color: #cbd5e1; background: #0f172a; padding: 2px 6px; border-radius: 4px; }
        .cred-row .val.highlight { color: #38bdf8; }

        .badge { background: rgba(56, 189, 248, 0.1); color: #38bdf8; padding: 4px 10px; border-radius: 20px; font-size: 0.85rem; }
        
        .actions { display: flex; gap: 6px; justify-content: center; }
        .btn-icon { width: 34px; height: 34px; border-radius: 8px; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
        .view { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .edit { background: rgba(250, 204, 21, 0.1); color: #facc15; }
        .login { background: rgba(168, 85, 247, 0.1); color: #a855f7; }
        .delete { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .btn-icon:hover { transform: scale(1.1); filter: brightness(1.2); }

        /* تنسيقات المودال الأساسية */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(4px); }
        .modal { background: #1e293b; border: 1px solid #334155; width: 90%; border-radius: 16px; padding: 25px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); animation: popIn 0.2s ease-out; }
        .form-modal { max-width: 600px; max-height: 90vh; overflow-y: auto; }
        
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #334155; padding-bottom: 15px; }
        .modal-header h3 { margin: 0; color: white; font-size: 1.1rem; }
        .modal-header button { background: none; border: none; color: #94a3b8; cursor: pointer; }

        /* تنسيقات النموذج */
        .form-section { margin-bottom: 20px; border-bottom: 1px solid #334155; padding-bottom: 15px; }
        .form-section:last-child { border-bottom: none; }
        .form-section h4 { margin: 0 0 15px 0; color: #94a3b8; font-size: 0.9rem; font-weight: normal; text-transform: uppercase; letter-spacing: 0.5px; }
        
        .form-group { margin-bottom: 12px; }
        .form-row { display: flex; gap: 15px; }
        .form-row .form-group { flex: 1; }
        label { display: block; color: #cbd5e1; margin-bottom: 6px; font-size: 0.85rem; }
        input { width: 100%; background: #0f172a; border: 1px solid #334155; padding: 10px; border-radius: 8px; color: white; outline: none; transition: 0.2s; }
        input:focus { border-color: #38bdf8; }
        .input-dash { border-color: rgba(168, 85, 247, 0.3); }
        .input-dash:focus { border-color: #a855f7; }
        .input-app { border-color: rgba(56, 189, 248, 0.3); }
        .input-app:focus { border-color: #38bdf8; }

        .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; }
        .modal-actions.centered { justify-content: center; margin-top: 20px; }
        .btn-cancel { background: transparent; border: 1px solid #475569; color: #cbd5e1; padding: 8px 16px; border-radius: 8px; cursor: pointer; }
        .btn-submit { background: #22c55e; border: none; color: #0f172a; padding: 8px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; }
        .btn-danger { background: #ef4444; border: none; color: white; padding: 8px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; }

        /* تنسيقات مودال الحذف */
        .delete-modal { max-width: 400px; text-align: center; border: 1px solid #ef4444; }
        .delete-icon { background: rgba(239, 68, 68, 0.1); width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px auto; }
        .warning-text { color: #f87171; font-size: 0.85rem; background: rgba(239, 68, 68, 0.1); padding: 10px; border-radius: 8px; margin-top: 10px; }

        /* تنسيقات مودال الإحصائيات */
        .stats-grid-modal { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .stat-box { background: #0f172a; padding: 15px; border-radius: 12px; border: 1px solid #334155; text-align: center; }
        .stat-box h4 { margin: 0 0 5px 0; color: #94a3b8; font-size: 0.85rem; font-weight: normal; }
        .stat-box .val { font-size: 1.5rem; font-weight: bold; display: block; }
        .blue .val { color: #38bdf8; } .green .val { color: #4ade80; }
        .yellow .val { color: #facc15; } .purple .val { color: #c084fc; }
        .full { width: 100%; }
        
        @keyframes popIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        
        @media (max-width: 768px) {
            .form-row { flex-direction: column; gap: 0; }
            td, th { padding: 12px 10px; font-size: 0.85rem; }
            .top-bar { flex-direction: column; align-items: flex-start; gap: 15px; }
            .btn-primary { width: 100%; justify-content: center; }
        }
      `}</style>
    </SuperLayout>
  );
}
