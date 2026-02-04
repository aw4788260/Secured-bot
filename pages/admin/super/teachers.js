import Head from 'next/head';
import { useState, useEffect } from 'react';
import SuperLayout from '../../../components/SuperLayout';

const Icons = {
  add: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
  search: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  edit: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>,
  trash: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
  close: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
  eye: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>,
  key: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>
};

export default function SuperTeachers() {
  // الحالة الأساسية للقائمة
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // حالة مودال الإضافة/التعديل
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '', username: '', password: '', specialty: '', phone: ''
  });

  // حالة مودال الإحصائيات (التفاصيل)
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [selectedStats, setSelectedStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // --- جلب القائمة الرئيسية (خفيفة وسريعة) ---
  const fetchTeachers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/super/teachers'); 
      if (res.ok) {
        const data = await res.json();
        setTeachers(data);
      } else {
        console.error("فشل جلب المدرسين:", res.status);
      }
    } catch (error) {
      console.error("خطأ في الاتصال:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  // --- جلب وعرض الإحصائيات لمدرس واحد ---
  const handleViewStats = async (teacher) => {
    setStatsModalOpen(true);
    setLoadingStats(true);
    // عرض البيانات الأساسية فوراً حتى تكتمل البيانات الإحصائية
    setSelectedStats({ ...teacher }); 

    try {
      const res = await fetch(`/api/dashboard/super/teacher-stats?id=${teacher.id}`);
      if (res.ok) {
        const stats = await res.json();
        // دمج الإحصائيات مع البيانات الأساسية
        setSelectedStats(prev => ({ ...prev, ...stats }));
      } else {
        alert("فشل جلب التفاصيل الإحصائية");
      }
    } catch (err) {
      console.error(err);
      alert("حدث خطأ في الاتصال");
    } finally {
      setLoadingStats(false);
    }
  };

  // --- إدارة الدخول كمدرس ---
  const handleLoginAs = async (username) => {
    if (!username) return alert('خطأ: لا يوجد اسم مستخدم لهذا الحساب');
    if (!confirm(`⚠️ تحذير أمني:\nهل أنت متأكد من رغبتك في الدخول إلى لوحة التحكم الخاصة بالمدرس (${username})؟`)) return;

    try {
        const res = await fetch('/api/auth/super-login-as', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });

        if (res.ok) {
            window.open('/admin', '_blank');
        } else {
            alert('فشل الدخول، تأكد من صحة البيانات.');
        }
    } catch (err) {
        console.error(err);
        alert('حدث خطأ في الاتصال بالسيرفر');
    }
  };

  // --- فتح مودال الإضافة/التعديل ---
  const handleOpenForm = (teacher = null) => {
    if (teacher) {
      setEditingId(teacher.id);
      setFormData({ 
        name: teacher.name, 
        username: teacher.username || '', 
        password: '', // كلمة المرور فارغة عند التعديل
        specialty: teacher.specialty || '', 
        phone: teacher.phone || '' 
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', username: '', password: '', specialty: '', phone: '' });
    }
    setFormModalOpen(true);
  };

  // --- حفظ البيانات (POST/PUT) ---
  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const url = '/api/dashboard/super/teachers';
      const method = editingId ? 'PUT' : 'POST';
      const bodyData = editingId ? { ...formData, id: editingId } : formData;

      const res = await fetch(url, {
          method: method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyData)
      });
      
      if (res.ok) {
          await fetchTeachers(); 
          setFormModalOpen(false);
      } else {
          const errorData = await res.json();
          alert('فشل الحفظ: ' + (errorData.error || 'خطأ غير معروف'));
      }
    } catch (error) {
        console.error("Save error:", error);
        alert("حدث خطأ أثناء الحفظ");
    }
  };

  // --- الحذف ---
  const handleDelete = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا المدرس؟\nسيتم حذف حساب الدخول الخاص به وكافة بياناته.')) return;
    
    try {
        const res = await fetch(`/api/dashboard/super/teachers?id=${id}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            setTeachers(prev => prev.filter(t => t.id !== id));
        } else {
            const data = await res.json();
            alert("فشل الحذف: " + (data.error || 'خطأ'));
        }
    } catch (err) {
        console.error(err);
        alert("حدث خطأ أثناء الاتصال");
    }
  };

  const filteredTeachers = teachers.filter(t => 
    (t.name && t.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (t.specialty && t.specialty.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (t.phone && t.phone.includes(searchQuery)) ||
    (t.username && t.username.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <SuperLayout>
      <Head>
        <title>إدارة المدرسين | Super Admin</title>
      </Head>

      <div className="page-container">
        {/* Header */}
        <div className="top-bar">
          <div>
            <h1>👨‍🏫 إدارة المدرسين</h1>
            <p>إدارة بيانات المدرسين. (اضغط على أيقونة العين 👁️ لعرض الإحصائيات المالية والطلاب)</p>
          </div>
          <button className="btn-primary" onClick={() => handleOpenForm()}>
            {Icons.add} إضافة مدرس جديد
          </button>
        </div>

        {/* Search Bar */}
        <div className="search-bar">
          <div className="search-input">
            {Icons.search}
            <input 
              type="text" 
              placeholder="بحث بالاسم، اسم المستخدم، التخصص، أو الهاتف..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Teachers Table */}
        <div className="table-wrapper">
          {loading ? (
            <div className="loading">جاري التحميل...</div>
          ) : (
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
                {filteredTeachers.map(teacher => (
                  <tr key={teacher.id}>
                    <td>
                      <div className="user-info">
                        <div className="avatar">{teacher.name ? teacher.name[0] : '?'}</div>
                        <span className="name">{teacher.name}</span>
                      </div>
                    </td>
                    <td>
                        <span className="username-badge" dir="ltr">@{teacher.username}</span>
                    </td>
                    <td><span className="badge">{teacher.specialty}</span></td>
                    <td>
                        <span style={{fontSize:'0.9rem', color:'#cbd5e1'}} dir="ltr">{teacher.phone || '-'}</span>
                    </td>
                    <td>
                      <div className="actions">
                        {/* زر عرض الإحصائيات (جديد) */}
                        <button 
                            className="btn-icon view" 
                            onClick={() => handleViewStats(teacher)} 
                            title="عرض الإحصائيات والتفاصيل"
                        >
                          {Icons.eye}
                        </button>

                        <button 
                            className="btn-icon edit" 
                            onClick={() => handleOpenForm(teacher)} 
                            title="تعديل البيانات"
                        >
                          {Icons.edit}
                        </button>

                        <button 
                            className="btn-icon login" 
                            onClick={() => handleLoginAs(teacher.username)} 
                            title="الدخول إلى لوحته"
                            disabled={!teacher.username}
                        >
                          {Icons.key}
                        </button>
                        
                        <button 
                            className="btn-icon delete" 
                            onClick={() => handleDelete(teacher.id)} 
                            title="حذف المدرس"
                        >
                          {Icons.trash}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredTeachers.length === 0 && (
                    <tr>
                        <td colSpan="5" style={{textAlign:'center', padding:'40px', color:'#94a3b8'}}>
                            لا يوجد نتائج مطابقة.
                        </td>
                    </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* --- مودال الإضافة / التعديل --- */}
      {formModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{editingId ? 'تعديل بيانات مدرس' : 'إضافة مدرس جديد'}</h3>
              <button onClick={() => setFormModalOpen(false)}>{Icons.close}</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label>الاسم بالكامل</label>
                <input 
                  type="text" 
                  required 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="مثال: أ. محمد أحمد"
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                    <label>اسم المستخدم (للدخول)</label>
                    <input 
                    type="text" 
                    required 
                    dir="ltr"
                    value={formData.username}
                    onChange={e => setFormData({...formData, username: e.target.value})}
                    />
                </div>
                <div className="form-group">
                    <label>كلمة المرور {editingId && '(اختياري)'}</label>
                    <input 
                    type="password" 
                    dir="ltr"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    placeholder={editingId ? "اتركها لعدم التغيير" : ""}
                    />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                    <label>التخصص / المادة</label>
                    <input 
                    type="text" 
                    required 
                    value={formData.specialty}
                    onChange={e => setFormData({...formData, specialty: e.target.value})}
                    placeholder="فيزياء، رياضيات..."
                    />
                </div>
                <div className="form-group">
                    <label>رقم الهاتف</label>
                    <input 
                    type="text" 
                    required 
                    dir="ltr"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    />
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

      {/* --- مودال عرض الإحصائيات (التفاصيل) --- */}
      {statsModalOpen && selectedStats && (
        <div className="modal-overlay">
          <div className="modal stats-modal">
            <div className="modal-header">
              <h3>📊 تفاصيل المدرس: {selectedStats.name}</h3>
              <button onClick={() => setStatsModalOpen(false)}>{Icons.close}</button>
            </div>
            
            {loadingStats ? (
                <div className="loading">جاري جلب الإحصائيات وحساب الأرباح...</div>
            ) : (
                <div className="stats-grid-modal">
                    <div className="stat-box blue">
                        <h4>👨‍🎓 الطلاب النشطين</h4>
                        <span className="val">{selectedStats.students_count || 0}</span>
                        <span className="sub">طالب فريد</span>
                    </div>

                    <div className="stat-box green">
                        <h4>💰 إجمالي الأرباح</h4>
                        <span className="val">{(selectedStats.balance || 0).toLocaleString()}</span>
                        <span className="sub">ج.م (طلبات مقبولة)</span>
                    </div>

                    <div className="stat-box yellow">
                        <h4>⏳ طلبات معلقة</h4>
                        <span className="val">{selectedStats.pending_requests || 0}</span>
                        <span className="sub">تحتاج مراجعة</span>
                    </div>

                    <div className="stat-box purple">
                        <h4>📚 المحتوى</h4>
                        <span className="val">{selectedStats.courses_count || 0}</span>
                        <span className="sub">كورس مرفوع</span>
                    </div>
                </div>
            )}
            
            <div className="modal-actions" style={{marginTop:'25px'}}>
                <button className="btn-cancel" onClick={() => setStatsModalOpen(false)} style={{width:'100%'}}>إغلاق</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .page-container { padding-bottom: 50px; }
        
        .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; border-bottom: 1px solid #334155; padding-bottom: 20px; }
        .top-bar h1 { margin: 0 0 5px 0; color: #f8fafc; font-size: 1.6rem; }
        .top-bar p { margin: 0; color: #94a3b8; font-size: 0.95rem; }

        .btn-primary { background: #38bdf8; color: #0f172a; padding: 10px 20px; border-radius: 8px; border: none; font-weight: bold; cursor: pointer; display: flex; gap: 8px; align-items: center; transition: 0.2s; }
        .btn-primary:hover { background: #0ea5e9; }

        .search-bar { margin-bottom: 20px; }
        .search-input { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 12px 15px; display: flex; align-items: center; gap: 10px; color: #94a3b8; }
        .search-input input { background: transparent; border: none; color: white; font-size: 1rem; width: 100%; outline: none; }

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
        .username-badge { font-family: monospace; background: #0f172a; padding: 4px 8px; border-radius: 6px; color: #94a3b8; font-size: 0.85rem; }

        .badge { background: rgba(56, 189, 248, 0.1); color: #38bdf8; padding: 4px 10px; border-radius: 20px; font-size: 0.85rem; }

        .actions { display: flex; gap: 8px; justify-content: center; }
        .btn-icon { width: 34px; height: 34px; border-radius: 8px; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
        .btn-icon:disabled { opacity: 0.5; cursor: not-allowed; }
        
        .btn-icon.view { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .btn-icon.view:hover { background: rgba(59, 130, 246, 0.2); transform: scale(1.05); }

        .btn-icon.login { background: rgba(168, 85, 247, 0.1); color: #a855f7; }
        .btn-icon.login:hover:not(:disabled) { background: rgba(168, 85, 247, 0.2); transform: scale(1.05); }

        .btn-icon.edit { background: rgba(250, 204, 21, 0.1); color: #facc15; }
        .btn-icon.edit:hover { background: rgba(250, 204, 21, 0.2); transform: scale(1.05); }
        
        .btn-icon.delete { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .btn-icon.delete:hover { background: rgba(239, 68, 68, 0.2); transform: scale(1.05); }

        .loading { text-align: center; padding: 40px; color: #38bdf8; }

        /* Modal Styles */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(4px); }
        .modal { background: #1e293b; border: 1px solid #334155; width: 90%; max-width: 550px; border-radius: 16px; padding: 25px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); animation: popIn 0.2s ease-out; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #334155; padding-bottom: 15px; }
        .modal-header h3 { margin: 0; color: white; font-size: 1.1rem; }
        .modal-header button { background: none; border: none; color: #94a3b8; cursor: pointer; }
        
        .form-group { margin-bottom: 15px; }
        .form-row { display: flex; gap: 15px; }
        .form-row .form-group { flex: 1; }
        label { display: block; color: #cbd5e1; margin-bottom: 8px; font-size: 0.9rem; }
        input { width: 100%; background: #0f172a; border: 1px solid #334155; padding: 10px; border-radius: 8px; color: white; outline: none; transition: 0.2s; }
        input:focus { border-color: #38bdf8; }

        .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
        .btn-cancel { background: transparent; border: 1px solid #475569; color: #cbd5e1; padding: 8px 16px; border-radius: 8px; cursor: pointer; transition: 0.2s; }
        .btn-cancel:hover { background: #334155; }
        .btn-submit { background: #22c55e; border: none; color: #0f172a; padding: 8px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s; }
        .btn-submit:hover { background: #16a34a; }

        /* Stats Modal Specifics */
        .stats-grid-modal { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .stat-box { background: #0f172a; padding: 15px; border-radius: 12px; border: 1px solid #334155; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .stat-box h4 { margin: 0 0 5px 0; color: #94a3b8; font-size: 0.85rem; font-weight: normal; }
        .stat-box .val { font-size: 1.5rem; font-weight: bold; margin-bottom: 2px; }
        .stat-box .sub { font-size: 0.7rem; color: #64748b; }
        
        .stat-box.blue .val { color: #38bdf8; }
        .stat-box.green .val { color: #4ade80; }
        .stat-box.yellow .val { color: #facc15; }
        .stat-box.purple .val { color: #c084fc; }

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
