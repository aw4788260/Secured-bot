import { useState, useEffect } from 'react';
import Head from 'next/head';
import SuperLayout from '../../../components/SuperLayout';

export default function WheelManager() {
  const [loading, setLoading] = useState(true);
  const [prizes, setPrizes] = useState([]);
  const [winners, setWinners] = useState([]); // 🎯 مصفوفة الفائزين الجديدة
  const [isWheelEnabled, setIsWheelEnabled] = useState(true); // 🎯 حالة العجلة العامة
  const [teachers, setTeachers] = useState([]);
  const [stats, setStats] = useState({ poolCount: 0, spinsCount: 0 });

  const [showModal, setShowModal] = useState(false);
  const [confirmData, setConfirmData] = useState({ show: false, msg: '', action: null });
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });

  const [formData, setFormData] = useState({
    id: null, title: '', type: 'coupon', discount_type: 'percentage',
    discount_value: 0, validity_days: 7, total_stock: 10, color: '#38bdf8', teacher_id: '', is_active: true
  });

  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg, type }), 3000);
  };

  const showConfirm = (msg, action) => {
    setConfirmData({ show: true, msg, action });
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const tRes = await fetch('/api/dashboard/super/teachers');
      if (tRes.ok) setTeachers(await tRes.ok ? await tRes.json() : []);

      const wRes = await fetch('/api/dashboard/super/wheel');
      if (wRes.ok) {
        const data = await wRes.json();
        setPrizes(data.prizes || []);
        setWinners(data.winners || []); // جلب الفائزين
        setIsWheelEnabled(data.isWheelEnabled); // جلب حالة التفعيل
        setStats({ poolCount: data.poolCount, spinsCount: data.spinsCount });
      }
    } catch (err) {
      showToast('خطأ في جلب البيانات', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const executeAction = async (action, payload = {}) => {
    setConfirmData({ show: false, msg: '', action: null });
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/super/wheel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'success');
        setShowModal(false);
        fetchData();
      } else {
        showToast(data.error, 'error');
      }
    } catch (e) {
      showToast('خطأ في الاتصال', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleWheel = () => {
      const nextState = !isWheelEnabled;
      showConfirm(
          `هل أنت متأكد من أنك تريد ${nextState ? 'تفعيل' : 'تعطيل وإلغاء تفعيل'} عجلة الحظ للطلاب؟`,
          () => executeAction('toggle_wheel_status', { enabled: nextState })
      );
  };

  const openForm = (prize = null) => {
    if (prize) {
      setFormData(prize);
    } else {
      setFormData({
        id: null, title: '', type: 'coupon', discount_type: 'percentage',
        discount_value: 0, validity_days: 7, total_stock: 10, color: '#38bdf8', teacher_id: '', is_active: true
      });
    }
    setShowModal(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (formData.type === 'coupon' && !formData.teacher_id) {
        return showToast('يجب اختيار المدرس لربط الكوبون به!', 'error');
    }
    executeAction('save_prize', formData);
  };

  return (
    <SuperLayout title="إدارة عجلة الحظ المتقدمة">
      <div className={`toast ${toast.show ? 'show' : ''} ${toast.type}`}>{toast.msg}</div>

      <div className="page-header">
        <div>
          <h1>🎡 إدارة عجلة الحظ ونظام الجوائز</h1>
          <p>تجهيز الكتالوج، متابعة الفائزين، والتحكم في حالة الحملة</p>
        </div>
        <div className="header-actions">
          {/* 🎯 زر تفعيل/إلغاء تفعيل العجلة بالكامل */}
          <button className={`btn ${isWheelEnabled ? 'danger-btn' : 'success'}`} onClick={handleToggleWheel}>
            {isWheelEnabled ? '🛑 إلغاء تفعيل العجلة بالكامل' : '🟢 تشغيل وتفعيل العجلة'}
          </button>
          <button className="btn warning" onClick={() => showConfirm('هل أنت متأكد من مسح سجل المشاركات؟ سيتمكن الطلاب من اللعب مرة أخرى.', () => executeAction('reset_spins'))}>
            Clarify 🧹 تصفير السجل
          </button>
          <button className="btn success" onClick={() => showConfirm('هل أنت متأكد من تفعيل الحملة؟ سيتم خلط التذاكر بناءً على الجوائز الحالية المتاحة بالمخزون.', () => executeAction('activate_campaign'))}>
            🚀 تفعيل الحملة وخلط الصندوق
          </button>
        </div>
      </div>

      {/* الإحصائيات */}
      <div className="stats-grid">
         <div className="stat-card">
            <h3>⚙️ حالة نظام العجلة</h3>
            <div className={`val ${isWheelEnabled ? 'green-text' : 'red-text'}`}>
                {isWheelEnabled ? 'نشط ومفعل' : 'معطل ومغلق'}
            </div>
         </div>
         <div className="stat-card">
            <h3>🎟️ تذاكر جاهزة بالصندوق</h3>
            <div className="val blue">{stats.poolCount}</div>
            <p>متبقية للسحب الفوري</p>
         </div>
         <div className="stat-card">
            <h3>👤 إجمالي الطلاب الفائزين</h3>
            <div className="val green">{stats.spinsCount}</div>
            <p>قاموا بتدوير العجلة</p>
         </div>
      </div>

      {/* جدول الجوائز */}
      <div className="panel" style={{ marginBottom: '30px' }}>
        <div className="panel-header">
           <h2>كتالوج وإعدادات الجوائز المتاحة</h2>
           <button className="btn primary" onClick={() => openForm()}>➕ إضافة جائزة جديدة</button>
        </div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>اللون</th>
                <th>الجائزة</th>
                <th>النوع والخصم</th>
                <th>المخزون الحالي (Stock)</th>
                <th>المدرس المرتبط</th>
                <th>حالة القطعة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {prizes.map(p => (
                <tr key={p.id}>
                  <td><div className="color-box" style={{backgroundColor: p.color}}></div></td>
                  <td style={{fontWeight:'bold', color:'white'}}>{p.title}</td>
                  <td>
                      {p.type === 'coupon' ? '🎟️ كوبون خصم' : p.type === 'material' ? '🎁 جائزة مادية' : '😢 حظ أوفر'}
                      {p.type === 'coupon' && <div className="sub-txt">{p.discount_value} {p.discount_type === 'percentage' ? '%' : 'ج.م'}</div>}
                  </td>
                  <td><span className="stock-badge">{p.total_stock}</span></td>
                  <td className="sub-txt">{p.teachers?.name || '-'}</td>
                  <td>{p.is_active ? '✅ مفعلة بالعجلة' : '❌ معطلة'}</td>
                  <td>
                    <div className="actions-cell">
                       <button className="icon-btn edit" onClick={() => openForm(p)}>✏️</button>
                       <button className="icon-btn delete" onClick={() => showConfirm('تأكيد حذف الجائزة نهائياً؟', () => executeAction('delete_prize', { id: p.id }))}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🎯 جدول الفائزين الجديد والمطلوب */}
      <div className="panel">
        <div className="panel-header" style={{ background: '#0f172a' }}>
           <h2>👥 سجل الطلاب الفائزين (المشاركات)</h2>
        </div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th># معرف الفوز</th>
                <th>اسم الطالب الفائز</th>
                <th>رقم الهاتف</th>
                <th>الجائزة التي ربحها</th>
                <th>كود الخصم الممنوح</th>
                <th>تاريخ وساعة الفوز</th>
              </tr>
            </thead>
            <tbody>
              {winners.map(w => (
                <tr key={w.id}>
                  <td style={{ fontFamily: 'monospace' }}>#{w.id}</td>
                  <td style={{ fontWeight: 'bold', color: '#f8fafc' }}>{w.student_name}</td>
                  <td dir="ltr" style={{ textAlign: 'right', fontFamily: 'monospace' }}>{w.student_phone}</td>
                  <td>
                     {w.wheel_prizes ? (
                        <span className={`type-tag ${w.wheel_prizes.type}`}>
                          {w.wheel_prizes.title}
                        </span>
                     ) : <span className="red-text">جائزة ممسوحة</span>}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#4ade80' }}>
                     {w.coupon_code || '_'}
                  </td>
                  <td className="sub-txt">{new Date(w.created_at).toLocaleString('ar-EG')}</td>
                </tr>
              ))}
              {winners.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    لا توجد عمليات فوز مسجلة حتى الآن.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* مودال الإضافة والتعديل */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
           <div className="modal-box" onClick={e => e.stopPropagation()}>
              <div className="modal-head">
                 <h3>{formData.id ? 'تعديل بيانات الجائزة' : 'إضافة جائزة جديدة للكتالوج'}</h3>
                 <button onClick={() => setShowModal(false)} className="close-btn">✕</button>
              </div>
              <form onSubmit={handleSave} className="modal-body">
                 <div className="form-group">
                    <label>الاسم (الذي يظهر للطلاب على العجلة)</label>
                    <input className="input" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="مثال: خصم 50% / حظ أوفر المرة القادمة" />
                 </div>
                 <div className="grid-2">
                    <div className="form-group">
                        <label>نوع الجائزة</label>
                        <select className="input" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                            <option value="coupon">🎟️ كوبون خصم (يُولد تلقائياً)</option>
                            <option value="material">🎁 جائزة مادية (تسليم يدوي)</option>
                            <option value="nothing">😢 حظ أوفر (بدون جائزة)</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>المخزون الكلي المتاح لسحب الجائزة</label>
                        <input className="input" type="number" required min="0" value={formData.total_stock} onChange={e => setFormData({...formData, total_stock: e.target.value})} />
                    </div>
                 </div>

                 {formData.type === 'coupon' && (
                     <div className="coupon-box">
                         <h4>⚙️ إعدادات توليد الكوبون التلقائي</h4>
                         <div className="grid-2">
                             <div className="form-group">
                                 <label>المدرس المرتبط به الكوبون</label>
                                 <select className="input" required value={formData.teacher_id || ''} onChange={e => setFormData({...formData, teacher_id: e.target.value})}>
                                     <option value="">-- اختر المدرس --</option>
                                     {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                 </select>
                             </div>
                             <div className="form-group">
                                 <label>صلاحية الكوبون بعد الفوز (أيام)</label>
                                 <input className="input" type="number" min="1" required value={formData.validity_days} onChange={e => setFormData({...formData, validity_days: e.target.value})} />
                             </div>
                         </div>
                         <div className="grid-2 mt-2">
                             <div className="form-group">
                                 <label>نوع قيمة الخصم</label>
                                 <select className="input" value={formData.discount_type} onChange={e => setFormData({...formData, discount_type: e.target.value})}>
                                     <option value="percentage">نسبة مئوية (%)</option>
                                     <option value="fixed">مبلغ ثابت (ج.م)</option>
                                 </select>
                             </div>
                             <div className="form-group">
                                 <label>القيمة المخصومة</label>
                                 <input className="input" type="number" min="1" required value={formData.discount_value} onChange={e => setFormData({...formData, discount_value: e.target.value})} />
                             </div>
                         </div>
                     </div>
                 )}

                 <div className="grid-2 mt-2">
                     <div className="form-group">
                         <label>لون القطعة في الرسمة</label>
                         <div style={{display:'flex', gap:'10px'}}>
                             <input type="color" className="color-picker" value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} />
                             <input className="input" type="text" value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} />
                         </div>
                     </div>
                     <div className="form-group" style={{display:'flex', alignItems:'flex-end'}}>
                         <label style={{display:'flex', alignItems:'center', gap:'10px', cursor:'pointer', padding:'12px', background:'rgba(255,255,255,0.05)', borderRadius:'8px', width:'100%'}}>
                             <input type="checkbox" style={{width:'20px', height:'20px'}} checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} />
                             تفعيل الجائزة ضمن السحب المباشر
                         </label>
                     </div>
                 </div>
                 <div className="modal-footer">
                    <button type="button" className="btn cancel" onClick={() => setShowModal(false)}>إلغاء</button>
                    <button type="submit" className="btn primary">حفظ التغييرات 💾</button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* نافذة التأكيد الدائرية */}
      {confirmData.show && (
          <div className="modal-overlay">
              <div className="modal-box confirm-box">
                  <h3>⚠️ تأكيد الإجراء الأمني</h3>
                  <p>{confirmData.msg}</p>
                  <div className="modal-footer centered">
                      <button className="btn cancel" onClick={() => setConfirmData({show:false})}>تراجع</button>
                      <button className="btn success" onClick={confirmData.action}>نعم، نفذ الآن</button>
                  </div>
              </div>
          </div>
      )}

      <style jsx>{`
        .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; border-bottom: 1px solid #334155; padding-bottom: 20px; flex-wrap: wrap; gap: 15px; }
        .page-header h1 { margin: 0 0 5px 0; color: #f8fafc; font-size: 1.8rem; }
        .page-header p { margin: 0; color: #94a3b8; }
        .header-actions { display: flex; gap: 10px; }
        .btn { padding: 10px 20px; border-radius: 8px; border: none; font-weight: bold; cursor: pointer; transition: 0.2s; font-size: 0.95rem; }
        .btn.primary { background: #38bdf8; color: #0f172a; }
        .btn.success { background: #22c55e; color: #0f172a; }
        .btn.warning { background: transparent; border: 1px solid #f59e0b; color: #fcd34d; }
        .btn.cancel { background: transparent; border: 1px solid #475569; color: #cbd5e1; }
        .danger-btn { background: #ef4444; color: white; } .danger-btn:hover { background: #dc2626; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155; text-align: center; }
        .stat-card h3 { margin: 0 0 10px 0; color: #94a3b8; font-size: 1rem; }
        .stat-card .val { font-size: 2rem; font-weight: bold; color: #f8fafc; }
        .stat-card .val.blue { color: #38bdf8; } .stat-card .val.green { color: #4ade80; }
        .green-text { color: #4ade80 !important; } .red-text { color: #f87171 !important; }
        .panel { background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; }
        .panel-header { display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid #334155; background: #0f172a; }
        .panel-header h2 { margin: 0; font-size: 1.2rem; color: white; }
        table { width: 100%; border-collapse: collapse; text-align: right; }
        th { padding: 15px; color: #94a3b8; font-size: 0.9rem; background: #0f172a; border-bottom: 1px solid #334155; }
        td { padding: 15px; border-bottom: 1px solid #334155; color: #cbd5e1; vertical-align: middle; }
        .color-box { width: 30px; height: 30px; border-radius: 6px; }
        .sub-txt { font-size: 0.85em; color: #94a3b8; }
        .stock-badge { background: rgba(56, 189, 248, 0.1); color: #38bdf8; padding: 4px 12px; border-radius: 20px; font-weight: bold; }
        .type-tag { padding: 4px 8px; border-radius: 6px; font-size: 0.9rem; font-weight: bold; background: #334155; }
        .type-tag.coupon { color: #4ade80; background: rgba(74, 222, 128, 0.1); }
        .type-tag.material { color: #facc15; background: rgba(250, 204, 21, 0.1); }
        .actions-cell { display: flex; gap: 8px; }
        .icon-btn { background: rgba(255,255,255,0.05); border: none; width: 35px; height: 35px; border-radius: 8px; cursor: pointer; }
        .icon-btn.edit { background: rgba(250, 204, 21, 0.1); } .icon-btn.delete { background: rgba(239, 68, 68, 0.1); }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 1000; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(4px); }
        .modal-box { background: #0f172a; width: 95%; max-width: 600px; border-radius: 16px; border: 1px solid #334155; overflow: hidden; }
        .confirm-box { max-width: 400px; padding: 25px; text-align: center; }
        .modal-head { display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid #334155; background: #1e293b; }
        .modal-head h3 { margin: 0; color: white; }
        .close-btn { background: none; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer; }
        .modal-body { padding: 20px; }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; color: #94a3b8; margin-bottom: 8px; font-size: 0.9rem; }
        .input { width: 100%; padding: 12px; background: #1e293b; border: 1px solid #475569; border-radius: 8px; color: white; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .mt-2 { margin-top: 15px; }
        .coupon-box { background: rgba(56, 189, 248, 0.05); border: 1px dashed rgba(56, 189, 248, 0.3); padding: 15px; border-radius: 12px; margin-top: 15px; }
        .coupon-box h4 { margin: 0 0 15px 0; color: #38bdf8; }
        .color-picker { width: 45px; height: 45px; padding: 0; border: none; border-radius: 8px; cursor: pointer; background: transparent; }
        .modal-footer { padding-top: 20px; margin-top: 10px; border-top: 1px solid #334155; display: flex; justify-content: flex-end; gap: 10px; }
        .modal-footer.centered { justify-content: center; border: none; }
        .toast { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%) translateY(100px); background: #333; color: white; padding: 12px 25px; border-radius: 50px; font-weight: bold; box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 2000; transition: 0.4s; opacity: 0; }
        .toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }
        .toast.success { background: #22c55e; color: #0f172a; }
        .toast.error { background: #ef4444; color: white; }
      `}</style>
    </SuperLayout>
  );
}
