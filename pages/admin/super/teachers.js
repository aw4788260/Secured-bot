import Head from 'next/head';
import { useState, useEffect } from 'react';
import AdminLayout from '../../../components/AdminLayout';

const Icons = {
  add: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
  search: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  edit: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>,
  trash: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
  close: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
  wallet: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
};

export default function SuperTeachers() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    username: '', // Login username
    password: '',
    specialty: '', // e.g. Physics
    phone: ''
  });

  // Fetch Teachers
  const fetchTeachers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/super/teachers'); // Ensure this API exists
      if (res.ok) {
        const data = await res.json();
        setTeachers(data);
      } else {
        // Fallback Mock Data for UI Testing
        setTeachers([
          { id: 1, name: 'أ. محمد أحمد', username: 'mohamed_phy', specialty: 'فيزياء', students: 120, balance: 5400, phone: '01000000001' },
          { id: 2, name: 'د. سارة علي', username: 'sara_bio', specialty: 'أحياء', students: 85, balance: 3200, phone: '01200000002' },
          { id: 3, name: 'أ. محمود حسن', username: 'mahmoud_ar', specialty: 'لغة عربية', students: 200, balance: 8900, phone: '01100000003' },
        ]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  // Handlers
  const handleOpenModal = (teacher = null) => {
    if (teacher) {
      setEditingId(teacher.id);
      setFormData({ 
        name: teacher.name, 
        username: teacher.username, 
        password: '', // Don't show old password
        specialty: teacher.specialty, 
        phone: teacher.phone 
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', username: '', password: '', specialty: '', phone: '' });
    }
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    // Simulate API Call
    console.log('Saving:', formData);
    
    // Refresh List (Mock)
    if (!editingId) {
        setTeachers([...teachers, { ...formData, id: Date.now(), students: 0, balance: 0 }]);
    } else {
        setTeachers(teachers.map(t => t.id === editingId ? { ...t, ...formData } : t));
    }
    
    setModalOpen(false);
  };

  const handleDelete = async (id) => {
    if (confirm('هل أنت متأكد من حذف هذا المدرس؟ سيتم حذف جميع الكورسات المرتبطة به.')) {
        // API Call here
        setTeachers(teachers.filter(t => t.id !== id));
    }
  };

  // Filter Logic
  const filteredTeachers = teachers.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.specialty.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.phone.includes(searchQuery)
  );

  return (
    <AdminLayout>
      <Head>
        <title>إدارة المدرسين | Super Admin</title>
      </Head>

      <div className="page-container">
        {/* Header */}
        <div className="top-bar">
          <div>
            <h1>👨‍🏫 إدارة المدرسين</h1>
            <p>إضافة وتعديل بيانات المدرسين ومتابعة أرصدتهم.</p>
          </div>
          <button className="btn-primary" onClick={() => handleOpenModal()}>
            {Icons.add} إضافة مدرس جديد
          </button>
        </div>

        {/* Search Bar */}
        <div className="search-bar">
          <div className="search-input">
            {Icons.search}
            <input 
              type="text" 
              placeholder="بحث بالاسم، التخصص، أو الهاتف..." 
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
                  <th>التخصص</th>
                  <th>الهاتف / الدخول</th>
                  <th>عدد الطلاب</th>
                  <th>الرصيد الحالي</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.map(teacher => (
                  <tr key={teacher.id}>
                    <td>
                      <div className="user-info">
                        <div className="avatar">{teacher.name[0]}</div>
                        <span className="name">{teacher.name}</span>
                      </div>
                    </td>
                    <td><span className="badge">{teacher.specialty}</span></td>
                    <td>
                        <div style={{display:'flex', flexDirection:'column', fontSize:'0.85rem'}}>
                            <span>📞 {teacher.phone}</span>
                            <span style={{color:'#64748b'}}>@{teacher.username}</span>
                        </div>
                    </td>
                    <td style={{textAlign:'center'}}>{teacher.students}</td>
                    <td>
                        <div className="balance">
                            {Icons.wallet}
                            {teacher.balance.toLocaleString()} ج.م
                        </div>
                    </td>
                    <td>
                      <div className="actions">
                        <button className="btn-icon edit" onClick={() => handleOpenModal(teacher)} title="تعديل">
                          {Icons.edit}
                        </button>
                        <button className="btn-icon delete" onClick={() => handleDelete(teacher.id)} title="حذف">
                          {Icons.trash}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredTeachers.length === 0 && (
                    <tr>
                        <td colSpan="6" style={{textAlign:'center', padding:'40px', color:'#94a3b8'}}>
                            لا يوجد مدرسين مطابقين للبحث.
                        </td>
                    </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{editingId ? 'تعديل بيانات مدرس' : 'إضافة مدرس جديد'}</h3>
              <button onClick={() => setModalOpen(false)}>{Icons.close}</button>
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
                    <label>المادة / التخصص</label>
                    <input 
                    type="text" 
                    required 
                    value={formData.specialty}
                    onChange={e => setFormData({...formData, specialty: e.target.value})}
                    placeholder="فيزياء، كيمياء..."
                    />
                </div>
              </div>

              <div className="form-row">
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
                <div className="form-group">
                    <label>كلمة المرور {editingId && '(اتركها فارغة لعدم التغيير)'}</label>
                    <input 
                    type="password" 
                    dir="ltr"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setModalOpen(false)}>إلغاء</button>
                <button type="submit" className="btn-submit">حفظ البيانات</button>
              </div>
            </form>
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
        tr:hover { background: #1e293b; }

        .user-info { display: flex; align-items: center; gap: 12px; }
        .avatar { width: 40px; height: 40px; background: #334155; color: #38bdf8; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.1rem; }
        .name { font-weight: bold; }

        .badge { background: rgba(56, 189, 248, 0.1); color: #38bdf8; padding: 4px 10px; border-radius: 20px; font-size: 0.85rem; }
        .balance { color: #22c55e; font-weight: bold; display: flex; align-items: center; gap: 5px; }

        .actions { display: flex; gap: 8px; }
        .btn-icon { width: 32px; height: 32px; border-radius: 8px; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
        .btn-icon.edit { background: rgba(250, 204, 21, 0.1); color: #facc15; }
        .btn-icon.edit:hover { background: rgba(250, 204, 21, 0.2); }
        .btn-icon.delete { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .btn-icon.delete:hover { background: rgba(239, 68, 68, 0.2); }

        .loading { text-align: center; padding: 40px; color: #38bdf8; }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(4px); }
        .modal { background: #1e293b; border: 1px solid #334155; width: 90%; max-width: 500px; border-radius: 16px; padding: 25px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); animation: popIn 0.2s ease-out; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #334155; padding-bottom: 15px; }
        .modal-header h3 { margin: 0; color: white; }
        .modal-header button { background: none; border: none; color: #94a3b8; cursor: pointer; }
        
        .form-group { margin-bottom: 15px; }
        .form-row { display: flex; gap: 15px; }
        .form-row .form-group { flex: 1; }
        label { display: block; color: #cbd5e1; margin-bottom: 8px; font-size: 0.9rem; }
        input { width: 100%; background: #0f172a; border: 1px solid #334155; padding: 10px; border-radius: 8px; color: white; outline: none; transition: 0.2s; }
        input:focus { border-color: #38bdf8; }

        .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
        .btn-cancel { background: transparent; border: 1px solid #475569; color: #cbd5e1; padding: 8px 16px; border-radius: 8px; cursor: pointer; }
        .btn-submit { background: #22c55e; border: none; color: #0f172a; padding: 8px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; }

        @keyframes popIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        
        @media (max-width: 768px) {
            .form-row { flex-direction: column; gap: 0; }
            td, th { padding: 10px; font-size: 0.85rem; }
            .top-bar { flex-direction: column; align-items: flex-start; gap: 15px; }
            .btn-primary { width: 100%; justify-content: center; }
        }
      `}</style>
    </AdminLayout>
  );
}
