import AdminLayout from '../../components/AdminLayout';
import { useState, useEffect } from 'react';

export default function AdminHome() {
  // 1. حالات الإحصائيات العامة
  const [stats, setStats] = useState({ requests: 0, users: 0, courses: 0, earnings: 0 });
  const [loading, setLoading] = useState(true);

  // 2. حالات إعدادات الدفع
  const [paymentSettings, setPaymentSettings] = useState({ vodafone: '', instapayNumber: '', instapayLink: '' });
  const [savingSettings, setSavingSettings] = useState(false);
  const [toast, setToast] = useState(null);

  // 3. (جديد) حالات نافذة تفاصيل الاشتراكات
  const [showSubModal, setShowSubModal] = useState(false);
  const [subStats, setSubStats] = useState({ courses: [], subjects: [] });
  const [loadingSubs, setLoadingSubs] = useState(false);

  // دالة عرض الإشعارات
  const showToast = (msg, type = 'success') => {
      setToast({ msg, type });
      setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    // أ) جلب الإحصائيات العامة
    fetch('/api/admin/stats')
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load stats", err);
        setLoading(false);
      });

    // ب) جلب إعدادات الدفع
    fetch('/api/admin/settings')
      .then(res => res.json())
      .then(data => {
          setPaymentSettings({
              vodafone: data.vodafone_cash_number || '',
              instapayNumber: data.instapay_number || '',
              instapayLink: data.instapay_link || ''
          });
      });
  }, []);

  // (جديد) دالة جلب تفاصيل الاشتراكات عند الضغط على البطاقة
  const handleStudentsClick = async () => {
    setShowSubModal(true);
    setLoadingSubs(true);
    try {
        const res = await fetch('/api/admin/subscription-stats');
        const data = await res.json();
        if (res.ok) {
            setSubStats(data);
        } else {
            showToast('فشل جلب التفاصيل', 'error');
        }
    } catch (e) {
        showToast('خطأ في الاتصال', 'error');
    }
    setLoadingSubs(false);
  };

  // دالة حفظ الإعدادات
  const saveSettings = async () => {
      setSavingSettings(true);
      try {
          const res = await fetch('/api/admin/settings', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify(paymentSettings)
          });
          if (res.ok) showToast('تم حفظ إعدادات الدفع بنجاح');
          else showToast('حدث خطأ أثناء الحفظ', 'error');
      } catch (e) { showToast('خطأ في الاتصال', 'error'); }
      setSavingSettings(false);
  };

  return (
    <AdminLayout title="الرئيسية">
      {toast && <div className={`alert-toast ${toast.type}`}>{toast.msg}</div>}

      <h1 style={{marginBottom:'30px', borderBottom:'1px solid #334155', paddingBottom:'15px'}}>أهلاً بك في لوحة التحكم </h1>
      
      {/* --- القسم الأول: الإحصائيات --- */}
      <div className="stats-grid">
        {/* بطاقة الطلبات */}
        <div className="stat-card" onClick={() => window.location.href='/admin/requests'} style={{cursor: 'pointer'}}>
            <h3>الطلبات المعلقة</h3>
            <div className="num yellow">
                {loading ? '...' : stats.requests}
            </div>
            <p>بانتظار المراجعة</p>
        </div>

        {/* (معدل) بطاقة الطلاب - أصبحت قابلة للضغط */}
        <div className="stat-card clickable-card" onClick={handleStudentsClick}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <h3>إجمالي الطلاب</h3>
                <span style={{fontSize:'12px', color:'#38bdf8'}}>عرض التفاصيل 🔍</span>
            </div>
            <div className="num blue">
                {loading ? '...' : stats.users}
            </div>
            <p>مستخدم نشط</p>
        </div>

        {/* بطاقة الكورسات */}
        <div className="stat-card">
            <h3>الكورسات المتاحة</h3>
            <div className="num green">
                {loading ? '...' : stats.courses}
            </div>
            <p>كورس تعليمي</p>
        </div>

        {/* بطاقة الأرباح */}
        <div className="stat-card">
            <h3>إجمالي الأرباح</h3>
            <div className="num pink">
                {loading ? '...' : `${stats.earnings} ج.م`}
            </div>
            <p>من الطلبات المقبولة</p>
        </div>
      </div>

      {/* --- القسم الثاني: إعدادات الدفع --- */}
      <div className="settings-panel">
          <h2 className="panel-title">💳 إعدادات الدفع (تظهر للطلاب في المتجر)</h2>
          
          <div className="settings-grid">
              <div className="form-group">
                  <label>رقم فودافون كاش</label>
                  <input 
                    className="input" 
                    value={paymentSettings.vodafone} 
                    onChange={e => setPaymentSettings({...paymentSettings, vodafone: e.target.value})} 
                    placeholder="010xxxxxxxxx" 
                  />
              </div>

              <div className="form-group">
                  <label>رقم إنستا باي (InstaPay)</label>
                  <input 
                    className="input" 
                    value={paymentSettings.instapayNumber} 
                    onChange={e => setPaymentSettings({...paymentSettings, instapayNumber: e.target.value})} 
                    placeholder="name@instapay" 
                  />
              </div>

              <div className="form-group full-width">
                  <label>رابط إنستا باي (اختياري - للدفع المباشر)</label>
                  <input 
                    className="input" 
                    value={paymentSettings.instapayLink} 
                    onChange={e => setPaymentSettings({...paymentSettings, instapayLink: e.target.value})} 
                    placeholder="https://instapay.com/..." 
                    dir="ltr"
                  />
              </div>
          </div>

          <button className="save-btn" onClick={saveSettings} disabled={savingSettings}>
              {savingSettings ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </button>
      </div>

      {/* (جديد) نافذة تفاصيل الاشتراكات */}
      {showSubModal && (
        <div className="modal-overlay" onClick={() => setShowSubModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>📊 تفاصيل الاشتراكات</h3>
                    <button className="close-btn" onClick={() => setShowSubModal(false)}>✕</button>
                </div>
                
                {loadingSubs ? (
                    <div style={{padding:'40px', textAlign:'center', color:'#38bdf8'}}>جاري تحميل البيانات...</div>
                ) : (
                    <div className="modal-body scrollable">
                        
                        {/* قسم الكورسات الكاملة */}
                        <div className="section">
                            <h4 className="section-title">📦 كورسات كاملة</h4>
                            {subStats.courses.length > 0 ? (
                                <ul className="stats-list">
                                    {subStats.courses.map((c, i) => (
                                        <li key={i}>
                                            <span className="name">{c.title}</span>
                                            <span className="count badge-green">{c.count} طالب</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : <p className="empty-text">لا توجد اشتراكات كورسات</p>}
                        </div>

                        <hr className="divider" />

                        {/* قسم المواد المنفصلة */}
                        <div className="section">
                            <h4 className="section-title">📄 مواد منفصلة (بدون الكورس الكامل)</h4>
                            {subStats.subjects.length > 0 ? (
                                <ul className="stats-list">
                                    {subStats.subjects.map((s, i) => (
                                        <li key={i}>
                                            <span className="name">{s.title}</span>
                                            <span className="count badge-blue">{s.count} طالب</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : <p className="empty-text">لا توجد اشتراكات مواد منفصلة</p>}
                        </div>

                    </div>
                )}
            </div>
        </div>
      )}

      <style jsx>{`
        /* تنسيقات الشبكة والبطاقات */
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .stat-card { background: #1e293b; padding: 25px; border-radius: 12px; border: 1px solid #334155; box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: transform 0.2s, border-color 0.2s; }
        .stat-card h3 { color: #94a3b8; margin-bottom: 10px; font-size: 0.9em; margin-top: 0; }
        .stat-card p { font-size: 12px; color: #64748b; margin: 0; }
        
        /* تأثير الضغط للبطاقة الجديدة */
        .clickable-card { cursor: pointer; position: relative; }
        .clickable-card:hover { transform: translateY(-5px); border-color: #38bdf8; background: #252f45; }
        
        .num { font-size: 32px; fontWeight: bold; margin-bottom: 5px; }
        .num.yellow { color: #facc15; } .num.blue { color: #38bdf8; } .num.green { color: #4ade80; } .num.pink { color: #f472b6; }

        /* تنسيقات قسم الإعدادات */
        .settings-panel { background: #1e293b; padding: 25px; border-radius: 12px; border: 1px solid #334155; margin-top: 20px; }
        .panel-title { color: #38bdf8; margin-top: 0; margin-bottom: 20px; font-size: 1.3rem; border-bottom: 1px solid #334155; padding-bottom: 10px; }
        
        .settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        .form-group { display: flex; flex-direction: column; gap: 8px; }
        .form-group.full-width { grid-column: span 2; }
        
        .form-group label { color: #cbd5e1; font-size: 0.9rem; font-weight: bold; }
        .input { padding: 12px; background: #0f172a; border: 1px solid #475569; border-radius: 8px; color: white; outline: none; transition: border-color 0.2s; }
        .input:focus { border-color: #38bdf8; }

        .save-btn { background: #22c55e; color: #0f172a; border: none; padding: 12px 30px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s; float: left; }
        .save-btn:hover:not(:disabled) { background: #4ade80; transform: translateY(-2px); }
        .save-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        /* التوست */
        .alert-toast { position: fixed; bottom: 30px; left: 30px; padding: 12px 25px; border-radius: 8px; color: white; font-weight: bold; z-index: 3000; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
        .alert-toast.success { background: #22c55e; color: #0f172a; }
        .alert-toast.error { background: #ef4444; }

        /* (جديد) تنسيقات النافذة المنبثقة */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 2000; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(5px); }
        .modal-content { background: #1e293b; width: 90%; max-width: 500px; max-height: 85vh; border-radius: 16px; border: 1px solid #475569; display: flex; flex-direction: column; box-shadow: 0 20px 50px rgba(0,0,0,0.5); animation: popIn 0.3s; }
        .modal-header { padding: 20px; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; background: #0f172a; border-radius: 16px 16px 0 0; }
        .modal-header h3 { margin: 0; color: white; }
        .close-btn { background: none; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer; }
        
        .modal-body { padding: 20px; overflow-y: auto; }
        .section-title { color: #94a3b8; margin: 0 0 15px 0; font-size: 0.95rem; border-right: 3px solid #38bdf8; padding-right: 10px; }
        .divider { border: 0; border-top: 1px dashed #334155; margin: 20px 0; }
        .empty-text { text-align: center; color: #64748b; font-size: 0.9em; padding: 10px; }

        .stats-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
        .stats-list li { display: flex; justify-content: space-between; align-items: center; background: #0f172a; padding: 12px; border-radius: 8px; border: 1px solid #334155; }
        .stats-list li .name { color: #e2e8f0; font-weight: 500; }
        .badge-green { background: rgba(34, 197, 94, 0.1); color: #4ade80; padding: 4px 10px; border-radius: 20px; font-size: 0.85em; font-weight: bold; }
        .badge-blue { background: rgba(56, 189, 248, 0.1); color: #38bdf8; padding: 4px 10px; border-radius: 20px; font-size: 0.85em; font-weight: bold; }

        @keyframes popIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }

        @media (max-width: 600px) {
            .settings-grid { grid-template-columns: 1fr; }
            .form-group.full-width { grid-column: span 1; }
            .save-btn { width: 100%; text-align: center; }
        }
      `}</style>
    </AdminLayout>
  );
}
