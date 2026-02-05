import SuperLayout from '../../../components/SuperLayout';
import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function SuperSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // حالة الإعدادات
  const [settings, setSettings] = useState({
    platform_percentage: '',
    support_telegram: '',
    support_whatsapp: ''
  });

  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  // دالة عرض التنبيهات
  const showToast = (msg, type = 'success') => {
    setToast({ show: true, message: msg, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };

  // جلب البيانات عند التحميل
  useEffect(() => {
    fetchSettings();
  }, []);

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
      showToast('فشل جلب الإعدادات', 'error');
    } finally {
      setLoading(false);
    }
  };

  // معالجة الحفظ
  const handleSave = async (e) => {
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
        showToast('تم حفظ التعديلات بنجاح ✅');
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      showToast('حدث خطأ أثناء الحفظ', 'error');
    } finally {
      setSaving(false);
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
          <p>التحكم في النسب المالية وروابط الدعم الفني</p>
        </div>

        {loading ? (
          <div className="loading">جاري تحميل الإعدادات...</div>
        ) : (
          <form onSubmit={handleSave} className="settings-grid">
            
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

            {/* زر الحفظ */}
            <div className="actions">
              <button type="submit" className="save-btn" disabled={saving}>
                {saving ? 'جاري الحفظ...' : '💾 حفظ التغييرات'}
              </button>
            </div>

          </form>
        )}
      </div>

      <style jsx>{`
        .settings-container { max-width: 800px; margin: 0 auto; padding-bottom: 50px; }
        
        .header { margin-bottom: 30px; text-align: center; }
        .header h1 { color: #f8fafc; margin-bottom: 10px; }
        .header p { color: #94a3b8; }

        .settings-grid { display: flex; flex-direction: column; gap: 25px; }

        .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; overflow: hidden; }
        .card-header { background: #0f172a; padding: 15px 20px; border-bottom: 1px solid #334155; }
        .card-header h3 { margin: 0; color: #38bdf8; font-size: 1.1rem; }
        .card-body { padding: 25px; }

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
        .save-btn { background: #22c55e; color: #0f172a; border: none; padding: 12px 30px; border-radius: 8px; font-weight: bold; font-size: 1.1rem; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .save-btn:hover:not(:disabled) { background: #4ade80; transform: translateY(-2px); }
        .save-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        .loading { text-align: center; padding: 50px; color: #38bdf8; font-size: 1.2rem; }

        .toast { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%) translateY(100px); background: #333; color: white; padding: 12px 25px; border-radius: 50px; font-weight: bold; box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 2000; transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); opacity: 0; }
        .toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }
        .toast.success { background: #22c55e; color: #0f172a; }
        .toast.error { background: #ef4444; color: white; }
      `}</style>
    </SuperLayout>
  );
}
