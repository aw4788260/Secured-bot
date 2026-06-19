import TeacherLayout from '../../../components/TeacherLayout';
import { useState, useEffect } from 'react';

// --- أيقونات SVG الاحترافية ---
const Icons = {
    users: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
    add: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
    trash: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
    shield: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>,
    close: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
};

export default function TeamPage() {
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // الحالات الخاصة بالنوافذ والتنبيهات
  const [promptData, setPromptData] = useState({ show: false, title: '', placeholder: '', onSubmit: null });
  const [confirmData, setConfirmData] = useState({ show: false, message: '', onConfirm: null });
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  // دوال مساعدة للعرض
  const showToast = (msg, type='success') => {
      setToast({ show: true, message: msg, type });
      setTimeout(() => setToast({ show:false, message:'', type:'' }), 3000);
  };
  const showPrompt = (title, ph, cb) => setPromptData({ show: true, title, placeholder: ph, onSubmit: cb });
  const showConfirm = (msg, cb) => setConfirmData({ show: true, message: msg, onConfirm: cb });

  // 1. جلب بيانات الفريق
  const fetchTeam = async () => {
      setLoading(true);
      try {
          const res = await fetch('/api/dashboard/teacher/team?mode=list');
          const data = await res.json();
          if (res.ok) {
              setTeamMembers(data);
          } else {
              showToast(data.error || 'فشل جلب البيانات', 'error');
          }
      } catch (e) { showToast('خطأ في الاتصال بالسيرفر', 'error'); }
      setLoading(false);
  };

  useEffect(() => { fetchTeam(); }, []);

  // 2. تنفيذ الإجراءات (ترقية / تنزيل)
  const handleAction = async (action, payload) => {
      try {
          const res = await fetch('/api/dashboard/teacher/team', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action, ...payload })
          });
          const data = await res.json();
          if (res.ok) {
              showToast('تم تنفيذ العملية بنجاح');
              fetchTeam(); // تحديث القائمة
              return true;
          } else {
              showToast(data.error, 'error');
              return false;
          }
      } catch (e) { showToast('خطأ اتصال', 'error'); }
  };

  // 3. إضافة مشرف (البحث عن طالب وترقيته)
  const handlePromote = () => {
      showPrompt('أدخل اسم المستخدم (Username) للطالب:', 'مثال: ahmed_student', async (val) => {
          if (!val) return;
          const username = val.trim();

          // أولاً: نبحث عن الطالب للتأكد من وجوده والحصول على ID
          try {
            const searchRes = await fetch(`/api/dashboard/teacher/team?mode=search&query=${username}`);
            const students = await searchRes.json();
            
            // البحث عن تطابق تام لاسم المستخدم
            const targetStudent = students.find(s => s.username === username);

            if (targetStudent) {
                // إذا وجدنا الطالب، نؤكد الترقية
                showConfirm(`هل تريد ترقية الطالب "${targetStudent.first_name}" ليكون مشرفاً؟\n(سيحصل على صلاحية الوصول للكورسات ولوحة التحكم)`, () => {
                    handleAction('promote', { userId: targetStudent.id });
                });
            } else {
                showToast('لم يتم العثور على طالب بهذا الاسم', 'error');
            }
          } catch (err) {
            showToast('حدث خطأ أثناء البحث', 'error');
          }
      });
  };

  // 4. حذف مشرف (سحب الصلاحيات)
  const handleDemote = (member) => {
      showConfirm(`هل أنت متأكد من سحب صلاحيات الإشراف من ${member.first_name}؟\n(سيعود لحساب طالب عادي ويفقد صلاحيات الوصول للكورسات)`, () => {
          handleAction('demote', { userId: member.id });
      });
  };

  return (
    <TeacherLayout title="فريق العمل">
      <div className={`toast-notification ${toast.show ? 'show' : ''} ${toast.type}`}>
          {toast.message}
      </div>

      <div className="page-header">
          <div className="title-area">
              <div className="title-icon">{Icons.users}</div>
              <div>
                  <h1 className="page-title">إدارة المساعدين</h1>
                  <p className="page-sub">أضف مشرفين لمساعدتك في إدارة المحتوى والطلاب بكفاءة.</p>
              </div>
          </div>
          <button onClick={handlePromote} className="btn-primary">
              <span className="icon-wrap">{Icons.add}</span> إضافة مشرف جديد
          </button>
      </div>

      <div className="table-box">
          {loading ? (
              <div className="loading-state">
                  <div className="spinner"></div>
                  <span>جاري تحميل قائمة المشرفين...</span>
              </div>
          ) : (
              <div className="table-responsive">
                  <table className="admin-table">
                      <thead>
                          <tr>
                              <th style={{width:'80px'}}>ID</th>
                              <th style={{textAlign: 'right'}}>الاسم</th>
                              <th style={{textAlign: 'center'}}>اسم المستخدم</th>
                              <th style={{textAlign: 'center'}}>الهاتف</th>
                              <th style={{textAlign: 'center'}}>تاريخ الانضمام</th>
                              <th style={{textAlign: 'center'}}>الإجراءات</th>
                          </tr>
                      </thead>
                      <tbody>
                          {teamMembers.map(member => (
                              <tr key={member.id} className="hover-row">
                                  <td className="mono-text">{member.id}</td>
                                  <td>
                                      <div className="name-wrap">
                                          <div className="avatar-mini">{member.first_name?.[0] || '؟'}</div>
                                          <span className="name-text">{member.first_name || 'بدون اسم'}</span>
                                      </div>
                                  </td>
                                  
                                  <td className="center-text">
                                      <span className="user-tag admin">
                                          <span className="icon-wrap mini">{Icons.shield}</span> @{member.username}
                                      </span>
                                  </td>

                                  <td className="center-text mono-text highlight-text ltr-dir">{member.phone || '-'}</td>
                                  
                                  <td className="center-text date-cell">
                                    {new Date(member.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                                  </td>
                                  
                                  <td>
                                      <div className="actions-cell">
                                          <button onClick={() => handleDemote(member)} className="btn-icon danger-icon" title="سحب الإشراف">
                                              {Icons.trash}
                                          </button>
                                      </div>
                                  </td>
                              </tr>
                          ))}
                          {teamMembers.length === 0 && !loading && (
                              <tr>
                                  <td colSpan="6" className="empty-state">
                                      <div className="empty-icon">{Icons.users}</div>
                                      لا يوجد مشرفين أو مساعدين في فريقك حالياً.
                                  </td>
                              </tr>
                          )}
                      </tbody>
                  </table>
              </div>
          )}
      </div>

      {/* --- نوافذ التنبيهات (Alerts & Prompts) --- */}
      {promptData.show && (
        <div className="modal-overlay alert-mode" onClick={() => setPromptData({...promptData,show:false})}>
            <div className="modal-box small" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>🔍 إضافة مشرف</h3>
                    <button className="close-icon" onClick={() => setPromptData({...promptData,show:false})}>
                        {Icons.close}
                    </button>
                </div>
                <div className="modal-body">
                    <p className="prompt-label">{promptData.title}</p>
                    <input 
                        id="pIn" 
                        autoFocus 
                        className="input" 
                        placeholder={promptData.placeholder} 
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                promptData.onSubmit(e.target.value); 
                                setPromptData({...promptData,show:false});
                            }
                        }}
                    />
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn-cancel" onClick={()=>setPromptData({...promptData,show:false})}>إلغاء</button>
                    <button onClick={()=>{promptData.onSubmit(document.getElementById('pIn').value); setPromptData({...promptData,show:false})}} className="btn-confirm success-bg">بحث وترقية</button>
                </div>
            </div>
        </div>
      )}

      {confirmData.show && (
        <div className="modal-overlay alert-mode" onClick={() => setConfirmData({...confirmData,show:false})}>
            <div className="modal-box small" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>⚠️ تأكيد الإجراء</h3>
                    <button className="close-icon" onClick={() => setConfirmData({...confirmData,show:false})}>
                        {Icons.close}
                    </button>
                </div>
                <div className="modal-body">
                    <p className="confirm-text" style={{ whiteSpace: 'pre-wrap' }}>{confirmData.message}</p>
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn-cancel" onClick={()=>setConfirmData({...confirmData,show:false})}>تراجع</button>
                    <button onClick={()=>{confirmData.onConfirm(); setConfirmData({...confirmData,show:false})}} className="btn-confirm danger-bg">نعم، تأكيد</button>
                </div>
            </div>
        </div>
      )}

      <style jsx>{`
        /* ── THEME VARS ── */
        .toast-notification { position: fixed; top: 24px; left: 50%; transform: translate(-50%, -150%); padding: 14px 28px; border-radius: 12px; font-weight: bold; transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1); z-index: 99999; box-shadow: 0 10px 30px rgba(0,0,0,0.5); font-size: 0.95rem; border: 1px solid rgba(255,255,255,0.1); }
        .toast-notification.show { transform: translate(-50%, 0); } 
        .toast-notification.success { background: #22c55e; color: #111009; } 
        .toast-notification.error { background: #ef4444; color: #fff; }

        .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; flex-wrap: wrap; gap: 20px; border-bottom: 1px solid var(--border); padding-bottom: 20px; }
        .title-area { display: flex; align-items: center; gap: 16px; }
        .title-icon { width: 50px; height: 50px; background: var(--gold-dim); color: var(--gold); border-radius: 14px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border-accent); }
        .page-title { margin: 0 0 6px 0; color: var(--text-primary); font-size: 1.6rem; font-weight: 800; }
        .page-sub { margin: 0; color: var(--text-secondary); font-size: 0.95rem; }

        .btn-primary { background: var(--gold); color: #111009; border: none; padding: 10px 20px; border-radius: 10px; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; font-size: 0.95rem; transition: 0.2s; box-shadow: 0 4px 12px var(--gold-dimmer); }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 16px var(--gold-dim); }

        .table-box { background: var(--bg-surface); border-radius: 16px; border: 1px solid var(--border); overflow: hidden; box-shadow: var(--shadow); }
        .table-responsive { overflow-x: auto; }
        .admin-table { width: 100%; border-collapse: collapse; min-width: 850px; text-align: right; }
        .admin-table th { background: var(--bg-elevated); padding: 16px; color: var(--text-secondary); border-bottom: 1px solid var(--border); font-size: 0.85rem; font-weight: 700; white-space: nowrap; }
        .admin-table td { padding: 16px; border-bottom: 1px solid var(--border); color: var(--text-primary); vertical-align: middle; font-size: 0.95rem; }
        .admin-table tbody tr:last-child td { border-bottom: none; }
        .hover-row { transition: background 0.2s; }
        .hover-row:hover { background: var(--bg-hover); }

        .name-wrap { display: flex; align-items: center; gap: 12px; }
        .avatar-mini { width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, var(--gold), var(--gold-light)); color: #111009; display: flex; align-items: center; justify-content: center; font-size: 0.95rem; font-weight: bold; flex-shrink: 0; }
        .name-text { font-weight: 600; }

        .user-tag { padding: 6px 10px; border-radius: 8px; font-size: 0.85rem; font-weight: bold; display: inline-flex; align-items: center; gap: 6px; font-family: monospace; }
        .user-tag.admin { color: var(--gold); background: var(--gold-dim); border: 1px solid var(--border-accent); }

        .mono-text { font-family: 'Courier New', Courier, monospace; color: var(--text-secondary); }
        .center-text { text-align: center; }
        .highlight-text { color: var(--text-primary); font-weight: 600; }
        .ltr-dir { direction: ltr; }
        .date-cell { font-size: 0.85rem; color: var(--text-muted); }

        .actions-cell { display: flex; justify-content: center; align-items: center; }
        .btn-icon { background: var(--bg-elevated); border: 1px solid transparent; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; color: var(--text-secondary); }
        .btn-icon.danger-icon { color: #ef4444; background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2); }
        .btn-icon.danger-icon:hover { background: #ef4444; color: white; transform: translateY(-2px); box-shadow: 0 4px 10px rgba(239, 68, 68, 0.2); }

        .loading-state { padding: 60px 20px; text-align: center; color: var(--gold); font-weight: bold; display: flex; flex-direction: column; align-items: center; gap: 15px; }
        .spinner { width: 36px; height: 36px; border: 3px solid var(--border); border-top-color: var(--gold); border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .empty-state { text-align: center; padding: 60px 20px; color: var(--text-muted); font-size: 0.95rem; }
        .empty-icon { font-size: 3rem; color: var(--border); margin-bottom: 15px; display: flex; justify-content: center; opacity: 0.5; }

        /* ── MODALS ── */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 2000; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(5px); padding: 20px; }
        .modal-box { background: var(--bg-surface); width: 100%; max-width: 500px; border-radius: 20px; border: 1px solid var(--border-accent); display: flex; flex-direction: column; box-shadow: 0 25px 50px rgba(0,0,0,0.5); animation: popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); overflow: hidden; }
        .modal-box.small { max-width: 400px; }
        
        .modal-header { background: var(--bg-elevated); padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); }
        .modal-header h3 { margin: 0; color: var(--gold); font-size: 1.15rem; font-weight: bold; }
        .close-icon { background: var(--bg-surface); border: 1px solid var(--border); color: var(--text-secondary); width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; justify-content: center; align-items: center; transition: 0.2s; }
        .close-icon:hover { background: var(--bg-hover); color: var(--text-primary); }
        
        .modal-body { padding: 24px; }
        .prompt-label { margin: 0 0 10px 0; color: var(--text-secondary); font-weight: bold; font-size: 0.95rem; }
        .confirm-text { margin: 0; color: var(--text-primary); font-size: 1rem; line-height: 1.6; }
        
        .input { width: 100%; background: var(--bg-base); border: 1px solid var(--border); color: var(--text-primary); padding: 12px 16px; border-radius: 10px; font-family: inherit; font-size: 1rem; transition: 0.2s; }
        .input:focus { border-color: var(--gold); outline: none; box-shadow: 0 0 0 2px var(--gold-dim); }
        
        .modal-footer { padding: 18px 24px; background: var(--bg-elevated); display: flex; justify-content: flex-end; gap: 12px; border-top: 1px solid var(--border); }
        
        .btn-cancel { background: transparent; color: var(--text-secondary); border: 1px solid var(--border); padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s; }
        .btn-cancel:hover { background: var(--bg-hover); color: var(--text-primary); }
        .btn-confirm { border: none; padding: 10px 24px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s; color: white; }
        .btn-confirm.success-bg { background: #22c55e; color: #111009; }
        .btn-confirm.success-bg:hover { background: #16a34a; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3); }
        .btn-confirm.danger-bg { background: #ef4444; }
        .btn-confirm.danger-bg:hover { background: #dc2626; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); }

        @keyframes popIn { from { transform: scale(0.95) translateY(10px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }

        @media (max-width: 600px) {
            .page-header { flex-direction: column; align-items: flex-start; gap: 15px; }
            .btn-primary { width: 100%; justify-content: center; }
        }
      `}</style>
    </TeacherLayout>
  );
}
