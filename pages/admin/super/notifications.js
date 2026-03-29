import SuperLayout from '../../../components/SuperLayout';
import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function SuperNotifications() {
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState([]);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  // حالة الفورم
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    targetType: 'all', // all, course, subject, user
    targetId: '',      // Course ID or Subject ID
    userIdentifier: '' // Phone or Username
  });

  const showToast = (msg, type = 'success') => {
      setToast({ show: true, message: msg, type });
      setTimeout(() => setToast({ show: false, message: '', type: '' }), 3500);
  };

  // جلب الكورسات والمواد لتعبئة القوائم المنسدلة
  useEffect(() => {
    const fetchContent = async () => {
      try {
        const res = await fetch('/api/dashboard/super/content?type=all');
        if (res.ok) {
          const data = await res.json();
          setCourses(data.courses || []);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchContent();
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.body) return showToast('العنوان والنص مطلوبان', 'error');
    if (formData.targetType === 'user' && !formData.userIdentifier) return showToast('يرجى إدخال هاتف أو يوزرنيم الطالب', 'error');
    if (['course', 'subject'].includes(formData.targetType) && !formData.targetId) return showToast('يرجى تحديد المحتوى المستهدف', 'error');

    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/super/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const result = await res.json();

      if (res.ok && result.success) {
        showToast(result.message, 'success');
        setFormData({ ...formData, title: '', body: '', userIdentifier: '' }); // تصفير الحقول فقط
      } else {
        showToast(result.message || 'فشل الإرسال', 'error');
      }
    } catch (err) {
      showToast('خطأ في الاتصال بالخادم', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SuperLayout title="إرسال الإشعارات">
      <Head><title>نظام الإشعارات | Super Admin</title></Head>

      <div className={`toast ${toast.show ? 'show' : ''} ${toast.type}`}>
        {toast.message}
      </div>

      <div className="notifications-container">
        <div className="page-header">
          <h1>📢 نظام الإشعارات الذكي</h1>
          <p>أرسل تنبيهات فورية تظهر على هواتف الطلاب كإشعارات منبثقة (Push Notifications).</p>
        </div>

        <div className="grid-layout">
          {/* قسم الفورم */}
          <div className="card form-card">
            <h3>📝 تفاصيل الإشعار</h3>
            <form onSubmit={handleSend}>
              <div className="form-group">
                <label>عنوان الإشعار</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="مثال: تحديث هام جداً! 🚨" 
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  required 
                  maxLength={50}
                />
              </div>

              <div className="form-group">
                <label>محتوى الرسالة</label>
                <textarea 
                  className="input-field textarea" 
                  placeholder="اكتب تفاصيل التنبيه هنا لتظهر للطالب..." 
                  value={formData.body}
                  onChange={e => setFormData({...formData, body: e.target.value})}
                  required 
                  rows="4"
                  maxLength={200}
                ></textarea>
              </div>

              <div className="section-divider">🎯 تحديد المستهدفين (Target)</div>

              <div className="target-options">
                <label className={`radio-card ${formData.targetType === 'all' ? 'active' : ''}`}>
                  <input type="radio" name="target" checked={formData.targetType === 'all'} onChange={() => setFormData({...formData, targetType: 'all', targetId: ''})} />
                  <span className="icon">🌍</span>
                  <span className="text">الجميع (كل المسجلين)</span>
                </label>

                <label className={`radio-card ${formData.targetType === 'course' ? 'active' : ''}`}>
                  <input type="radio" name="target" checked={formData.targetType === 'course'} onChange={() => setFormData({...formData, targetType: 'course', targetId: ''})} />
                  <span className="icon">📦</span>
                  <span className="text">طلاب كورس معين</span>
                </label>

                <label className={`radio-card ${formData.targetType === 'subject' ? 'active' : ''}`}>
                  <input type="radio" name="target" checked={formData.targetType === 'subject'} onChange={() => setFormData({...formData, targetType: 'subject', targetId: ''})} />
                  <span className="icon">📚</span>
                  <span className="text">طلاب مادة معينة</span>
                </label>

                <label className={`radio-card ${formData.targetType === 'user' ? 'active' : ''}`}>
                  <input type="radio" name="target" checked={formData.targetType === 'user'} onChange={() => setFormData({...formData, targetType: 'user', targetId: ''})} />
                  <span className="icon">👤</span>
                  <span className="text">طالب محدد (خاص)</span>
                </label>
              </div>

              {/* التحديد الديناميكي */}
              <div className="dynamic-target-section">
                {formData.targetType === 'course' && (
                  <div className="form-group animate-slide">
                    <label>اختر الكورس المستهدف:</label>
                    <select className="input-field" required value={formData.targetId} onChange={e => setFormData({...formData, targetId: e.target.value})}>
                      <option value="">-- يرجى اختيار الكورس --</option>
                      {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                  </div>
                )}

                {formData.targetType === 'subject' && (
                  <div className="form-group animate-slide">
                    <label>اختر المادة المستهدفة:</label>
                    <select className="input-field" required value={formData.targetId} onChange={e => setFormData({...formData, targetId: e.target.value})}>
                      <option value="">-- يرجى اختيار المادة --</option>
                      {courses.map(c => (
                        <optgroup key={c.id} label={`كورس: ${c.title}`}>
                          {c.subjects?.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                )}

                {formData.targetType === 'user' && (
                  <div className="form-group animate-slide">
                    <label>معرف الطالب (هاتف أو يوزرنيم):</label>
                    <input 
                      type="text" 
                      className="input-field ltr" 
                      placeholder="01xxxxxxxxx أو username" 
                      value={formData.userIdentifier}
                      onChange={e => setFormData({...formData, userIdentifier: e.target.value})}
                      required 
                    />
                    <small className="hint">سيتم إرسال هذا الإشعار لهاتف هذا الطالب فقط (إذا كان مسجلاً بالمنصة ومُحملاً للتطبيق).</small>
                  </div>
                )}
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? <span className="spinner"></span> : '🚀 إرسال الإشعار الآن'}
              </button>
            </form>
          </div>

          {/* قسم المعاينة (Preview) */}
          <div className="preview-section">
            <h3 style={{color:'#94a3b8', textAlign:'center', marginTop:0}}>📱 معاينة شكل الإشعار</h3>
            <div className="phone-mockup">
              <div className="phone-screen">
                <div className="notification-bubble">
                  <div className="notif-header">
                    <div className="app-icon">م</div>
                    <span className="app-name">مــــداد</span>
                    <span className="time">الآن</span>
                  </div>
                  <div className="notif-content">
                    <h4>{formData.title || 'عنوان الإشعار يظهر هنا'}</h4>
                    <p>{formData.body || 'نص الرسالة يظهر هنا ليعطي الطالب فكرة سريعة عن المحتوى...'}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="info-box mt-4">
              <strong>💡 ملاحظة هامة:</strong>
              <p>الإشعارات تصل للطلاب حتى وإن كان التطبيق مغلقاً. عند الضغط على الإشعار سيتم توجيه الطالب تلقائياً لصفحة الإشعارات داخل التطبيق.</p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .notifications-container { padding-bottom: 50px; max-width: 1200px; margin: 0 auto; }
        .page-header { margin-bottom: 30px; border-bottom: 1px solid #334155; padding-bottom: 15px; }
        .page-header h1 { margin: 0 0 5px 0; color: #f8fafc; font-size: 1.8rem; }
        .page-header p { color: #94a3b8; margin: 0; }

        .grid-layout { display: grid; grid-template-columns: 1.5fr 1fr; gap: 30px; }
        @media (max-width: 900px) { .grid-layout { grid-template-columns: 1fr; } }

        .card { background: #1e293b; border-radius: 16px; padding: 25px; border: 1px solid #334155; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
        .card h3 { margin-top: 0; color: #38bdf8; border-bottom: 1px dashed #334155; padding-bottom: 15px; margin-bottom: 20px; }

        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; color: #cbd5e1; margin-bottom: 8px; font-weight: bold; font-size: 0.95rem; }
        .input-field { width: 100%; background: #0f172a; border: 1px solid #475569; padding: 14px; border-radius: 10px; color: white; font-size: 1rem; transition: 0.2s; font-family: inherit; }
        .input-field:focus { border-color: #38bdf8; outline: none; box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2); }
        .input-field.textarea { resize: vertical; min-height: 100px; line-height: 1.5; }
        .input-field.ltr { direction: ltr; font-family: monospace; font-size: 1.1rem; }

        .section-divider { margin: 30px 0 15px 0; color: #94a3b8; font-weight: bold; font-size: 0.9rem; text-transform: uppercase; }

        .target-options { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
        @media (max-width: 600px) { .target-options { grid-template-columns: 1fr; } }

        .radio-card { display: flex; align-items: center; gap: 10px; background: #0f172a; padding: 15px; border-radius: 10px; border: 1px solid #334155; cursor: pointer; transition: 0.2s; }
        .radio-card:hover { border-color: #64748b; }
        .radio-card.active { border-color: #38bdf8; background: rgba(56, 189, 248, 0.1); }
        .radio-card input { display: none; }
        .radio-card .icon { font-size: 1.5rem; }
        .radio-card .text { color: #e2e8f0; font-weight: bold; }
        .radio-card.active .text { color: #38bdf8; }

        .dynamic-target-section { min-height: 90px; }
        .animate-slide { animation: slideDown 0.3s ease-out; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

        .hint { display: block; margin-top: 8px; color: #94a3b8; font-size: 0.85rem; line-height: 1.4; }

        .submit-btn { width: 100%; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; border: none; padding: 16px; border-radius: 12px; font-size: 1.1rem; font-weight: bold; cursor: pointer; transition: 0.3s; box-shadow: 0 4px 15px rgba(37,99,235,0.3); display: flex; justify-content: center; align-items: center; margin-top: 10px; }
        .submit-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(37,99,235,0.4); }
        .submit-btn:disabled { background: #475569; cursor: not-allowed; box-shadow: none; }

        /* Phone Mockup Styling */
        .phone-mockup { width: 100%; max-width: 320px; height: 600px; background: #000; border-radius: 40px; margin: 0 auto; border: 12px solid #1e293b; position: relative; box-shadow: 0 20px 50px rgba(0,0,0,0.5); overflow: hidden; display: flex; flex-direction: column; }
        .phone-mockup::before { content: ''; position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 120px; height: 25px; background: #1e293b; border-bottom-left-radius: 15px; border-bottom-right-radius: 15px; z-index: 10; }
        .phone-screen { flex: 1; background: url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop') center/cover; padding: 50px 15px 20px 15px; display: flex; flex-direction: column; }
        
        .notification-bubble { background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); border-radius: 16px; padding: 15px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); animation: dropIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .notif-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .app-icon { width: 20px; height: 20px; background: #111827; color: #facc15; border-radius: 4px; display: flex; justify-content: center; align-items: center; font-size: 12px; font-weight: bold; }
        .app-name { font-size: 0.8rem; color: #475569; font-weight: bold; }
        .time { margin-right: auto; font-size: 0.75rem; color: #94a3b8; }
        .notif-content h4 { margin: 0 0 4px 0; color: #0f172a; font-size: 0.95rem; }
        .notif-content p { margin: 0; color: #475569; font-size: 0.85rem; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

        @keyframes dropIn { from { transform: translateY(-50px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        .info-box { background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.2); padding: 15px; border-radius: 10px; }
        .info-box strong { color: #38bdf8; display: block; margin-bottom: 5px; }
        .info-box p { margin: 0; color: #cbd5e1; font-size: 0.9rem; line-height: 1.5; }
        .mt-4 { margin-top: 20px; }

        .spinner { width: 24px; height: 24px; border: 3px solid rgba(255,255,255,0.3); border-top: 3px solid white; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        .toast { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%) translateY(100px); background: #1e293b; color: white; padding: 12px 25px; border-radius: 50px; font-weight: bold; box-shadow: 0 10px 30px rgba(0,0,0,0.6); z-index: 2000; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); opacity: 0; border: 1px solid #334155; }
        .toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }
        .toast.success { border-bottom: 3px solid #22c55e; }
        .toast.error { border-bottom: 3px solid #ef4444; }
      `}</style>
    </SuperLayout>
  );
}
