import TeacherLayout from '../../../components/TeacherLayout';
import { useState, useEffect } from 'react';

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
      <div className={`toast ${toast.show ? 'show' : ''} ${toast.type}`}>{toast.message}</div>

      <div className="page-header">
          <div>
            <h1>👥 إدارة المساعدين</h1>
            <p className="sub-head">إدارة المشرفين وصلاحياتهم على المحتوى</p>
          </div>
          <button onClick={handlePromote} className="add-btn">➕ إضافة مشرف جديد</button>
      </div>

      <div className="table-box">
          <table className="admin-table">
              <thead>
                  <tr>
                      <th style={{width:'60px'}}>ID</th>
                      <th>الاسم</th>
                      <th>اسم المستخدم</th>
                      <th style={{textAlign:'center'}}>الهاتف</th>
                      <th>تاريخ الانضمام</th>
                      <th>الإجراءات</th>
                  </tr>
              </thead>
              <tbody>
                  {teamMembers.map(member => (
                      <tr key={member.id}>
                          <td style={{fontFamily:'monospace', color:'#94a3b8'}}>{member.id}</td>
                          <td style={{fontWeight:'bold'}}>{member.first_name || 'بدون اسم'}</td>
                          
                          <td><span className="user-tag admin">@{member.username}</span></td>

                          <td style={{textAlign:'center', direction:'ltr', fontFamily:'monospace', color:'#e2e8f0'}}>{member.phone || '-'}</td>
                          
                          <td style={{color:'#94a3b8', fontSize:'0.9em'}}>
                            {new Date(member.created_at).toLocaleDateString('en-GB')}
                          </td>
                          
                          <td>
                              <div className="actions">
                                  <button onClick={() => handleDemote(member)} className="text-btn red">
                                      سحب الإشراف 🗑️
                                  </button>
                              </div>
                          </td>
                      </tr>
                  ))}
                  {teamMembers.length === 0 && !loading && <tr><td colSpan="6" style={{textAlign:'center', padding:'20px'}}>لا يوجد مساعدين حالياً</td></tr>}
              </tbody>
          </table>
      </div>

      {/* --- نوافذ التنبيهات (Alerts & Prompts) --- */}
      {promptData.show && (
        <div className="modal-overlay alert">
            <div className="modal-box small">
                <h3>{promptData.title}</h3>
                <input id="pIn" autoFocus className="prompt-in" placeholder={promptData.placeholder} />
                <div className="modal-actions">
                    <button type="button" className="cancel" onClick={()=>setPromptData({...promptData,show:false})}>إلغاء</button>
                    <button onClick={()=>{promptData.onSubmit(document.getElementById('pIn').value); setPromptData({...promptData,show:false})}} className="save">موافق</button>
                </div>
            </div>
        </div>
      )}

      {confirmData.show && (
        <div className="modal-overlay alert">
            <div className="modal-box small">
                <h3>تأكيد</h3>
                <p>{confirmData.message}</p>
                <div className="modal-actions">
                    <button type="button" className="cancel" onClick={()=>setConfirmData({...confirmData,show:false})}>إلغاء</button>
                    <button onClick={()=>{confirmData.onConfirm(); setConfirmData({...confirmData,show:false})}} className="save red">نعم، متأكد</button>
                </div>
            </div>
        </div>
      )}

      <style jsx>{`
        .toast { position: fixed; top: 20px; right: 20px; padding: 15px 25px; border-radius: 8px; color: white; font-weight: bold; transform: translateX(150%); transition: transform 0.3s; z-index: 9999; box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
        .toast.show { transform: translateX(0); } .toast.success { background: #22c55e; } .toast.error { background: #ef4444; }

        .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
        .page-header h1 { margin: 0; color: #38bdf8; font-size: 1.8em; }
        .sub-head { margin: 5px 0 0 0; color: #94a3b8; font-size: 0.9em; }
        .add-btn { background: #38bdf8; color: #0f172a; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s; }
        .add-btn:hover { background: #7dd3fc; transform: translateY(-2px); }

        .table-box { background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow-x: auto; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
        .admin-table { width: 100%; border-collapse: collapse; min-width: 800px; }
        .admin-table th { background: #0f172a; padding: 15px; color: #94a3b8; border-bottom: 1px solid #334155; text-align: right; white-space: nowrap; }
        .admin-table td { padding: 15px; border-bottom: 1px solid #334155; color: #e2e8f0; vertical-align: middle; }
        .admin-table tr:hover { background: rgba(255,255,255,0.03); }

        .user-tag { padding: 4px 8px; border-radius: 4px; font-size: 0.85em; font-weight: 500; display: inline-block; font-family: monospace; }
        .user-tag.admin { color: #4ade80; background: rgba(74, 222, 128, 0.1); border: 1px solid rgba(74, 222, 128, 0.2); }

        .actions { display: flex; gap: 8px; }
        .text-btn { padding: 8px 12px; border-radius: 6px; border: none; cursor: pointer; font-size: 0.85em; font-weight: bold; transition: 0.2s; white-space: nowrap; display: flex; align-items: center; gap: 5px; }
        .text-btn.red { background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.5); } .text-btn.red:hover { background: #ef4444; color: white; }

        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); z-index: 200; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(3px); }
        .modal-box { background: #1e293b; width: 90%; max-width: 500px; padding: 25px; border-radius: 16px; border: 1px solid #475569; box-shadow: 0 20px 50px rgba(0,0,0,0.5); animation: popIn 0.3s; }
        .modal-box.small { max-width: 400px; }
        .modal-box h3 { margin-top: 0; color: #38bdf8; margin-bottom: 10px; }
        
        .prompt-in { width: 100%; padding: 12px; background: #0f172a; border: 1px solid #475569; border-radius: 8px; color: white; margin-bottom: 20px; font-size: 1em; }
        
        .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; }
        .modal-actions button { padding: 10px 20px; border-radius: 8px; border: none; cursor: pointer; font-weight: bold; }
        .modal-actions .cancel { background: transparent; color: #cbd5e1; border: 1px solid #475569; }
        .modal-actions .save { background: #22c55e; color: white; }
        .modal-actions .save.red { background: #ef4444; }

        @keyframes popIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </TeacherLayout>
  );
}
