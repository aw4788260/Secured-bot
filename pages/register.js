import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Register() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState([]);
  
  // بيانات النموذج
  const [formData, setFormData] = useState({
    firstName: '',
    username: '',
    password: '',
    confirmPassword: '',
    phone: '',
    selectedCourses: [], // IDs
    receiptFile: null
  });

  // جلب الكورسات المتاحة عند فتح الصفحة
  useEffect(() => {
    // نستخدم الـ API الموجود لديك بالفعل لجلب الكورسات
    // نرسل هيدرز وهمية لأن هذا الـ API عام ولا يحتاج تسجيل دخول في هذه المرحلة
    fetch('/api/data/get-structured-courses', { 
        headers: { 'x-user-id': 'guest', 'x-device-id': 'guest' } 
    })
    .then(res => res.json())
    .then(data => {
        if(Array.isArray(data)) setCourses(data);
    })
    .catch(err => console.error("Failed to load courses", err));
  }, []);

  // دوال التعامل مع الإدخال
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  
  const handleCourseToggle = (courseId) => {
    const selected = formData.selectedCourses.includes(courseId)
      ? formData.selectedCourses.filter(id => id !== courseId)
      : [...formData.selectedCourses, courseId];
    setFormData({ ...formData, selectedCourses: selected });
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
        setFormData({ ...formData, receiptFile: e.target.files[0] });
    }
  };

  // إرسال النموذج
  const handleSubmit = async () => {
    if (!formData.receiptFile) return alert("يرجى رفع صورة الإيصال");
    
    setLoading(true);
    const uploadData = new FormData();
    uploadData.append('firstName', formData.firstName);
    uploadData.append('username', formData.username);
    uploadData.append('password', formData.password);
    uploadData.append('phone', formData.phone);
    uploadData.append('selectedCourses', JSON.stringify(formData.selectedCourses));
    uploadData.append('receiptFile', formData.receiptFile);

    try {
        const res = await fetch('/api/public/register', {
            method: 'POST',
            body: uploadData
        });
        const result = await res.json();

        if (res.ok) {
            alert("✅ تم إرسال طلبك بنجاح! سيتم مراجعته من قبل الإدارة وتفعيل حسابك قريباً.");
            router.push('/login');
        } else {
            alert("❌ خطأ: " + result.error);
        }
    } catch (err) {
        alert("حدث خطأ في الاتصال");
    } finally {
        setLoading(false);
    }
  };

  // التحقق قبل الانتقال للخطوة التالية
  const nextStep = () => {
    if (step === 1) {
        if (!formData.firstName || !formData.username || !formData.password || !formData.phone) {
            return alert("يرجى ملء جميع البيانات");
        }
        if (formData.password !== formData.confirmPassword) {
            return alert("كلمة المرور غير متطابقة");
        }
    }
    if (step === 2 && formData.selectedCourses.length === 0) {
        return alert("يرجى اختيار كورس واحد على الأقل");
    }
    setStep(step + 1);
  };

  return (
    <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <Head><title>تسجيل طالب جديد</title></Head>
      
      <div style={{
          background: '#1e293b', padding: '30px', borderRadius: '15px', 
          width: '95%', maxWidth: '500px', border: '1px solid #334155',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
      }}>
        <h1 style={{ textAlign: 'center', color: '#38bdf8', marginBottom: '20px' }}>
            {step === 1 ? 'بيانات الطالب' : step === 2 ? 'اختيار الكورسات' : 'تأكيد الدفع'}
        </h1>

        {/* الخطوة 1: البيانات الأساسية */}
        {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <input className="input-field" name="firstName" placeholder="الاسم الثلاثي" onChange={handleChange} value={formData.firstName} />
                <input className="input-field" name="phone" placeholder="رقم الهاتف (واتساب)" onChange={handleChange} value={formData.phone} />
                <input className="input-field" name="username" placeholder="اسم المستخدم (للدخول)" onChange={handleChange} value={formData.username} />
                <input className="input-field" type="password" name="password" placeholder="كلمة المرور" onChange={handleChange} value={formData.password} />
                <input className="input-field" type="password" name="confirmPassword" placeholder="تأكيد كلمة المرور" onChange={handleChange} value={formData.confirmPassword} />
                
                <button className="button-link" style={{ justifyContent: 'center' }} onClick={nextStep}>التالي &larr;</button>
            </div>
        )}

        {/* الخطوة 2: اختيار الكورسات */}
        {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <p style={{ textAlign: 'center', color: '#cbd5e1' }}>حدد الكورسات التي ترغب بالاشتراك فيها:</p>
                <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #334155', borderRadius: '8px', padding: '10px' }}>
                    {courses.length > 0 ? courses.map(course => (
                        <label key={course.id} style={{ 
                            display: 'flex', alignItems: 'center', padding: '10px', 
                            borderBottom: '1px solid #334155', cursor: 'pointer',
                            background: formData.selectedCourses.includes(course.id) ? '#334155' : 'transparent'
                        }}>
                            <input 
                                type="checkbox" 
                                checked={formData.selectedCourses.includes(course.id)}
                                onChange={() => handleCourseToggle(course.id)}
                                style={{ marginLeft: '10px', width: '18px', height: '18px' }}
                            />
                            <span style={{ fontSize: '1.1em' }}>{course.title}</span>
                            <span style={{ marginRight: 'auto', color: '#38bdf8' }}>{course.price || 0} ج.م</span>
                        </label>
                    )) : <p>لا توجد كورسات متاحة حالياً</p>}
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                    <button className="back-button" onClick={() => setStep(1)} style={{ flex: 1 }}>رجوع</button>
                    <button className="button-link" onClick={nextStep} style={{ flex: 2, justifyContent: 'center' }}>التالي &larr;</button>
                </div>
            </div>
        )}

        {/* الخطوة 3: الدفع والرفع */}
        {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', textAlign: 'center' }}>
                <div style={{ background: '#0f172a', padding: '15px', borderRadius: '8px', border: '1px dashed #38bdf8' }}>
                    <p style={{ color: '#94a3b8', marginBottom: '5px' }}>يرجى تحويل المبلغ الإجمالي على:</p>
                    <h2 style={{ color: '#fff', direction: 'ltr' }}>010 XXXXX XXXX</h2>
                    <p style={{ color: '#38bdf8', fontSize: '0.9em' }}>فودافون كاش</p>
                </div>

                <p>ثم قم برفع صورة (Screenshot) لإيصال التحويل:</p>
                <input type="file" accept="image/*" onChange={handleFileChange} style={{ color: 'white' }} />

                <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                    <button className="back-button" onClick={() => setStep(2)} style={{ flex: 1 }}>رجوع</button>
                    <button 
                        className="button-link" 
                        onClick={handleSubmit} 
                        disabled={loading}
                        style={{ flex: 2, justifyContent: 'center', background: loading ? '#555' : '#22c55e' }}
                    >
                        {loading ? 'جاري الإرسال...' : '✅ إتمام التسجيل'}
                    </button>
                </div>
            </div>
        )}
      </div>

      {/* تنسيقات إضافية (يمكنك نقلها لملف CSS لاحقاً) */}
      <style jsx>{`
        .input-field {
            width: 100%; padding: 12px; background: #0f172a; border: 1px solid #475569;
            border-radius: 8px; color: white; outline: none; transition: border 0.3s;
        }
        .input-field:focus { border-color: #38bdf8; }
      `}</style>
    </div>
  );
}
