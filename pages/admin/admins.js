import AdminLayout from '../../components/AdminLayout';
import { useState, useEffect } from 'react';

export default function AdminsPage() {
  const [admins, setAdmins] = useState([]);
  const [isMainAdmin, setIsMainAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showWebModal, setShowWebModal] = useState(false);
  const [targetAdmin, setTargetAdmin] = useState(null);
  
  const [promptData, setPromptData] = useState({ show: false, title: '', placeholder: '', onSubmit: null });
  const [confirmData, setConfirmData] = useState({ show: false, message: '', onConfirm: null });
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  const showToast = (msg, type='success') => {
      setToast({ show: true, message: msg, type });
      setTimeout(() => setToast({ show:false, message:'', type:'' }), 3000);
  };
  const showPrompt = (title, ph, cb) => setPromptData({ show: true, title, placeholder: ph, onSubmit: cb });
  const showConfirm = (msg, cb) => setConfirmData({ show: true, message: msg, onConfirm: cb });

  const fetchData = async () => {
      setLoading(true);
      try {
          const res = await fetch('/api/admin/admins');
          const data = await res.json();
          if (res.ok) {
              setAdmins(data.admins);
              setIsMainAdmin(data.isCurrentUserMain);
          } else {
              showToast(data.error, 'error');
          }
      } catch (e) { showToast('خطأ اتصال', 'error'); }
      setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleAction = async (action, payload) => {
      try {
          const res = await fetch('/api/admin/admins', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action, ...payload })
          });
          const data = await res.json();
          if (res.ok) {
              showToast(data.message);
              fetchData();
              return true;
          } else {
              showToast(data.error, 'error');
              return false;
          }
      } catch (e) { showToast('خطأ اتصال', 'error'); }
  };

  // Handlers
  const handlePromote = () => {
      showPrompt('أدخل اسم المستخدم (Username) للمشرف الجديد:', 'مثال: ahmed_student', (val) => {
          if (!val) return;
          handleAction('promote', { username: val.trim() });
      });
  };

  const handleDemote = (admin) => {
      showConfirm(`هل أنت متأكد من حذف المشرف ${admin.first_name}؟\n(سيتم سحب صلاحياته فوراً)`, () => {
          handleAction('demote', { userId: admin.id });
      });
  };

  const openWebModal = (admin) => {
      setTargetAdmin(admin);
      setShowWebModal(true);
  };

  const submitWebAccess = async (e) => {
      e.preventDefault();
      const username = e.target.username.value;
      const password = e.target.password.value;
      
      const success = await handleAction('set_web_access', { userId: targetAdmin.id, webData: { username, password } });
      if (success) setShowWebModal(false);
  };

  return (
    <AdminLayout title="إدارة المشرفين">
      <div className={`toast ${toast.show ? 'show' : ''} ${toast.type}`}>{toast.message}</div>

      <div className="page-header">
          <div>
            <h1>👮 إدارة فريق العمل</h1>
            <p className="sub-head">التحكم في صلاحيات الوصول للوحة والطلاب</p>
          </div>
          {isMainAdmin && (
              <button onClick={handlePromote} className="add-btn">➕ إضافة مشرف جديد</button>
          )}
      </div>

      <div className="table-box">
          <table className="admin-table">
              <thead>
                  <tr>
                      <th style={{width:'60px'}}>ID</th>
                      <th>الاسم</th>
                      <th>يوزر الكورس (طالب)</th>
                      <th>يوزر اللوحة (أدمن)</th>
                      <th style={{textAlign:'center'}}>الهاتف</th>
                      <th>الصلاحية</th>
                      <th style={{minWidth:'280px'}}>الإجراءات</th>
                  </tr>
              </thead>
              <tbody>
                  {admins.map(admin => (
                      <tr key={admin.id} className={admin.is_main ? 'main-admin-row' : ''}>
                          <td style={{fontFamily:'monospace', color:'#94a3b8'}}>{admin.id}</td>
                          <td style={{fontWeight:'bold'}}>{admin.first_name || 'بدون اسم'}</td>
                          
                          <td><span className="user-tag student">@{admin.username}</span></td>

                          <td>
                              {admin.has_web_access ? (
                                  <span className="user-tag admin">{admin.admin_username}</span>
                              ) : (
                                  <span className="user-tag inactive">غير مفعل</span>
                              )}
                          </td>
                          
                          <td style={{textAlign:'center', direction:'ltr', fontFamily:'monospace', color:'#e2e8f0'}}>{admin.phone}</td>
                          
                          <td>
                              {admin.is_main ? <span className="role-badge main">👑 المالك</span> : <span className="role-badge sub">مشرف</span>}
                          </td>
                          
                          <td>
                              {isMainAdmin && (
                                  <div className="actions">
                                      <button onClick={() => openWebModal(admin)} className="text-btn blue">
                                          تغيير دخول اللوحة 🔑
                                      </button>
                                      
                                      {!admin.is_main && (
                                          <button onClick={() => handleDemote(admin)} className="text-btn red">
                                              حذف المشرف 🗑️
                                          </button>
                                      )}
                                  </div>
                              )}
                          </td>
                      </tr>
                  ))}
                  {admins.length === 0 && !loading && <tr><td colSpan="7" style={{textAlign:'center', padding:'20px'}}>لا يوجد مشرفين</td></tr>}
              </tbody>
          </table>
      </div>

      {/* --- Web Access Modal --- */}
      {showWebModal && (
          <div className="modal-overlay" onClick={() => setShowWebModal(false)}>
              <div className="modal-box" onClick={e => e.stopPropagation()}>
                  <h3>🌐 بيانات دخول اللوحة: {targetAdmin?.first_name}</h3>
                  <p className="hint">قم بتعيين اسم المستخدم وكلمة المرور الخاصة بدخول لوحة التحكم فقط.</p>
                  
                  <form onSubmit={submitWebAccess}>
                      <label>اسم المستخدم (Panel User):</label>
                      <input name="username" defaultValue={targetAdmin?.admin_username || ''} required placeholder="username" />
                      
                      <label>كلمة المرور الجديدة (Pass):</label>
                      <input name="password" type="password" required placeholder="******" />
                      
                      <div className="modal-actions">
                          <button type="button" className="cancel" onClick={() => setShowWebModal(false)}>إلغاء</button>
                          <button type="submit" className="save">حفظ البيانات ✅</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* --- Alerts --- */}
      {promptData.show && <div className="modal-overlay alert"><div className="modal-box small"><h3>{promptData.title}</h3><input id="pIn" autoFocus className="prompt-in" placeholder={promptData.placeholder} /><div className="modal-actions"><button type="button" className="cancel" onClick={()=>setPromptData({...promptData,show:false})}>إلغاء</button><button onClick={()=>{promptData.onSubmit(document.getElementById('pIn').value); setPromptData({...promptData,show:false})}} className="save">موافق</button></div></div></div>}
      {confirmData.show && <div className="modal-overlay alert"><div className="modal-box small"><h3>تأكيد</h3><p>{confirmData.message}</p><div className="modal-actions"><button type="button" className="cancel" onClick={()=>setConfirmData({...confirmData,show:false})}>إلغاء</button><button onClick={()=>{confirmData.onConfirm(); setConfirmData({...confirmData,show:false})}} className="save red">نعم، متأكد</button></div></div></div>}

      <style jsx>{`
        /* التنسيقات الأساسية */
        .toast { position: fixed; top: 20px; right: 20px; padding: 15px 25px; border-radius: 8px; color: white; font-weight: bold; transform: translateX(150%); transition: transform 0.3s; z-index: 9999; box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
        .toast.show { transform: translateX(0); } .toast.success { background: #22c55e; } .toast.error { background: #ef4444; }

        .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
        .page-header h1 { margin: 0; color: #38bdf8; font-size: 1.8em; }
        .sub-head { margin: 5px 0 0 0; color: #94a3b8; font-size: 0.9em; }
        .add-btn { background: #38bdf8; color: #0f172a; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s; }
        .add-btn:hover { background: #7dd3fc; transform: translateY(-2px); }

        .table-box { background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow-x: auto; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
        .admin-table { width: 100%; border-collapse: collapse; min-width: 900px; }
        .admin-table th { background: #0f172a; padding: 15px; color: #94a3b8; border-bottom: 1px solid #334155; text-align: right; white-space: nowrap; }
        .admin-table td { padding: 15px; border-bottom: 1px solid #334155; color: #e2e8f0; vertical-align: middle; }
        .admin-table tr:hover { background: rgba(255,255,255,0.03); }
        .main-admin-row { background: rgba(251, 191, 36, 0.05); }

        /* User Tags */
        .user-tag { padding: 4px 8px; border-radius: 4px; font-size: 0.85em; font-weight: 500; display: inline-block; font-family: monospace; }
        .user-tag.student { color: #38bdf8; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.2); }
        .user-tag.admin { color: #4ade80; background: rgba(74, 222, 128, 0.1); border: 1px solid rgba(74, 222, 128, 0.2); }
        .user-tag.inactive { color: #94a3b8; background: rgba(148, 163, 184, 0.1); border: 1px dashed #64748b; }

        .role-badge { padding: 4px 10px; border-radius: 20px; font-size: 0.85em; font-weight: bold; white-space: nowrap; }
        .role-badge.main { background: #fbbf24; color: #000; box-shadow: 0 0 10px rgba(251, 191, 36, 0.3); }
        .role-badge.sub { background: #334155; color: #cbd5e1; border: 1px solid #475569; }

        /* --- [التعديل الرئيسي هنا] حاوية الأزرار --- */
        .actions { 
            display: flex; 
            gap: 8px; 
            flex-wrap: nowrap; /* يمنع نزول الأزرار لسطر جديد */
            overflow-x: auto; /* يسمح بالتمرير إذا ضاق المكان */
            padding-bottom: 5px; /* مسافة لشريط التمرير */
            align-items: center;
        }
        
        /* تجميل شريط التمرير للأزرار */
        .actions::-webkit-scrollbar { height: 4px; }
        .actions::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        .actions::-webkit-scrollbar-track { background: transparent; }

        .text-btn { 
            padding: 8px 12px; 
            border-radius: 6px; 
            border: none; 
            cursor: pointer; 
            font-size: 0.85em; 
            font-weight: bold; 
            transition: 0.2s; 
            white-space: nowrap; /* يمنع تكسير النص داخل الزر */
            display: flex; 
            align-items: center;
            gap: 5px;
        }
        .text-btn.blue { background: #3b82f6; color: white; } .text-btn.blue:hover { background: #2563eb; }
        .text-btn.red { background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.5); } .text-btn.red:hover { background: #ef4444; color: white; }

        /* Modals */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); z-index: 200; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(3px); }
        .modal-box { background: #1e293b; width: 90%; max-width: 500px; padding: 25px; border-radius: 16px; border: 1px solid #475569; box-shadow: 0 20px 50px rgba(0,0,0,0.5); animation: popIn 0.3s; }
        .modal-box.small { max-width: 400px; }
        .modal-box h3 { margin-top: 0; color: #38bdf8; margin-bottom: 10px; }
        .hint { color: #94a3b8; font-size: 0.9em; margin-bottom: 20px; line-height: 1.5; }
        
        form label { display: block; margin-bottom: 8px; color: #cbd5e1; font-size: 0.9em; }
        form input, .prompt-in { width: 100%; padding: 12px; background: #0f172a; border: 1px solid #475569; border-radius: 8px; color: white; margin-bottom: 20px; font-size: 1em; }
        
        .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; }
        .modal-actions button { padding: 10px 20px; border-radius: 8px; border: none; cursor: pointer; font-weight: bold; }
        .modal-actions .cancel { background: transparent; color: #cbd5e1; border: 1px solid #475569; }
        .modal-actions .save { background: #22c55e; color: white; }
        .modal-actions .save.red { background: #ef4444; }

        @keyframes popIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </AdminLayout>
  );
}
