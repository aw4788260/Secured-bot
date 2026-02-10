import SuperLayout from '../../../components/SuperLayout';
import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function SuperSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // 1. حالة الإعدادات العامة
  const [settings, setSettings] = useState({
    platform_percentage: '',
    support_telegram: '',
    support_whatsapp: ''
  });

  // 2. حالة إصدارات التطبيق
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  // دالة عرض التنبيهات
  const showToast = (msg, type = 'success') => {
    setToast({ show: true, message: msg, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };

  // جلب البيانات عند التحميل
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      await Promise.all([fetchSettings(), fetchVersions()]);
      setLoading(false);
    };
    initData();
  }, []);

  // --- دوال الإعدادات العامة ---
  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/dashboard/super/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings({
            platform_percentage: data.platform_percentage || '10',
            support_telegram: data.support_telegram || '',
            support_whatsapp: data.support_whatsapp || ''
        });
      }
    } catch (err) {
      console.error(err);
      showToast('فشل جلب الإعدادات العامة', 'error');
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/dashboard/super/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const result = await res.json();
      if (res.ok) {
        showToast('تم حفظ الإعدادات العامة بنجاح ✅');
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      showToast('حدث خطأ أثناء حفظ الإعدادات', 'error');
    } finally {
      setSaving(false);
    }
  };

  // --- دوال إصدارات التطبيق ---
  const fetchVersions = async () => {
    try {
      const res = await fetch('/api/dashboard/super/app-versions');
      if (res.ok) {
        const data = await res.json();
        // نتأكد أن البيانات مصفوفة
        setVersions(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
      showToast('فشل جلب بيانات الإصدارات', 'error');
    }
  };

  // تحديث القيم في الـ State عند الكتابة
  const handleVersionChange = (index, field, value) => {
    const updatedVersions = [...versions];
    updatedVersions[index] = { ...updatedVersions[index], [field]: value };
    setVersions(updatedVersions);
  };

  // حفظ نسخة محددة (أندرويد أو آيفون)
  const saveVersion = async (index) => {
    const versionData = versions[index];
    setLoadingVersions(true); // نستخدم مؤشر تحميل بسيط أو يمكن استخدام نفس saving
    try {
      const res = await fetch('/api/dashboard/super/app-versions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(versionData)
      });

      if (res.ok) {
        showToast(`تم تحديث إعدادات ${versionData.platform === 'android' ? 'الاندرويد' : 'الايفون'} بنجاح ✅`);
        fetchVersions(); // تحديث البيانات للتأكيد
      } else {
        showToast('حدث خطأ أثناء التحديث', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('خطأ في الاتصال', 'error');
    } finally {
      setLoadingVersions(false);
    }
  };

  return (
    <SuperLayout title="إعدادات المنصة">
      <Head>
        <title>إعدادات النظام | Super Admin</title>
      </Head>

      <div className={`toast ${toast.show ? 'show' : ''} ${toast.type}`}>
        {toast.message}
      </div>

      <div className="settings-container">
        <div className="header">
          <h1>⚙️ إعدادات المنصة العامة</h1>
          <p>التحكم في النسب المالية، روابط الدعم، وإصدارات التطبيق</p>
        </div>

        {loading ? (
          <div className="loading">جاري تحميل الإعدادات...</div>
        ) : (
          <div className="settings-grid">
            
            {/* ================= قسم الإعدادات العامة ================= */}
            <form onSubmit={handleSaveSettings} className="settings-grid">
              {/* بطاقة الإعدادات المالية */}
              <div className="card">
                <div className="card-header">
                  <h3>💰 الإعدادات المالية</h3>
                </div>
                <div className="card-body">
                  <div className="form-group">
                    <label>نسبة المنصة من مبيعات المدرسين (%)</label>
                    <div className="input-wrapper">
                      <input 
                        type="number" 
                        className="input-field"
                        placeholder="مثال: 10"
                        value={settings.platform_percentage}
                        onChange={(e) => setSettings({...settings, platform_percentage: e.target.value})}
                        min="0"
                        max="100"
                        required
                      />
                      <span className="suffix">%</span>
                    </div>
                    <small>يتم خصم هذه النسبة تلقائياً من إجمالي مبيعات المدرس عند حساب الأرباح.</small>
                  </div>
                </div>
              </div>

              {/* بطاقة الدعم الفني */}
              <div className="card">
                <div className="card-header">
                  <h3>🎧 روابط الدعم الفني</h3>
                </div>
                <div className="card-body">
                  <div className="form-group">
                    <label>رابط قناة/جروب التليجرام (Telegram)</label>
                    <input 
                      type="url" 
                      className="input-field ltr"
                      placeholder="https://t.me/..."
                      value={settings.support_telegram}
                      onChange={(e) => setSettings({...settings, support_telegram: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label>رابط التواصل واتساب (WhatsApp)</label>
                    <input 
                      type="url" 
                      className="input-field ltr"
                      placeholder="https://wa.me/201xxxxxxx"
                      value={settings.support_whatsapp}
                      onChange={(e) => setSettings({...settings, support_whatsapp: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* زر الحفظ للإعدادات العامة */}
              <div className="actions">
                <button type="submit" className="save-btn" disabled={saving}>
                  {saving ? 'جاري الحفظ...' : '💾 حفظ الإعدادات العامة'}
                </button>
              </div>
            </form>

            <div className="divider"></div>

            {/* ================= قسم إصدارات التطبيق ================= */}
            <div className="header" style={{marginTop: '20px'}}>
              <h1>📱 إصدارات التطبيق (Versions)</h1>
              <p>التحكم في التحديثات الإجبارية وأرقام الإصدارات</p>
            </div>

            {versions.map((ver, index) => (
              <div key={ver.id || index} className="card">
                <div className="card-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <h3>
                    {ver.platform === 'android' ? '🤖 Android Settings' : '🍎 iOS Settings'}
                  </h3>
                  {ver.force_update && <span className="badge-red">تحديث إجباري مفعل</span>}
                </div>
                <div className="card-body">
                  <div className="grid-2">
                    <div className="form-group">
                      <label>Latest Version (الحالي)</label>
                      <input 
                        type="text" 
                        className="input-field ltr"
                        value={ver.latest_version}
                        onChange={(e) => handleVersionChange(index, 'latest_version', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Min Version (للإجبار)</label>
                      <input 
                        type="text" 
                        className="input-field ltr"
                        value={ver.min_version}
                        onChange={(e) => handleVersionChange(index, 'min_version', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>رابط المتجر (Store URL)</label>
                    <input 
                      type="text" 
                      className="input-field ltr"
                      style={{fontSize: '0.9rem'}}
                      value={ver.store_url}
                      onChange={(e) => handleVersionChange(index, 'store_url', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>رسالة التحديث للمستخدم</label>
                    <textarea 
                      className="input-field"
                      rows="2"
                      value={ver.message}
                      onChange={(e) => handleVersionChange(index, 'message', e.target.value)}
                    />
                  </div>

                  <div className="row-actions">
                    <label className="checkbox-label">
                      <input 
                        type="checkbox" 
                        checked={ver.force_update} 
                        onChange={(e) => handleVersionChange(index, 'force_update', e.target.checked)}
                      />
                      <span>تفعيل التحديث الإجباري (Force Update)</span>
                    </label>

                    <button 
                      type="button" 
                      className="save-btn small" 
                      disabled={loadingVersions}
                      onClick={() => saveVersion(index)}
                    >
                      تحديث {ver.platform === 'android' ? 'Android' : 'iOS'}
                    </button>
                  </div>
                </div>
              </div>
            ))}

          </div>
        )}
      </div>

      <style jsx>{`
        .settings-container { max-width: 800px; margin: 0 auto; padding-bottom: 50px; }
        
        .header { margin-bottom: 30px; text-align: center; }
        .header h1 { color: #f8fafc; margin-bottom: 10px; }
        .header p { color: #94a3b8; }

        .divider { height: 1px; background: #334155; margin: 40px 0; }

        .settings-grid { display: flex; flex-direction: column; gap: 25px; }

        .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; overflow: hidden; }
        .card-header { background: #0f172a; padding: 15px 20px; border-bottom: 1px solid #334155; }
        .card-header h3 { margin: 0; color: #38bdf8; font-size: 1.1rem; }
        .card-body { padding: 25px; }

        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        @media (max-width: 600px) { .grid-2 { grid-template-columns: 1fr; } }

        .form-group { margin-bottom: 20px; }
        .form-group:last-child { margin-bottom: 0; }
        
        label { display: block; color: #e2e8f0; margin-bottom: 8px; font-weight: bold; font-size: 0.95rem; }
        
        .input-wrapper { position: relative; }
        .input-field { width: 100%; padding: 12px; background: #0f172a; border: 1px solid #475569; border-radius: 8px; color: white; font-size: 1rem; transition: 0.2s; }
        .input-field:focus { border-color: #38bdf8; outline: none; box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2); }
        .input-field.ltr { direction: ltr; text-align: left; }
        
        .suffix { position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #64748b; font-weight: bold; }

        small { display: block; margin-top: 8px; color: #64748b; font-size: 0.85rem; }

        .actions { margin-top: 10px; display: flex; justify-content: flex-end; }
        .row-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; border-top: 1px solid #334155; padding-top: 20px; }

        .checkbox-label { display: flex; align-items: center; gap: 10px; cursor: pointer; color: #f8fafc; }
        .checkbox-label input { width: 18px; height: 18px; cursor: pointer; }

        .save-btn { background: #22c55e; color: #0f172a; border: none; padding: 12px 30px; border-radius: 8px; font-weight: bold; font-size: 1.1rem; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .save-btn:hover:not(:disabled) { background: #4ade80; transform: translateY(-2px); }
        .save-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .save-btn.small { padding: 8px 20px; font-size: 0.95rem; }

        .badge-red { background: #ef4444; color: white; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: bold; }

        .loading { text-align: center; padding: 50px; color: #38bdf8; font-size: 1.2rem; }

        .toast { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%) translateY(100px); background: #333; color: white; padding: 12px 25px; border-radius: 50px; font-weight: bold; box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 2000; transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); opacity: 0; }
        .toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }
        .toast.success { background: #22c55e; color: #0f172a; }
        .toast.error { background: #ef4444; color: white; }
      `}</style>
    </SuperLayout>
  );
}
