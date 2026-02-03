import TeacherLayout from '../../components/TeacherLayout';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // 1. تحديث الـ State ليشمل بيانات الدفع وكلمة المرور
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    phone: '',
    whatsapp: '',
    specialty: '', 
    bio: '',
    avatar: '', 
    fullAvatarUrl: '',
    // بيانات الدفع الجديدة (مصفوفات)
    cashNumbersList: [],
    instapayNumbersList: [],
    instapayLinksList: [],
    // حقول كلمة المرور
    oldPassword: '',
    password: '',
    confirmPassword: ''
  });

  // حالات لإضافة رقم جديد مؤقتاً قبل إضافته للقائمة
  const [newCashNumber, setNewCashNumber] = useState('');
  const [newInstapayNumber, setNewInstapayNumber] = useState('');
  const [newInstapayLink, setNewInstapayLink] = useState('');

  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  const showToast = (msg, type = 'success') => {
      setToast({ show: true, message: msg, type });
      setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };

  // 2. جلب البيانات وتعبئة الحقول
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/dashboard/teacher/update-profile');
        const responseData = await res.json();

        if (res.ok && responseData.success) {
          const data = responseData.data;
          const payment = data.payment_details || {}; // استخراج بيانات الدفع

          setFormData({
            name: data.name || '',
            username: data.username || '',
            phone: data.phone || '',
            whatsapp: data.whatsapp_number || '',
            specialty: data.specialty || '',
            bio: data.bio || '',
            avatar: '', // اسم الملف فقط (للحفظ)
            fullAvatarUrl: data.profile_image || '', // الرابط الكامل (للعرض)
            // تعبئة القوائم
            cashNumbersList: payment.cash_numbers || [],
            instapayNumbersList: payment.instapay_numbers || [],
            instapayLinksList: payment.instapay_links || [],
            // تفريغ حقول الباسورد
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

  // --- دوال مساعدة لإدارة القوائم ---
  
  const addItem = (listName, value, setter) => {
      if (!value.trim()) return;
      setFormData(prev => ({
          ...prev,
          [listName]: [...prev[listName], value.trim()]
      }));
      setter(''); // مسح الحقل المؤقت
  };

  const removeItem = (listName, index) => {
      setFormData(prev => ({
          ...prev,
          [listName]: prev[listName].filter((_, i) => i !== index)
      }));
  };

  // --- دالة رفع الصورة (تم التصحيح) ---
  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);

    try {
      // ✅ استخدام الرابط الجديد المخصص للصور الشخصية
      const res = await fetch('/api/dashboard/teacher/upload-avatar', {
        method: 'POST',
        body: fd
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setFormData(prev => ({ 
            ...prev, 
            avatar: data.fileId, // الاسم للحفظ في القاعدة
            fullAvatarUrl: data.url // الرابط الكامل للعرض الفوري
        }));
        showToast('تم رفع الصورة، اضغط حفظ لتأكيد التغيير', 'success');
      } else {
        showToast('فشل رفع الصورة', 'error');
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
    
    // التحقق من صحة كلمة المرور قبل الإرسال
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
        // إرسال القوائم الجديدة
        cashNumbersList: formData.cashNumbersList,
        instapayNumbersList: formData.instapayNumbersList,
        instapayLinksList: formData.instapayLinksList,
        // الصورة
        ...(formData.avatar && { profileImage: formData.avatar }),
        // الباسورد (فقط إذا تم تغييره)
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
        // تفريغ حقول الباسورد بعد الحفظ للأمان
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
      <div className={`toast ${toast.show ? 'show' : ''} ${toast.type}`}>
          {toast.message}
      </div>

      <div className="profile-container">
        {loading ? (
          <div className="loading">جاري تحميل البيانات...</div>
        ) : (
          <div className="profile-grid">
            {/* القائمة الجانبية: الصورة والمعلومات الأساسية */}
            <div className="card avatar-card">
              <div className="avatar-wrapper">
                {uploading ? (
                    <div className="avatar-placeholder spinner">⏳</div>
                ) : formData.fullAvatarUrl ? (
                    <img 
                        src={formData.fullAvatarUrl} 
                        alt="Profile" 
                        className="avatar-img"
                        onError={(e) => {e.target.src = 'https://via.placeholder.com/150?text=Avatar';}} 
                    />
                ) : (
                    <div className="avatar-placeholder">{formData.name?.[0] || 'T'}</div>
                )}
                
                <label className="upload-btn">
                  📷
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} hidden />
                </label>
              </div>
              
              <h2 className="user-name">{formData.name}</h2>
              <p className="user-role">@{formData.username}</p>
            </div>

            {/* النموذج الرئيسي */}
            <div className="card form-card">
              <h3>تعديل البيانات</h3>
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
                        <input className="input" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} required dir="ltr" />
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label>رقم الهاتف</label>
                        <input className="input" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} dir="ltr" />
                    </div>
                    <div className="form-group">
                        <label>رقم الواتساب (للتواصل مع الطلاب)</label>
                        <input className="input" value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value})} dir="ltr" placeholder="+20..." />
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

                {/* 2. بيانات الدفع (الجديدة) */}
                <div className="section-title" style={{marginTop: '30px'}}>بيانات الدفع (تظهر للطلاب)</div>
                
                {/* أرقام فودافون كاش */}
                <div className="payment-section">
                    <label>أرقام المحفظة الإلكترونية (فودافون كاش / اتصالات..)</label>
                    <div className="add-row">
                        <input className="input small" value={newCashNumber} onChange={e => setNewCashNumber(e.target.value)} placeholder="أضف رقم..." dir="ltr" />
                        <button type="button" className="btn-add" onClick={() => addItem('cashNumbersList', newCashNumber, setNewCashNumber)}>إضافة</button>
                    </div>
                    <div className="tags-container">
                        {formData.cashNumbersList.map((num, idx) => (
                            <span key={idx} className="tag">{num} <button type="button" onClick={() => removeItem('cashNumbersList', idx)}>×</button></span>
                        ))}
                    </div>
                </div>

                {/* أرقام إنستاباي */}
                <div className="payment-section">
                    <label>عناوين إنستاباي (Instapay Addresses)</label>
                    <div className="add-row">
                        <input className="input small" value={newInstapayNumber} onChange={e => setNewInstapayNumber(e.target.value)} placeholder="name@instapay..." dir="ltr" />
                        <button type="button" className="btn-add" onClick={() => addItem('instapayNumbersList', newInstapayNumber, setNewInstapayNumber)}>إضافة</button>
                    </div>
                    <div className="tags-container">
                        {formData.instapayNumbersList.map((num, idx) => (
                            <span key={idx} className="tag info">{num} <button type="button" onClick={() => removeItem('instapayNumbersList', idx)}>×</button></span>
                        ))}
                    </div>
                </div>

                {/* روابط إنستاباي */}
                <div className="payment-section">
                    <label>روابط إنستاباي المباشرة (QR Links)</label>
                    <div className="add-row">
                        <input className="input small" value={newInstapayLink} onChange={e => setNewInstapayLink(e.target.value)} placeholder="https://..." dir="ltr" />
                        <button type="button" className="btn-add" onClick={() => addItem('instapayLinksList', newInstapayLink, setNewInstapayLink)}>إضافة</button>
                    </div>
                    <div className="tags-container">
                        {formData.instapayLinksList.map((link, idx) => (
                            <span key={idx} className="tag link" title={link}>رابط #{idx+1} <button type="button" onClick={() => removeItem('instapayLinksList', idx)}>×</button></span>
                        ))}
                    </div>
                </div>

                {/* 3. الأمان (مع التحقق) */}
                <div className="section-title" style={{marginTop: '30px', color: '#ef4444'}}>الأمان</div>
                <div className="security-box">
                    <div className="form-group">
                        <label>كلمة المرور الحالية (مطلوبة للتغيير)</label>
                        <input className="input" type="password" value={formData.oldPassword} onChange={e => setFormData({...formData, oldPassword: e.target.value})} placeholder="******" dir="ltr" />
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>كلمة المرور الجديدة (6+ حروف)</label>
                            <input className="input" type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="******" dir="ltr" />
                        </div>
                        <div className="form-group">
                            <label>تأكيد الجديدة</label>
                            <input className="input" type="password" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} placeholder="******" dir="ltr" />
                        </div>
                    </div>
                </div>

                <button type="submit" className="save-btn" disabled={saving}>
                  {saving ? 'جاري الحفظ...' : 'حفظ التغييرات 💾'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .profile-container { max-width: 1000px; margin: 0 auto; padding-bottom: 50px; }
        .loading { text-align: center; color: #38bdf8; padding: 40px; }
        
        .profile-grid { display: grid; grid-template-columns: 300px 1fr; gap: 25px; }
        .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 25px; }
        
        /* Avatar Styles */
        .avatar-card { text-align: center; display: flex; flex-direction: column; align-items: center; height: fit-content; }
        .avatar-wrapper { position: relative; width: 140px; height: 140px; margin-bottom: 15px; }
        .avatar-img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; border: 3px solid #38bdf8; }
        .avatar-placeholder { width: 100%; height: 100%; border-radius: 50%; background: #334155; color: #94a3b8; display: flex; align-items: center; justify-content: center; font-size: 3rem; font-weight: bold; border: 3px solid #38bdf8; }
        .upload-btn { position: absolute; bottom: 5px; right: 5px; background: #38bdf8; color: #0f172a; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 2px solid #1e293b; transition: transform 0.2s; }
        .upload-btn:hover { transform: scale(1.1); }
        .user-name { margin: 10px 0 5px; color: white; font-size: 1.4rem; }
        .user-role { color: #94a3b8; margin: 0; font-family: monospace; direction: ltr; }
        
        /* Form Styles */
        .form-card h3 { margin-top: 0; color: #38bdf8; border-bottom: 1px solid #334155; padding-bottom: 15px; margin-bottom: 20px; }
        .section-title { color: #94a3b8; font-size: 0.9rem; text-transform: uppercase; margin-bottom: 15px; border-bottom: 1px dashed #334155; padding-bottom: 5px; font-weight: bold; }
        
        .form-row { display: flex; gap: 20px; }
        .form-group { margin-bottom: 20px; flex: 1; }
        .form-group label, .payment-section label { display: block; color: #cbd5e1; margin-bottom: 8px; font-weight: 500; font-size: 0.95rem; }
        .input { width: 100%; background: #0f172a; border: 1px solid #475569; padding: 12px; border-radius: 8px; color: white; font-size: 1rem; transition: border-color 0.2s; }
        .input:focus { border-color: #38bdf8; outline: none; }
        .input.area { resize: vertical; }
        
        /* Payment Section Styles */
        .payment-section { margin-bottom: 20px; background: #162032; padding: 15px; border-radius: 8px; border: 1px solid #334155; }
        .add-row { display: flex; gap: 10px; margin-bottom: 10px; }
        .input.small { flex: 1; padding: 8px 12px; }
        .btn-add { background: #38bdf8; color: #0f172a; border: none; padding: 0 15px; border-radius: 6px; cursor: pointer; font-weight: bold; }
        .tags-container { display: flex; flex-wrap: wrap; gap: 8px; }
        .tag { background: #334155; color: white; padding: 5px 10px; border-radius: 20px; font-size: 0.9rem; display: flex; align-items: center; gap: 8px; border: 1px solid #475569; }
        .tag.info { background: rgba(56, 189, 248, 0.1); border-color: #38bdf8; color: #38bdf8; }
        .tag.link { background: rgba(168, 85, 247, 0.1); border-color: #a855f7; color: #a855f7; }
        .tag button { background: none; border: none; color: #ef4444; font-size: 1.1rem; cursor: pointer; display: flex; align-items: center; }
        
        /* Security Box */
        .security-box { background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.3); padding: 20px; border-radius: 8px; margin-bottom: 20px; }

        .save-btn { width: 100%; background: #22c55e; color: white; border: none; padding: 14px; border-radius: 8px; font-size: 1rem; font-weight: bold; cursor: pointer; transition: background 0.2s; margin-top: 10px; }
        .save-btn:hover { background: #16a34a; }
        .save-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        .toast { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%) translateY(100px); background: #333; color: white; padding: 12px 25px; border-radius: 50px; font-weight: bold; box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 2000; transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); opacity: 0; }
        .toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }
        .toast.success { background: #22c55e; color: #0f172a; }
        .toast.error { background: #ef4444; color: white; }

        @media (max-width: 768px) {
            .profile-grid { grid-template-columns: 1fr; }
            .avatar-card { flex-direction: row; gap: 20px; align-items: center; text-align: right; padding: 20px; }
            .avatar-wrapper { width: 80px; height: 80px; margin-bottom: 0; }
            .upload-btn { width: 28px; height: 28px; font-size: 0.8rem; }
            .user-name { font-size: 1.2rem; margin: 0 0 5px 0; }
            .form-row { flex-direction: column; gap: 0; }
        }
        
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </TeacherLayout>
  );
}
