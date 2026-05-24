import { useState, useEffect } from 'react';
import Head from 'next/head';
import SuperLayout from '../../../components/SuperLayout';

export default function WheelManager() {
  const [loading, setLoading] = useState(true);
  const [prizes, setPrizes] = useState([]);
  const [winners, setWinners] = useState([]); 
  const [isWheelEnabled, setIsWheelEnabled] = useState(true); 
  const [teachers, setTeachers] = useState([]);
  const [courses, setCourses] = useState([]); 
  const [stats, setStats] = useState({ poolCount: 0, spinsCount: 0 });

  const [showModal, setShowModal] = useState(false);
  const [confirmData, setConfirmData] = useState({ show: false, msg: '', action: null });
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });

  // ✅ نافذة اختيار الهدف (Target Selection)
  const [targetSelectionModal, setTargetSelectionModal] = useState({ show: false, type: '' });

  const [formData, setFormData] = useState({
    id: null, title: '', type: 'coupon', discount_type: 'percentage',
    discount_value: 0, validity_days: 7, total_stock: 10, 
    link_type: 'teacher', teacher_id: '', course_id: '', subject_id: '', is_active: true
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
      if (tRes.ok) setTeachers(await tRes.json() || []);

      const cRes = await fetch('/api/dashboard/super/content?type=all');
      if (cRes.ok) {
          const cData = await cRes.json();
          setCourses(cData.courses || []);
      }

      const wRes = await fetch('/api/dashboard/super/wheel');
      if (wRes.ok) {
        const data = await wRes.json();
        setPrizes(data.prizes || []);
        setWinners(data.winners || []); 
        setIsWheelEnabled(data.isWheelEnabled); 
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
        showToast(data.error || data.message, 'error');
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
      setFormData({
          ...prize,
          link_type: prize.link_type || 'teacher',
      });
    } else {
      setFormData({
        id: null, title: '', type: 'coupon', discount_type: 'percentage',
        discount_value: 0, validity_days: 7, total_stock: 10, 
        link_type: 'teacher', teacher_id: '', course_id: '', subject_id: '', is_active: true
      });
    }
    setShowModal(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (formData.type === 'coupon') {
        if (formData.link_type === 'teacher' && !formData.teacher_id) return showToast('يجب اختيار المدرس!', 'error');
        if (formData.link_type === 'course' && !formData.course_id) return showToast('يجب اختيار الكورس!', 'error');
        if (formData.link_type === 'subject' && !formData.subject_id) return showToast('يجب اختيار المادة!', 'error');
    }
    executeAction('save_prize', formData);
  };

  // ✅ استخراج الأسماء لعرضها في زر الاختيار
  const selectedTeacherName = teachers.find(t => t.id == formData.teacher_id)?.name || '';
  const selectedCourseName = courses.find(c => c.id == formData.course_id)?.title || '';
  let selectedSubjectName = '';
  if (formData.subject_id) {
      courses.forEach(c => {
          const s = c.subjects?.find(sub => sub.id == formData.subject_id);
          if (s) selectedSubjectName = s.title;
      });
  }

  return (
    <SuperLayout title="إدارة عجلة الحظ المتقدمة">
      <div className={`toast ${toast.show ? 'show' : ''} ${toast.type}`}>{toast.msg}</div>

      <div className="page-header">
        <div>
          <h1>🎡 إدارة عجلة الحظ ونظام الجوائز</h1>
          <p>تجهيز الكتالوج، متابعة الفائزين، والتحكم في حالة الحملة</p>
        </div>
        <div className="header-actions">
          <button className={`btn ${isWheelEnabled ? 'danger-btn' : 'success'}`} onClick={handleToggleWheel}>
            {isWheelEnabled ? '🛑 إلغاء تفعيل العجلة بالكامل' : '🟢 تشغيل وتفعيل العجلة'}
          </button>
          <button className="btn warning" onClick={() => showConfirm('هل أنت متأكد من مسح سجل المشاركات؟ سيتمكن الطلاب من اللعب مرة أخرى.', () => executeAction('reset_spins'))}>
              🧹 تصفير السجل
          </button>
          <button className="btn success" onClick={() => showConfirm('هل أنت متأكد من تفعيل الحملة؟ سيتم خلط التذاكر بناءً على الجوائز الحالية المتاحة بالمخزون.', () => executeAction('activate_campaign'))}>
            🚀 تفعيل الحملة وخلط الصندوق
          </button>
        </div>
      </div>

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

      <div className="panel" style={{ marginBottom: '30px' }}>
        <div className="panel-header">
           <h2>كتالوج وإعدادات الجوائز المتاحة</h2>
           <button className="btn primary" onClick={() => openForm()}>➕ إضافة جائزة جديدة</button>
        </div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>الجائزة</th>
                <th>النوع والخصم</th>
                <th>المخزون الحالي</th>
                <th>الارتباط (الهدف)</th>
                <th>حالة القطعة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {prizes.map(p => (
                <tr key={p.id}>
                  <td style={{fontWeight:'bold', color:'white'}}>{p.title}</td>
                  <td>
                      {p.type === 'coupon' ? '🎟️ كوبون خصم' : p.type === 'material' ? '🎁 جائزة مادية' : '😢 حظ أوفر'}
                      {p.type === 'coupon' && <div className="sub-txt">{p.discount_value} {p.discount_type === 'percentage' ? '%' : 'ج.م'}</div>}
                  </td>
                  <td><span className="stock-badge">{p.total_stock}</span></td>
                  
                  <td className="sub-txt">
                      {p.type === 'coupon' ? (
                          <>
                              {p.link_type === 'teacher' && <span style={{color: '#38bdf8'}}>👨‍🏫 مدرس: {p.teachers?.name || 'غير محدد'}</span>}
                              {p.link_type === 'course' && <span style={{color: '#4ade80'}}>📦 كورس: {p.courses?.title || 'غير محدد'}</span>}
                              {p.link_type === 'subject' && <span style={{color: '#facc15'}}>📚 مادة: {p.subjects?.title || 'غير محدد'}</span>}
                              {!p.link_type && (p.teachers?.name || '-')}
                          </>
                      ) : '-'}
                  </td>
                  
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

      {/* ✅ المودال الأساسي لإضافة وتعديل الجائزة */}
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
                         
                         <div className="form-group">
                             <label>الهدف من الكوبون (نطاق الخصم):</label>
                             <div style={{display: 'flex', gap: '15px', marginBottom: '10px', flexWrap: 'wrap'}}>
                                <label className="checkbox-label" style={{color:'#38bdf8'}}><input type="radio" name="wLinkType" checked={formData.link_type === 'teacher'} onChange={() => setFormData({...formData, link_type: 'teacher', course_id: '', subject_id: ''})} /> مدرس</label>
                                <label className="checkbox-label" style={{color:'#4ade80'}}><input type="radio" name="wLinkType" checked={formData.link_type === 'course'} onChange={() => setFormData({...formData, link_type: 'course', teacher_id: '', subject_id: ''})} /> كورس</label>
                                <label className="checkbox-label" style={{color:'#facc15'}}><input type="radio" name="wLinkType" checked={formData.link_type === 'subject'} onChange={() => setFormData({...formData, link_type: 'subject', teacher_id: '', course_id: ''})} /> مادة</label>
                             </div>
                             
                             {/* ✅ أزرار الاختيار الاحترافية */}
                             {formData.link_type === 'teacher' && (
                                 <div className="selection-trigger" onClick={() => setTargetSelectionModal({ show: true, type: 'teacher' })}>
                                     {selectedTeacherName ? <span style={{color: '#38bdf8'}}>👨‍🏫 {selectedTeacherName}</span> : '🔍 اضغط لاختيار المدرس...'}
                                 </div>
                             )}

                             {formData.link_type === 'course' && (
                                 <div className="selection-trigger" onClick={() => setTargetSelectionModal({ show: true, type: 'course' })}>
                                     {selectedCourseName ? <span style={{color: '#4ade80'}}>📦 {selectedCourseName}</span> : '🔍 اضغط لاختيار الكورس...'}
                                 </div>
                             )}

                             {formData.link_type === 'subject' && (
                                 <div className="selection-trigger" onClick={() => setTargetSelectionModal({ show: true, type: 'subject' })}>
                                     {selectedSubjectName ? <span style={{color: '#facc15'}}>📚 {selectedSubjectName}</span> : '🔍 اضغط لاختيار المادة...'}
                                 </div>
                             )}
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
                             <div className="form-group" style={{gridColumn: '1 / -1'}}>
                                 <label>صلاحية الكوبون بعد الفوز (أيام)</label>
                                 <input className="input" type="number" min="1" required value={formData.validity_days} onChange={e => setFormData({...formData, validity_days: e.target.value})} />
                             </div>
                         </div>
                     </div>
                 )}

                 <div className="form-group mt-2">
                     <label style={{display:'flex', alignItems:'center', gap:'10px', cursor:'pointer', padding:'12px', background:'rgba(255,255,255,0.05)', borderRadius:'8px', width:'100%'}}>
                         <input type="checkbox" style={{width:'20px', height:'20px', accentColor: '#4ade80'}} checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} />
                         تفعيل الجائزة ضمن السحب المباشر
                     </label>
                 </div>
                 
                 <div className="modal-footer">
                    <button type="button" className="btn cancel" onClick={() => setShowModal(false)}>إلغاء</button>
                    <button type="submit" className="btn primary">حفظ التغييرات 💾</button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* ✅ نافذة اختيار الهدف الاحترافية (Target Selection Modal) */}
      {targetSelectionModal.show && (
          <div className="modal-overlay blur-bg" style={{ zIndex: 1100 }} onClick={() => setTargetSelectionModal({ show: false, type: '' })}>
              <div className="modal-box target-selection-box" onClick={e => e.stopPropagation()}>
                  <div className="modal-head" style={{borderBottom: '1px solid #334155', paddingBottom: '15px', background: 'transparent'}}>
                      <h3 style={{margin: 0, fontSize: '1.2rem'}}>
                          {targetSelectionModal.type === 'teacher' ? '👨‍🏫 اختر المدرس' :
                           targetSelectionModal.type === 'course' ? '📦 اختر الكورس' : '📚 اختر المادة'}
                      </h3>
                      <button className="close-btn" onClick={() => setTargetSelectionModal({ show: false, type: '' })}>✕</button>
                  </div>
                  
                  <div className="target-list">
                      {targetSelectionModal.type === 'teacher' && teachers.map(t => (
                          <div key={t.id} className={`target-item ${formData.teacher_id == t.id ? 'active' : ''}`} onClick={() => { setFormData({...formData, teacher_id: t.id}); setTargetSelectionModal({show: false, type: ''}); }}>
                              <span>{t.name}</span>
                          </div>
                      ))}

                      {targetSelectionModal.type === 'course' && courses.map(c => (
                          <div key={c.id} className={`target-item ${formData.course_id == c.id ? 'active' : ''}`} onClick={() => { setFormData({...formData, course_id: c.id}); setTargetSelectionModal({show: false, type: ''}); }}>
                              <span>{c.title}</span>
                          </div>
                      ))}

                      {targetSelectionModal.type === 'subject' && courses.map(c => (
                          <div key={c.id} className="subject-group">
                              <div className="subject-group-title">كورس: {c.title}</div>
                              {c.subjects?.map(s => (
                                  <div key={s.id} className={`target-item subject ${formData.subject_id == s.id ? 'active' : ''}`} onClick={() => { setFormData({...formData, subject_id: s.id}); setTargetSelectionModal({show: false, type: ''}); }}>
                                      <span>{s.title}</span>
                                  </div>
                              ))}
                          </div>
                      ))}
                      
                      {targetSelectionModal.type === 'teacher' && teachers.length === 0 && <p style={{textAlign:'center', color:'#94a3b8', padding: '20px'}}>لا يوجد مدرسين مسجلين.</p>}
                      {['course', 'subject'].includes(targetSelectionModal.type) && courses.length === 0 && <p style={{textAlign:'center', color:'#94a3b8', padding: '20px'}}>لا توجد كورسات مسجلة حالياً.</p>}
                  </div>
              </div>
          </div>
      )}

      {/* نافذة التأكيد */}
      {confirmData.show && (
          <div className="modal-overlay" style={{ zIndex: 1200 }}>
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
        .sub-txt { font-size: 0.85em; color: #94a3b8; }
        .stock-badge { background: rgba(56, 189, 248, 0.1); color: #38bdf8; padding: 4px 12px; border-radius: 20px; font-weight: bold; }
        .type-tag { padding: 4px 8px; border-radius: 6px; font-size: 0.9rem; font-weight: bold; background: #334155; }
        .type-tag.coupon { color: #4ade80; background: rgba(74, 222, 128, 0.1); }
        .type-tag.material { color: #facc15; background: rgba(250, 204, 21, 0.1); }
        .actions-cell { display: flex; gap: 8px; }
        .icon-btn { background: rgba(255,255,255,0.05); border: none; width: 35px; height: 35px; border-radius: 8px; cursor: pointer; }
        .icon-btn.edit { background: rgba(250, 204, 21, 0.1); } .icon-btn.delete { background: rgba(239, 68, 68, 0.1); }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 1000; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(4px); }
        .modal-box { background: #0f172a; width: 95%; max-width: 600px; border-radius: 16px; border: 1px solid #334155; overflow: hidden; max-height: 90vh; display: flex; flex-direction: column; }
        .confirm-box { max-width: 400px; padding: 25px; text-align: center; display: block; }
        .modal-head { display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid #334155; background: #1e293b; flex-shrink: 0; }
        .modal-head h3 { margin: 0; color: white; }
        .close-btn { background: none; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer; }
        .modal-body { padding: 20px; overflow-y: auto; }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; color: #94a3b8; margin-bottom: 8px; font-size: 0.9rem; }
        .input { width: 100%; padding: 12px; background: #1e293b; border: 1px solid #475569; border-radius: 8px; color: white; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .mt-2 { margin-top: 15px; }
        .coupon-box { background: rgba(56, 189, 248, 0.05); border: 1px dashed rgba(56, 189, 248, 0.3); padding: 15px; border-radius: 12px; margin-top: 15px; }
        .coupon-box h4 { margin: 0 0 15px 0; color: #38bdf8; }
        .modal-footer { padding-top: 20px; margin-top: 10px; border-top: 1px solid #334155; display: flex; justify-content: flex-end; gap: 10px; flex-shrink: 0; }
        .modal-footer.centered { justify-content: center; border: none; }
        .toast { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%) translateY(100px); background: #333; color: white; padding: 12px 25px; border-radius: 50px; font-weight: bold; box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 2000; transition: 0.4s; opacity: 0; }
        .toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }
        .toast.success { background: #22c55e; color: #0f172a; }
        .toast.error { background: #ef4444; color: white; }

        /* ✅ تنسيقات نافذة الاختيار الاحترافية */
        .selection-trigger {
            width: 100%; padding: 15px; border-radius: 8px; border: 1px dashed #38bdf8;
            background: rgba(56,189,248,0.05); color: #94a3b8; cursor: pointer;
            text-align: center; font-weight: bold; transition: 0.3s; font-size: 1rem;
        }
        .selection-trigger:hover { background: rgba(56,189,248,0.1); border-style: solid; }
        
        .target-selection-box { max-width: 550px !important; padding: 20px; background: #1e293b; }
        .target-list { overflow-y: auto; margin-top: 15px; display: flex; flex-direction: column; gap: 8px; padding-right: 5px; max-height: 60vh; }
        .target-list::-webkit-scrollbar { width: 6px; }
        .target-list::-webkit-scrollbar-track { background: #0f172a; border-radius: 10px; }
        .target-list::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .target-item { padding: 12px 15px; background: #0f172a; border: 1px solid #334155; border-radius: 8px; cursor: pointer; transition: 0.2s; color: #e2e8f0; font-weight: bold; display: flex; align-items: center;}
        .target-item:hover { border-color: #38bdf8; background: rgba(56,189,248,0.05); color: white;}
        .target-item.active { background: #38bdf8; color: #0f172a; border-color: #38bdf8; }
        .subject-group { margin-bottom: 12px; background: #162032; padding: 15px; border-radius: 12px; border: 1px solid #1e293b;}
        .subject-group-title { font-size: 0.95rem; color: #38bdf8; margin-bottom: 12px; font-weight: bold; border-bottom: 1px dashed #334155; padding-bottom: 8px;}
        .target-item.subject { margin-bottom: 8px; background: rgba(15, 23, 42, 0.5); }
      `}</style>
    </SuperLayout>
  );
}
