import SuperLayout from '../../../components/SuperLayout';
import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function SuperSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // 1. حالة الإعدادات العامة (مضاف إليها player_settings)
  const [settings, setSettings] = useState({
    platform_percentage: '',
    support_telegram: '',
    support_whatsapp: '',
    free_mode: false,
    player_settings: {
      player_1: { enabled: true, name: "المشغل الأساسي", description: "سريع ومستقر (ينصح به)", order: 1 },
      player_2: { enabled: true, name: "سيرفر احتياطي", description: "استخدمه في حال التقطيع", order: 2 },
      player_3: { enabled: true, name: "مشغل يوتيوب", description: "جودة متعددة", order: 3 },
      downloads: { video_enabled: true, pdf_enabled: true }
    }
  });

  // قائمة توضيحية لأسماء المشغلات في لوحة التحكم
  const playersList = [
    { id: 'player_1', title: 'المشغل الأول (الأساسي)' },
    { id: 'player_2', title: 'المشغل الثاني (الاحتياطي)' },
    { id: 'player_3', title: 'المشغل الثالث (اليوتيوب)' },
  ];

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
        setSettings(prev => ({
            ...prev,
            platform_percentage: data.platform_percentage || '10',
            support_telegram: data.support_telegram || '',
            support_whatsapp: data.support_whatsapp || '',
            free_mode: data.free_mode === 'true' || data.free_mode === true,
            // دمج الإعدادات القادمة من السيرفر مع الافتراضية
            player_settings: data.player_settings ? { ...prev.player_settings, ...data.player_settings } : prev.player_settings
        }));
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

  // دالة تحديث بيانات مشغل معين
  const handlePlayerChange = (playerId, field, value) => {
    setSettings(prev => ({
      ...prev,
      player_settings: {
        ...prev.player_settings,
        [playerId]: {
          ...prev.player_settings[playerId],
          [field]: value
        }
      }
    }));
  };

  // دالة تحديث إعدادات التحميل
  const handleDownloadChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      player_settings: {
        ...prev.player_settings,
        downloads: {
          ...prev.player_settings.downloads,
          [field]: value
        }
      }
    }));
  };

  // --- دوال إصدارات التطبيق ---
  const fetchVersions = async () => {
    try {
      const res = await fetch('/api/dashboard/super/app-versions');
      if (res.ok) {
        const data = await res.json();
        setVersions(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
      showToast('فشل جلب بيانات الإصدارات', 'error');
    }
  };

  const handleVersionChange = (index, field, value) => {
    const updatedVersions = [...versions];
    updatedVersions[index] = { ...updatedVersions[index], [field]: value };
    setVersions(updatedVersions);
  };

  const saveVersion = async (index) => {
    const versionData = versions[index];
    setLoadingVersions(true);
    try {
      const res = await fetch('/api/dashboard/super/app-versions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(versionData)
      });

      if (res.ok) {
        showToast(`تم تحديث إعدادات ${versionData.platform === 'android' ? 'الاندرويد' : 'الايفون'} بنجاح ✅`);
        fetchVersions();
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
          <p>التحكم في المشغلات، التحميل، النسب المالية، وإصدارات التطبيق</p>
        </div>

        {loading ? (
          <div className="loading">جاري تحميل الإعدادات...</div>
        ) : (
          <div className="settings-grid">
            
            {/* ================= قسم الإعدادات العامة ================= */}
            <form onSubmit={handleSaveSettings} className="settings-grid">
              
              {/* 1. وضع التطبيق */}
              <div className="card highlight-card">
                <div className="card-header">
                  <h3>🔓 وضع التطبيق (App Mode)</h3>
                </div>
                <div className="card-body">
                  <label className="checkbox-label large">
                    <input 
                      type="checkbox" 
                      checked={settings.free_mode} 
                      onChange={(e) => setSettings({...settings, free_mode: e.target.checked})}
                    />
                    <span>تفعيل الوضع المجاني (Free Mode)</span>
                  </label>
                  <p className="hint">
                    عند تفعيل هذا الوضع: تختفي الأسعار من التطبيق، ويتحول زر "شراء" إلى "تفعيل مجاني". 
                    <br/>⚠️ تأكد من تفعيل هذا الوضع فقط عند الحاجة.
                  </p>
                </div>
              </div>

              {/* ✅ 2. إعدادات المشغلات */}
              <div className="card">
                <div className="card-header">
                  <h3>▶️ إعدادات مشغلات الفيديو (Video Players)</h3>
                </div>
                <div className="card-body">
                  <p className="hint" style={{marginBottom: '20px'}}>
                    يمكنك هنا تفعيل أو إيقاف المشغلات، وتغيير أسمائها، وتغيير ترتيبها في نافذة الطالب (الرقم الأقل يظهر أولاً).
                  </p>
                  
                  {playersList.map((p) => {
                    const pData = settings.player_settings[p.id];
                    return (
                      <div key={p.id} className="player-config-box">
                        <h4>{p.title}</h4>
                        <label className="checkbox-label" style={{marginBottom: '15px'}}>
                          <input 
                            type="checkbox" 
                            checked={pData.enabled} 
                            onChange={e => handlePlayerChange(p.id, 'enabled', e.target.checked)}
                          />
                          <span style={{ color: pData.enabled ? '#4ade80' : '#ef4444' }}>
                            {pData.enabled ? 'مفعل ويظهر للطلاب' : 'مخفي ومعطل'}
                          </span>
                        </label>
                        <div className="grid-3">
                          <div className="form-group">
                            <label>الاسم الذي يظهر للطلاب</label>
                            <input 
                              type="text" 
                              className="input-field" 
                              value={pData.name} 
                              onChange={e => handlePlayerChange(p.id, 'name', e.target.value)} 
                              required 
                            />
                          </div>
                          <div className="form-group">
                            <label>الوصف أسفل الاسم</label>
                            <input 
                              type="text" 
                              className="input-field" 
                              value={pData.description} 
                              onChange={e => handlePlayerChange(p.id, 'description', e.target.value)} 
                            />
                          </div>
                          <div className="form-group">
                            <label>الترتيب</label>
                            <input 
                              type="number" 
                              className="input-field ltr text-center" 
                              value={pData.order} 
                              onChange={e => handlePlayerChange(p.id, 'order', Number(e.target.value))} 
                              min="1" 
                              required 
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ✅ 3. إعدادات التحميل */}
              <div className="card">
                <div className="card-header">
                  <h3>⬇️ إعدادات التحميل (Offline Download)</h3>
                </div>
                <div className="card-body">
                  <label className="checkbox-label large" style={{marginBottom: '15px'}}>
                    <input 
                      type="checkbox" 
                      checked={settings.player_settings.downloads.video_enabled} 
                      onChange={e => handleDownloadChange('video_enabled', e.target.checked)} 
                    />
                    <span>السماح للطلاب بتحميل الفيديوهات</span>
                  </label>
                  <label className="checkbox-label large">
                    <input 
                      type="checkbox" 
                      checked={settings.player_settings.downloads.pdf_enabled} 
                      onChange={e => handleDownloadChange('pdf_enabled', e.target.checked)} 
                    />
                    <span>السماح للطلاب بتحميل ملفات الـ PDF</span>
                  </label>
                </div>
              </div>

              {/* 4. الإعدادات المالية */}
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

              {/* 5. روابط الدعم الفني */}
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

              {/* زر الحفظ للإعدادات العامة (Sticky Button) */}
              <div className="actions" style={{ position: 'sticky', bottom: '20px', zIndex: 100 }}>
                <button type="submit" className="save-btn" disabled={saving} style={{ width: '100%', padding: '16px', fontSize: '1.2rem' }}>
                  {saving ? 'جاري الحفظ...' : '💾 حفظ الإعدادات العامة (المشغلات والتفاصيل)'}
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
        .highlight-card { border: 1px solid #38bdf8; box-shadow: 0 0 10px rgba(56, 189, 248, 0.1); }
        .card-header { background: #0f172a; padding: 15px 20px; border-bottom: 1px solid #334155; }
        .card-header h3 { margin: 0; color: #38bdf8; font-size: 1.1rem; }
        .card-body { padding: 25px; }

        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 100px; gap: 15px; }
        @media (max-width: 600px) { 
          .grid-2, .grid-3 { grid-template-columns: 1fr; } 
        }

        /* 🟢 تنسيقات بطاقة المشغل */
        .player-config-box { background: #0f172a; padding: 15px; border-radius: 8px; border: 1px solid #334155; margin-bottom: 15px; }
        .player-config-box:last-child { margin-bottom: 0; }
        .player-config-box h4 { margin-top: 0; color: #f8fafc; border-bottom: 1px solid #334155; padding-bottom: 10px; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;}
        .player-config-box h4::before { content: '🎬'; }

        .form-group { margin-bottom: 20px; }
        .form-group:last-child { margin-bottom: 0; }
        
        label { display: block; color: #e2e8f0; margin-bottom: 8px; font-weight: bold; font-size: 0.95rem; }
        
        .input-wrapper { position: relative; }
        .input-field { width: 100%; padding: 12px; background: #0f172a; border: 1px solid #475569; border-radius: 8px; color: white; font-size: 1rem; transition: 0.2s; }
        .input-field:focus { border-color: #38bdf8; outline: none; box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2); }
        .input-field.ltr { direction: ltr; text-align: left; }
        .input-field.text-center { text-align: center; font-weight: bold; }
        
        .suffix { position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #64748b; font-weight: bold; }

        small, .hint { display: block; margin-top: 8px; color: #64748b; font-size: 0.85rem; line-height: 1.5; }
        .hint { color: #94a3b8; }

        .actions { margin-top: 10px; display: flex; justify-content: flex-end; }
        .row-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; border-top: 1px solid #334155; padding-top: 20px; }

        .checkbox-label { display: flex; align-items: center; gap: 10px; cursor: pointer; color: #f8fafc; font-weight: bold; }
        .checkbox-label.large { font-size: 1.1rem; color: #38bdf8; }
        .checkbox-label input { width: 18px; height: 18px; cursor: pointer; accent-color: #38bdf8; }
        .checkbox-label.large input { width: 22px; height: 22px; }

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
