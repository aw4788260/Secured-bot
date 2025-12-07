import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Register() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checkingUser, setCheckingUser] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    username: '',
    password: '',
    confirmPassword: '',
    phone: '',
    selectedItems: [], 
    receiptFile: null
  });

  // جلب الكورسات
  useEffect(() => {
    fetch('/api/public/get-courses')
      .then(res => res.json())
      .then(data => { if(Array.isArray(data)) setCourses(data); })
      .catch(console.error);
  }, []);

  // دالة اختيار العناصر
  const handleSelection = (item, type, parentCourseId = null) => {
    let newSelection = [...formData.selectedItems];
    const exists = newSelection.find(i => i.id === item.id && i.type === type);

    if (exists) {
        newSelection = newSelection.filter(i => !(i.id === item.id && i.type === type));
    } else {
        if (type === 'course') {
             const subjectIds = item.subjects.map(s => s.id);
             newSelection = newSelection.filter(i => !(i.type === 'subject' && subjectIds.includes(i.id)));
        }
        if (type === 'subject' && parentCourseId) {
             const parentSelected = newSelection.find(i => i.type === 'course' && i.id === parentCourseId);
             if (parentSelected) {
                 alert("لقد اخترت الكورس بالكامل بالفعل!");
                 return;
             }
        }
        newSelection.push({ type, id: item.id, price: item.price, title: item.title });
    }
    setFormData({ ...formData, selectedItems: newSelection });
  };

  const totalPrice = formData.selectedItems.reduce((sum, item) => sum + (item.price || 0), 0);

// الانتقال للخطوة التالية
  const nextStep = async () => {
    if (step === 1) {
        // 1. التحقق من أن الحقول ليست فارغة
        if (!formData.firstName || !formData.username || !formData.password || !formData.phone) {
            return alert("يرجى ملء جميع البيانات");
        }

        // 2. [جديد] التحقق من طول كلمة المرور (6 أحرف على الأقل)
        if (formData.password.length < 6) {
            return alert("⚠️ كلمة المرور قصيرة جداً! يجب أن تكون 6 أحرف على الأقل.");
        }

        // 3. التحقق من تطابق كلمتي المرور
        if (formData.password !== formData.confirmPassword) {
            return alert("❌ كلمة المرور غير متطابقة");
        }
        
        setCheckingUser(true);
        try {
            const res = await fetch('/api/public/check-username', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: formData.username })
            });
            const data = await res.json();
            setCheckingUser(false);
            if (data.available) setStep(2);
            else alert("⚠️ " + data.message);
        } catch (err) {
            setCheckingUser(false);
            alert("حدث خطأ في الاتصال");
        }
    } else if (step === 2) {
        if (formData.selectedItems.length === 0) return alert("اختر كورس أو مادة واحدة على الأقل");
        setStep(3);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.receiptFile) return alert("يرجى رفع الإيصال");

    setLoading(true);
    const body = new FormData();
    body.append('firstName', formData.firstName);
    body.append('username', formData.username);
    body.append('password', formData.password);
    body.append('phone', formData.phone);
    body.append('selectedItems', JSON.stringify(formData.selectedItems));
    body.append('receiptFile', formData.receiptFile);

    try {
        const res = await fetch('/api/public/register', { method: 'POST', body });
        const result = await res.json();
        
        if (res.ok) {
            alert("✅ تم إرسال الطلب بنجاح!");
            router.push('/login');
        } else {
            alert("❌ خطأ: " + (result.error || "فشل الرفع"));
        }
    } catch (err) {
        alert("حدث خطأ في الاتصال");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="app-container" style={{justifyContent: 'center', alignItems: 'center', minHeight: '100vh'}}>
      <Head><title>طلب اشتراك</title></Head>
      
      <div className="form-box">
        <h2 className="title">
            {step === 1 ? '1. البيانات الشخصية' : step === 2 ? '2. اختيار الاشتراك' : '3. الدفع والتأكيد'}
        </h2>

        {/* --- الخطوة 1: البيانات --- */}
        {step === 1 && (
            <div className="form-column">
                <label>الاسم الثلاثي:</label>
                <input className="input-field" value={formData.firstName} onChange={e=>setFormData({...formData, firstName: e.target.value})} />
                
                <label>رقم الهاتف (واتساب):</label>
                <input className="input-field" value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value})} />
                
                <label>اسم المستخدم (للدخول):</label>
                <input className="input-field" value={formData.username} onChange={e=>setFormData({...formData, username: e.target.value})} />
                
                <label>كلمة المرور:</label>
                <input className="input-field" type="password" value={formData.password} onChange={e=>setFormData({...formData, password: e.target.value})} />
                
                <label>تأكيد كلمة المرور:</label>
                <input className="input-field" type="password" value={formData.confirmPassword} onChange={e=>setFormData({...formData, confirmPassword: e.target.value})} />

                <button onClick={nextStep} disabled={checkingUser} className="button-link action-btn">
                    {checkingUser ? 'جاري التحقق...' : 'التالي ⬅️'}
                </button>
            </div>
        )}

        {/* --- الخطوة 2: الاختيارات (تم تعديل التصميم هنا) --- */}
        {step === 2 && (
            <div className="form-column">
                {/* تم إزالة max-height ليأخذ طوله الطبيعي */}
                <div className="courses-list">
                    {courses.map(course => (
                        <div key={course.id} className="course-group">
                            {/* الكورس الرئيسي */}
                            <div className={`course-header ${formData.selectedItems.find(i => i.id === course.id && i.type === 'course') ? 'selected' : ''}`}>
                                <label style={{flex:1, cursor:'pointer', display:'flex', alignItems:'center'}}>
                                    <input 
                                        type="checkbox" 
                                        checked={!!formData.selectedItems.find(i => i.id === course.id && i.type === 'course')}
                                        onChange={() => handleSelection(course, 'course')}
                                        style={{width:'20px', height:'20px'}}
                                    />
                                    <span style={{marginRight:'10px', fontWeight:'bold', fontSize:'1.1em'}}>📦 كورس كامل: {course.title}</span>
                                </label>
                                <span className="price-tag">{course.price} ج.م</span>
                            </div>

                            {/* المواد الفرعية: تظهر كاملة بدون قص */}
                            {!formData.selectedItems.find(i => i.id === course.id && i.type === 'course') && course.subjects && course.subjects.length > 0 && (
                                <div className="subjects-list">
                                    <p style={{fontSize:'0.9em', color:'#94a3b8', marginBottom:'10px', borderBottom:'1px solid #334155', paddingBottom:'5px'}}>
                                        أو اختر مواد محددة من هذا الكورس:
                                    </p>
                                    {course.subjects.map(subject => (
                                        <div key={subject.id} className="subject-item">
                                            <label style={{flex:1, cursor:'pointer', display:'flex', alignItems:'center'}}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={!!formData.selectedItems.find(i => i.id === subject.id && i.type === 'subject')}
                                                    onChange={() => handleSelection(subject, 'subject', course.id)}
                                                    style={{width:'18px', height:'18px'}}
                                                />
                                                <span style={{marginRight:'10px'}}>📄 {subject.title}</span>
                                            </label>
                                            <span className="price-tag small">{subject.price} ج.م</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                
                <div className="total-bar">
                    الإجمالي: <span style={{color:'#22c55e'}}>{totalPrice} ج.م</span>
                </div>

                <div style={{display:'flex', gap:'10px'}}>
                    <button onClick={()=>setStep(1)} className="button-link back-btn">رجوع</button>
                    <button onClick={nextStep} className="button-link action-btn">التالي ⬅️</button>
                </div>
            </div>
        )}

        {/* --- الخطوة 3: الدفع --- */}
        {step === 3 && (
            <form onSubmit={handleSubmit} className="form-column">
                <div className="payment-box">
                    <p>المطلوب سداده: <span style={{color:'#22c55e', fontWeight:'bold'}}>{totalPrice} ج.م</span></p>
                    <p>حول المبلغ على فودافون كاش:</p>
                    <h2 style={{direction:'ltr', margin:'10px 0'}}>010 XXXXX XXXX</h2>
                </div>

                <label>صورة إيصال الدفع:</label>
                <input type="file" accept="image/*" onChange={e=>setFormData({...formData, receiptFile: e.target.files[0]})} required style={{color:'white'}} />

                <div style={{display:'flex', gap:'10px', marginTop:'15px'}}>
                    <button type="button" onClick={()=>setStep(2)} className="button-link back-btn">رجوع</button>
                    <button type="submit" disabled={loading} className="button-link action-btn submit-btn">
                        {loading ? 'جاري الرفع...' : '✅ تأكيد وإرسال'}
                    </button>
                </div>
            </form>
        )}
      </div>

      <style jsx>{`
        /* جعل الصندوق ينمو مع المحتوى بدلاً من التمرير الداخلي */
        .form-box { 
            background: #1e293b; 
            padding: 25px; 
            border-radius: 12px; 
            width: 100%; 
            max-width: 600px; 
            border: 1px solid #334155; 
            margin: 20px 0; /* مسافة من الأعلى والأسفل */
            height: auto; /* ارتفاع تلقائي */
        }
        
        .title { text-align: center; color: #38bdf8; margin-bottom: 25px; }
        .form-column { display: flex; flex-direction: column; gap: 15px; }
        
        .input-field { 
            padding: 12px; background: #0f172a; border: 1px solid #475569; 
            border-radius: 6px; color: white; width: 100%; font-size: 16px; 
        }
        .input-field:focus { border-color: #38bdf8; outline: none; }
        
        .action-btn { flex: 2; justify-content: center; font-weight: bold; }
        .back-btn { flex: 1; background: #334155; justify-content: center; }
        .submit-btn { background: #22c55e; color: white; }
        
        /* إزالة القيود على الطول ليظهر كل شيء */
        .courses-list { 
            display: flex; 
            flex-direction: column; 
            gap: 20px; 
        }
        
        .course-group { 
            background: #0f172a; 
            border-radius: 8px; 
            border: 1px solid #334155; 
            overflow: visible; /* السماح بالمحتوى بالظهور */
        }
        
        .course-header { 
            padding: 15px; 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            background: #1e293b; 
            border-bottom: 1px solid #334155; 
        }
        .course-header.selected { background: #0c4a6e; border-color: #0ea5e9; }
        
        .subjects-list { 
            padding: 15px; 
            background: #0f172a; 
            /* لا يوجد max-height هنا، ستأخذ الطول المناسب لعدد المواد */
        }
        
        .subject-item { 
            display: flex; 
            justify-content: space-between; 
            padding: 12px 0; 
            border-bottom: 1px dashed #334155; 
        }
        .subject-item:last-child { border-bottom: none; }
        
        .price-tag { background: #334155; padding: 4px 10px; border-radius: 4px; color: #38bdf8; font-weight: bold; }
        .price-tag.small { font-size: 0.9em; background: #1e293b; color: #94a3b8; }
        
        .total-bar { 
            text-align: center; font-size: 1.3em; font-weight: bold; 
            padding: 15px; background: #0f172a; border-radius: 8px; 
            margin: 10px 0; border: 1px solid #334155; 
            position: sticky; bottom: 0; z-index: 10; /* شريط الإجمالي يثبت في الأسفل */
        }
        
        .payment-box { text-align: center; background: rgba(56, 189, 248, 0.1); padding: 15px; border-radius: 8px; border: 1px dashed #38bdf8; margin-bottom: 15px; }
      `}</style>
    </div>
  );
}
