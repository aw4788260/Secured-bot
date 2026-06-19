import TeacherLayout from '../../../components/TeacherLayout';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

// --- أيقونات SVG الاحترافية ---
const Icons = {
    camera: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>,
    save: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>,
    trash: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
    add: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
    user: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>,
    alert: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
};

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // 1. تحديث الـ State
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    phone: '',
    whatsapp: '',
    specialty: '', 
    bio: '',
    avatar: '', 
    fullAvatarUrl: '',
    // بيانات الدفع
    cashNumbersList: [],
    instapayNumbersList: [],
    instapayLinksList: [],
    // حقول كلمة المرور
    oldPassword: '',
    password: '',
    confirmPassword: ''
  });

  // حالات الإضافة المؤقتة
  const [newCashNumber, setNewCashNumber] = useState('');
  const [newInstapayNumber, setNewInstapayNumber] = useState('');
  const [newInstapayLink, setNewInstapayLink] = useState('');

  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  const showToast = (msg, type = 'success') => {
      setToast({ show: true, message: msg, type });
      setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };

  // 2. جلب البيانات
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/dashboard/teacher/update-profile');
        const responseData = await res.json();

        if (res.ok && responseData.success) {
          const data = responseData.data;
          const payment = data.payment_details || {}; 

          setFormData({
            name: data.name || '',
            username: data.username || '',
            phone: data.phone || '',
            whatsapp: data.whatsapp_number || '',
            specialty: data.specialty || '',
            bio: data.bio || '',
            avatar: '', 
            fullAvatarUrl: data.profile_image || '',
            cashNumbersList: payment.cash_numbers || [],
            instapayNumbersList: payment.instapay_numbers || [],
            instapayLinksList: payment.instapay_links || [],
            oldPassword: '',
            password: '',
            confirmPassword: ''
          });
        }
      } catch (err) {
        console.error(err);
        showToast('فشل جلب البيانات', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  // --- دوال إدارة القوائم ---
  const addItem = (listName, value, setter) => {
      if (!value.trim()) return;
      setFormData(prev => ({
          ...prev,
          [listName]: [...prev[listName], value.trim()]
      }));
      setter('');
  };

  const removeItem = (listName, index) => {
      setFormData(prev => ({
          ...prev,
          [listName]: prev[listName].filter((_, i) => i !== index)
      }));
  };

  // --- دالة رفع الصورة (مع العرض الفوري - Instant Preview) ---
  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // ✅ عرض الصورة فوراً محلياً (قبل الرفع للسيرفر)
    const localPreviewUrl = URL.createObjectURL(file);
    setFormData(prev => ({ 
        ...prev, 
        fullAvatarUrl: localPreviewUrl 
    }));

    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch('/api/dashboard/teacher/upload-avatar', {
        method: 'POST',
        body: fd
      });
      const data = await res.json();

      if (res.ok && data.success) {
        // تحديث معرف الصورة للحفظ (دون تغيير الرابط المعروض حالياً لعدم الوميض)
        setFormData(prev => ({ 
            ...prev, 
            avatar: data.fileId 
        }));
        showToast('تم رفع الصورة، اضغط "حفظ" لاعتمادها', 'success');
      } else {
        showToast('فشل رفع الصورة للسيرفر', 'error');
      }
    } catch (err) {
      showToast('خطأ في الاتصال', 'error');
    } finally {
      setUploading(false);
    }
  };

  // --- دالة الحفظ ---
  const handleSave = async (e) => {
    e.preventDefault();
    
    if (formData.password) {
        if (formData.password.length < 6) {
            return showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
        }
        if (formData.password !== formData.confirmPassword) {
            return showToast('كلمة المرور الجديدة غير متطابقة', 'error');
        }
        if (!formData.oldPassword) {
            return showToast('يجب إدخال كلمة المرور القديمة لتأكيد التغيير', 'error');
        }
    }

    setSaving(true);

    try {
      const payload = {
        name: formData.name,
        username: formData.username,
        phone: formData.phone,
        bio: formData.bio,
        specialty: formData.specialty,
        whatsappNumber: formData.whatsapp,
        cashNumbersList: formData.cashNumbersList,
        instapayNumbersList: formData.instapayNumbersList,
        instapayLinksList: formData.instapayLinksList,
        ...(formData.avatar && { profileImage: formData.avatar }),
        ...(formData.password && { 
            password: formData.password,
            oldPassword: formData.oldPassword
        })
      };

      const res = await fetch('/api/dashboard/teacher/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        showToast('تم حفظ التغييرات بنجاح', 'success');
        setFormData(prev => ({
            ...prev, 
            oldPassword: '',
            password: '',
            confirmPassword: ''
        }));
        setTimeout(() => router.reload(), 1500);
      } else {
        showToast(data.error || 'فشل الحفظ', 'error');
      }
    } catch (err) {
      showToast('خطأ في الاتصال بالسيرفر', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <TeacherLayout title="الملف الشخصي">
      <div className={`toast-notification ${toast.show ? 'show' : ''} ${toast.type}`}>
          {toast.message}
      </div>

      <div className="page-header">
          <div className="title-area">
              <div className="title-icon">{Icons.user}</div>
              <div>
                  <h1 className="page-title">الملف الشخصي</h1>
                  <p className="page-sub">إدارة بياناتك الشخصية، معلومات الدفع، وإعدادات الأمان.</p>
              </div>
          </div>
      </div>

      <div className="profile-container">
        {loading ? (
          <div className="loading-state">
              <div className="spinner"></div>
              <span>جاري تحميل البيانات...</span>
          </div>
        ) : (
          <div className="profile-grid">
            
            {/* بطاقة الصورة */}
            <div className="card avatar-card">
              <div className="avatar-wrapper">
                {formData.fullAvatarUrl ? (
                    <img 
                        src={formData.fullAvatarUrl} 
                        alt="Profile" 
                        className="avatar-img"
                        onError={(e) => {e.target.src = 'https://via.placeholder.com/150?text=Avatar';}} 
                    />
                ) : (
                    <div className="avatar-placeholder">{formData.name?.[0] || 'T'}</div>
                )}
                
                {uploading && <div className="upload-spinner-overlay"><div className="spinner small"></div></div>}

                <label className="upload-btn" title="تغيير الصورة">
                  {Icons.camera}
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} hidden />
                </label>
              </div>
              <h2 className="user-name">{formData.name}</h2>
              <p className="user-role">@{formData.username}</p>
            </div>

            {/* النموذج */}
            <div className="card form-card">
              <div className="card-header">
                  <h3>تعديل البيانات</h3>
              </div>
              <div className="card-body">
                  <form onSubmit={handleSave}>
                    
                    {/* 1. البيانات الشخصية */}
                    <div className="section-title">البيانات الشخصية</div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>الاسم الكامل</label>
                            <input className="input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                        </div>
                        <div className="form-group">
                            <label>اسم المستخدم (للدخول)</label>
                            <input className="input ltr-dir" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} required dir="ltr" />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>رقم الهاتف</label>
                            <input className="input ltr-dir" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} dir="ltr" />
                        </div>
                        <div className="form-group">
                            <label>
                                رقم الواتساب 
                                <span className="label-hint">
                                    (بدون '+' مثل 201xxxxxxxxx)
                                </span>
                            </label>
                            <input className="input ltr-dir" value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value})} dir="ltr" placeholder="201xxxxxxxxx" />
                        </div>
                    </div>

                    <div className="form-group">
                      <label>التخصص (المادة)</label>
                      <input className="input" value={formData.specialty} onChange={e => setFormData({...formData, specialty: e.target.value})} placeholder="مثال: لغة عربية، فيزياء..." />
                    </div>

                    <div className="form-group">
                      <label>نبذة عني (Bio)</label>
                      <textarea className="input area" value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} rows="3" placeholder="اكتب نبذة مختصرة تظهر للطلاب..."></textarea>
                    </div>

                    {/* 2. بيانات الدفع */}
                    <div className="section-title" style={{marginTop: '32px'}}>بيانات الدفع (تظهر للطلاب)</div>
                    
                    {/* أرقام فودافون كاش */}
                    <div className="payment-section">
                        <label>أرقام المحفظة الإلكترونية (فودافون كاش / اتصالات..)</label>
                        <div className="add-row">
                            <input className="input small ltr-dir" value={newCashNumber} onChange={e => setNewCashNumber(e.target.value)} placeholder="أضف رقم..." dir="ltr" />
                            <button type="button" className="btn-add" onClick={() => addItem('cashNumbersList', newCashNumber, setNewCashNumber)}>{Icons.add} إضافة</button>
                        </div>
                        <div className="tags-container">
                            {formData.cashNumbersList.map((num, idx) => (
                                <span key={idx} className="tag">{num} <button type="button" onClick={() => removeItem('cashNumbersList', idx)} title="حذف">{Icons.trash}</button></span>
                            ))}
                        </div>
                    </div>

                    {/* أرقام إنستاباي */}
                    <div className="payment-section">
                        <label>أرقام إنستاباي (Instapay Numbers)</label>
                        <div className="add-row">
                            <input 
                                className="input small ltr-dir" 
                                type="number" 
                                value={newInstapayNumber} 
                                onChange={e => setNewInstapayNumber(e.target.value)} 
                                placeholder="01xxxxxxxxx" 
                                dir="ltr" 
                            />
                            <button type="button" className="btn-add" onClick={() => addItem('instapayNumbersList', newInstapayNumber, setNewInstapayNumber)}>{Icons.add} إضافة</button>
                        </div>
                        <div className="tags-container">
                            {formData.instapayNumbersList.map((num, idx) => (
                                <span key={idx} className="tag info">{num} <button type="button" onClick={() => removeItem('instapayNumbersList', idx)} title="حذف">{Icons.trash}</button></span>
                            ))}
                        </div>
                    </div>

                    {/* روابط إنستاباي */}
                    <div className="payment-section">
                        <label>روابط إنستاباي المباشرة (QR Links)</label>
                        <div className="add-row">
                            <input className="input small ltr-dir" value={newInstapayLink} onChange={e => setNewInstapayLink(e.target.value)} placeholder="https://..." dir="ltr" />
                            <button type="button" className="btn-add" onClick={() => addItem('instapayLinksList', newInstapayLink, setNewInstapayLink)}>{Icons.add} إضافة</button>
                        </div>
                        <div className="tags-container">
                            {formData.instapayLinksList.map((link, idx) => (
                                <span key={idx} className="tag link" title={link}>رابط #{idx+1} <button type="button" onClick={() => removeItem('instapayLinksList', idx)} title="حذف">{Icons.trash}</button></span>
                            ))}
                        </div>
                    </div>

                    {/* 3. الأمان */}
                    <div className="section-title danger-text" style={{marginTop: '32px'}}>إعدادات الأمان</div>
                    <div className="security-box">
                        <div className="alert-message">
                            <span className="alert-icon">{Icons.alert}</span>
                            <p>
                                <strong>تنبيه هام:</strong> كلمة المرور التي يتم تغييرها هنا هي الخاصة 
                                <span className="highlight"> بتسجيل الدخول إلى تطبيق الطلاب </span> 
                                (Student App)، وليست كلمة مرور لوحة التحكم هذه.
                            </p>
                        </div>
                        
                        <div className="form-group">
                            <label>كلمة المرور الحالية (مطلوبة للتغيير)</label>
                            <input className="input ltr-dir" type="password" value={formData.oldPassword} onChange={e => setFormData({...formData, oldPassword: e.target.value})} placeholder="******" dir="ltr" />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>كلمة المرور الجديدة (6+ حروف)</label>
                                <input className="input ltr-dir" type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="******" dir="ltr" />
                            </div>
                            <div className="form-group">
                                <label>تأكيد الجديدة</label>
                                <input className="input ltr-dir" type="password" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} placeholder="******" dir="ltr" />
                            </div>
                        </div>
                    </div>

                    <div className="form-actions">
                        <button type="submit" className="btn-primary full-width" disabled={saving || uploading}>
                        {saving ? 'جاري الحفظ...' : <><span className="icon-wrap">{Icons.save}</span> حفظ التغييرات</>}
                        </button>
                    </div>
                  </form>
              </div>
            </div>
          </div>
        )}
      </div>

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

        .profile-container { padding-bottom: 50px; }
        
        .loading-state { text-align: center; color: var(--gold); padding: 80px 20px; display: flex; flex-direction: column; align-items: center; gap: 15px; font-weight: bold; }
        .spinner { width: 36px; height: 36px; border: 3px solid var(--border); border-top-color: var(--gold); border-radius: 50%; animation: spin 1s linear infinite; }
        .spinner.small { width: 24px; height: 24px; border-width: 2px; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .profile-grid { display: grid; grid-template-columns: 280px 1fr; gap: 24px; align-items: start; }
        .card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; box-shadow: var(--shadow); }
        
        /* Avatar Card */
        .avatar-card { text-align: center; padding: 30px 20px; display: flex; flex-direction: column; align-items: center; position: sticky; top: 90px; }
        .avatar-wrapper { position: relative; width: 150px; height: 150px; margin-bottom: 20px; }
        .avatar-img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; border: 3px solid var(--border-accent); box-shadow: 0 8px 24px var(--gold-dim); }
        .avatar-placeholder { width: 100%; height: 100%; border-radius: 50%; background: var(--bg-elevated); color: var(--gold); display: flex; align-items: center; justify-content: center; font-size: 3.5rem; font-weight: 800; border: 3px solid var(--border-accent); }
        
        .upload-spinner-overlay { position: absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); border-radius:50%; display:flex; justify-content:center; align-items:center; backdrop-filter: blur(2px); }

        .upload-btn { position: absolute; bottom: 5px; right: 5px; background: var(--gold); color: #111009; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 3px solid var(--bg-surface); transition: 0.2s; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
        .upload-btn:hover { transform: scale(1.1); background: var(--gold-light); }
        
        .user-name { margin: 0 0 5px; color: var(--text-primary); font-size: 1.3rem; font-weight: 800; }
        .user-role { color: var(--text-muted); margin: 0; font-family: monospace; font-size: 1rem; }
        
        /* Form Card */
        .card-header { background: var(--bg-elevated); padding: 18px 24px; border-bottom: 1px solid var(--border); }
        .card-header h3 { margin: 0; color: var(--text-primary); font-size: 1.1rem; font-weight: bold; }
        .card-body { padding: 24px; }
        
        .section-title { color: var(--gold); font-size: 0.95rem; text-transform: uppercase; margin-bottom: 20px; padding-bottom: 8px; font-weight: 800; letter-spacing: 0.5px; border-bottom: 1px solid var(--border); }
        .danger-text { color: #ef4444; border-color: rgba(239, 68, 68, 0.2); }
        
        .form-row { display: flex; gap: 20px; }
        .form-group { margin-bottom: 22px; flex: 1; }
        .form-group label { display: block; color: var(--text-secondary); margin-bottom: 8px; font-weight: bold; font-size: 0.9rem; }
        .label-hint { display: block; font-size: 0.8rem; color: var(--text-muted); font-weight: normal; margin-top: 2px; direction: ltr; }
        
        .input { width: 100%; background: var(--bg-base); border: 1px solid var(--border); padding: 12px 16px; border-radius: 10px; color: var(--text-primary); font-size: 0.95rem; font-family: inherit; transition: 0.2s; }
        .input:focus { border-color: var(--gold); outline: none; box-shadow: 0 0 0 2px var(--gold-dim); }
        .input.area { resize: vertical; min-height: 100px; }
        .ltr-dir { direction: ltr; font-family: monospace; text-align: left; }
        
        /* Payment Section */
        .payment-section { margin-bottom: 24px; background: var(--bg-base); padding: 18px; border-radius: 12px; border: 1px solid var(--border); }
        .payment-section label { display: block; color: var(--text-secondary); margin-bottom: 12px; font-weight: bold; font-size: 0.9rem; }
        .add-row { display: flex; gap: 10px; margin-bottom: 15px; }
        .input.small { flex: 1; padding: 10px 14px; }
        .btn-add { background: var(--gold-dimmer); color: var(--gold); border: 1px dashed var(--border-accent); padding: 0 16px; border-radius: 8px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 6px; transition: 0.2s; white-space: nowrap; }
        .btn-add:hover { background: var(--gold-dim); border-color: var(--gold); }
        
        .tags-container { display: flex; flex-wrap: wrap; gap: 10px; }
        .tag { background: var(--bg-elevated); color: var(--text-primary); padding: 6px 12px; border-radius: 20px; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--border); font-family: monospace; font-weight: bold; }
        .tag.info { background: rgba(56, 189, 248, 0.05); border-color: rgba(56, 189, 248, 0.3); color: #38bdf8; }
        .tag.link { background: rgba(168, 85, 247, 0.05); border-color: rgba(168, 85, 247, 0.3); color: #a855f7; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
        .tag button { background: none; border: none; color: #ef4444; cursor: pointer; display: flex; align-items: center; padding: 2px; opacity: 0.7; transition: 0.2s; }
        .tag button:hover { opacity: 1; transform: scale(1.1); }
        
        /* Security Box */
        .security-box { background: rgba(239, 68, 68, 0.02); border: 1px solid rgba(239, 68, 68, 0.2); padding: 24px; border-radius: 12px; margin-bottom: 24px; }
        .alert-message { display: flex; gap: 12px; margin-bottom: 20px; padding: 14px; background: rgba(239, 68, 68, 0.08); border-radius: 8px; border-left: 4px solid #ef4444; }
        .alert-icon { color: #ef4444; flex-shrink: 0; }
        .alert-message p { margin: 0; color: var(--text-secondary); font-size: 0.9rem; line-height: 1.5; }
        .alert-message .highlight { color: #ef4444; font-weight: bold; }

        .form-actions { margin-top: 30px; padding-top: 20px; border-top: 1px solid var(--border); }
        .btn-primary { background: var(--gold); color: #111009; border: none; padding: 14px 24px; border-radius: 10px; font-weight: bold; font-size: 1.05rem; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 8px; transition: 0.2s; box-shadow: 0 4px 15px var(--gold-dim); }
        .btn-primary.full-width { width: 100%; }
        .btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px var(--gold-dim); background: var(--gold-light); }
        .btn-primary:disabled { opacity: 0.7; cursor: not-allowed; transform: none; box-shadow: none; }
        .icon-wrap { display: flex; align-items: center; }

        @media (max-width: 900px) {
            .profile-grid { grid-template-columns: 1fr; }
            .avatar-card { position: static; flex-direction: row; gap: 24px; align-items: center; text-align: right; padding: 24px; }
            .avatar-wrapper { width: 100px; height: 100px; margin-bottom: 0; flex-shrink: 0; }
            .upload-btn { width: 32px; height: 32px; bottom: 0; right: 0; }
            .upload-btn svg { width: 14px; height: 14px; }
            .user-name { font-size: 1.3rem; margin: 0 0 5px 0; }
            .form-row { flex-direction: column; gap: 0; }
        }

        @media (max-width: 600px) {
            .avatar-card { flex-direction: column; text-align: center; }
            .avatar-wrapper { margin-bottom: 15px; }
            .add-row { flex-direction: column; }
            .btn-add { padding: 12px; justify-content: center; }
        }
      `}</style>
    </TeacherLayout>
  );
}
