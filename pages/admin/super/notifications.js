import SuperLayout from '../../../components/SuperLayout';
import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function SuperNotifications() {
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState([]);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  const [formData, setFormData] = useState({
    title: '',
    body: '',
    targetType: 'all',
    targetId: '',
    userIdentifier: ''
  });

  const showToast = (msg, type = 'success') => {
      setToast({ show: true, message: msg, type });
      setTimeout(() => setToast({ show: false, message: '', type: '' }), 3500);
  };

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
    if (formData.targetType === 'user' && !formData.userIdentifier) return showToast('يرجى إدخال هاتف أو اسم المستخدم', 'error');
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
        setFormData({ ...formData, title: '', body: '', userIdentifier: '' });
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
                  placeholder="اكتب تفاصيل التنبيه هنا..." 
                  value={formData.body}
                  onChange={e => setFormData({...formData, body: e.target.value})}
                  required 
                  rows="4"
                  maxLength={200}
                ></textarea>
              </div>

              <div className="section-divider">🎯 تحديد المستهدفين</div>

              <div className="target-options">
                {['all', 'course', 'subject', 'user'].map((type) => (
                    <label key={type} className={`radio-card ${formData.targetType === type ? 'active' : ''}`}>
                      <input type="radio" name="target" checked={formData.targetType === type} onChange={() => setFormData({...formData, targetType: type, targetId: ''})} />
                      <span className="text">{type === 'all' ? 'الجميع' : type === 'course' ? 'طلاب كورس' : type === 'subject' ? 'طلاب مادة' : 'مستخدم محدد'}</span>
                    </label>
                ))}
              </div>

              <div className="dynamic-target-section">
                {formData.targetType === 'course' && (
                  <select className="input-field" required value={formData.targetId} onChange={e => setFormData({...formData, targetId: e.target.value})}>
                    <option value="">اختر الكورس...</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                )}
                {formData.targetType === 'subject' && (
                  <select className="input-field" required value={formData.targetId} onChange={e => setFormData({...formData, targetId: e.target.value})}>
                    <option value="">اختر المادة...</option>
                    {courses.map(c => <optgroup key={c.id} label={c.title}>{c.subjects?.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</optgroup>)}
                  </select>
                )}
                {formData.targetType === 'user' && (
                  <input type="text" className="input-field ltr" placeholder="هاتف أو اسم المستخدم" value={formData.userIdentifier} onChange={e => setFormData({...formData, userIdentifier: e.target.value})} required />
                )}
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'جاري الإرسال...' : '🚀 إرسال الإشعار الآن'}
              </button>
            </form>
          </div>

          <div className="preview-section">
            <div className="phone-mockup">
              <div className="phone-screen">
                <div className="notification-bubble">
                  <div className="notif-content">
                    <h4>{formData.title || 'عنوان الإشعار'}</h4>
                    <p>{formData.body || 'نص الرسالة يظهر هنا...'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .notifications-container { padding-bottom: 50px; width: 100%; max-width: 1400px; margin: 0 auto; }
        .page-header { margin-bottom: 30px; border-bottom: 1px solid var(--border); padding-bottom: 15px; }
        .page-header h1 { color: var(--text-primary); font-size: 1.8rem; margin: 0; }
        
        .grid-layout { display: grid; grid-template-columns: minmax(300px, 1fr) minmax(300px, 400px); gap: 30px; }
        
        .card { background: var(--bg-surface); border-radius: 16px; padding: 25px; border: 1px solid var(--border); }
        .card h3 { color: var(--gold); margin: 0 0 20px 0; border-bottom: 1px solid var(--border); padding-bottom: 10px; }

        .input-field { width: 100%; background: var(--bg-base); border: 1px solid var(--border); padding: 14px; border-radius: 10px; color: var(--text-primary); }
        .submit-btn { width: 100%; background: var(--gold); color: #111009; border: none; padding: 16px; border-radius: 10px; font-weight: bold; cursor: pointer; margin-top: 20px; transition: 0.3s; }
        
        .target-options { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; }
        .radio-card { background: var(--bg-base); padding: 12px; border-radius: 8px; border: 1px solid var(--border); text-align: center; cursor: pointer; transition: 0.2s; }
        .radio-card.active { border-color: var(--gold); color: var(--gold); }
        
        .phone-mockup { width: 100%; max-width: 300px; height: 500px; background: #000; border-radius: 30px; margin: 0 auto; position: relative; overflow: hidden; border: 8px solid #222; }
        .phone-screen { background: linear-gradient(135deg, #111, #222); height: 100%; padding: 20px; }
        .notification-bubble { background: #fff; padding: 15px; border-radius: 12px; color: #000; }
        
        @media (max-width: 900px) { .grid-layout { grid-template-columns: 1fr; } }
      `}</style>
    </SuperLayout>
  );
}
