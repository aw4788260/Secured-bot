import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Register() {
  const router = useRouter();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [checkingUser, setCheckingUser] = useState(false); // حالة تحميل فحص الاسم
  
  const [formData, setFormData] = useState({
    firstName: '', username: '', password: '', phone: '',
    selectedCourses: [], receiptFile: null
  });

  useEffect(() => {
    fetch('/api/public/get-courses')
      .then(res => res.json())
      .then(data => { if(Array.isArray(data)) setCourses(data); })
      .catch(console.error);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(!formData.receiptFile) return alert("يجب رفع صورة الإيصال");
    if(formData.selectedCourses.length === 0) return alert("اختر كورس واحد على الأقل");

    setLoading(true);
    const body = new FormData();
    Object.keys(formData).forEach(key => {
      if (key === 'selectedCourses') body.append(key, JSON.stringify(formData[key]));
      else body.append(key, formData[key]);
    });

    const res = await fetch('/api/public/register', { method: 'POST', body });
    const result = await res.json();
    setLoading(false);

    if (res.ok) {
      alert("✅ تم إرسال طلبك بنجاح! سيتم مراجعته وتفعيل الحساب قريباً.");
      router.push('/login');
    } else {
      alert("❌ خطأ: " + result.error);
    }
  };

  // --- دالة الانتقال للخطوة التالية (المعدلة) ---
  const nextStep = async () => {
    // التحقق من الخطوة 1
    if (step === 1) {
        if (!formData.firstName || !formData.username || !formData.password || !formData.phone) {
            return alert("يرجى ملء جميع البيانات");
        }
        if (formData.username.length < 3) {
            return alert("اسم المستخدم يجب أن يكون 3 أحرف على الأقل");
        }

        // بدء التحقق من السيرفر
        setCheckingUser(true);
        try {
            const res = await fetch('/api/public/check-username', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: formData.username })
            });
            const data = await res.json();
            
            setCheckingUser(false);

            if (data.available) {
                setStep(2); // الانتقال فقط إذا كان الاسم متاحاً
            } else {
                alert("⚠️ " + data.message); // رسالة خطأ للمستخدم
            }
        } catch (err) {
            setCheckingUser(false);
            alert("حدث خطأ أثناء التحقق من الاسم، حاول مرة أخرى.");
        }
        return;
    }

    // التحقق من الخطوة 2
    if (step === 2) {
        if (formData.selectedCourses.length === 0) {
            return alert("يرجى اختيار كورس واحد على الأقل");
        }
        setStep(3);
    }
  };

  return (
    <div className="app-container" style={{justifyContent:'center'}}>
      <Head><title>طلب اشتراك جديد</title></Head>
      <div style={{background:'#1e293b', padding:'20px', borderRadius:'10px', width:'100%', maxWidth:'500px', border:'1px solid #334155'}}>
        <h2 style={{textAlign:'center', color:'#38bdf8', marginBottom:'20px'}}>
            {step === 1 ? '1. بيانات الطالب' : step === 2 ? '2. اختيار الكورسات' : '3. تأكيد الدفع'}
        </h2>
        
        {/* الخطوة 1 */}
        {step === 1 && (
            <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
              <input className="input-field" placeholder="الاسم الثلاثي" value={formData.firstName}
                onChange={e=>setFormData({...formData, firstName: e.target.value})} />
              
              <input className="input-field" placeholder="رقم الهاتف (واتساب)" value={formData.phone}
                onChange={e=>setFormData({...formData, phone: e.target.value})} />

              <div style={{display:'flex', gap:'10px'}}>
                <input className="input-field" placeholder="اسم المستخدم (Username)" value={formData.username}
                  onChange={e=>setFormData({...formData, username: e.target.value})} />
                <input className="input-field" type="password" placeholder="كلمة المرور" value={formData.password}
                  onChange={e=>setFormData({...formData, password: e.target.value})} />
              </div>

              <button onClick={nextStep} disabled={checkingUser} className="button-link" style={{justifyContent:'center', marginTop:'10px'}}>
                {checkingUser ? 'جاري التحقق...' : 'التالي ⬅️'}
              </button>
            </div>
        )}

        {/* الخطوة 2 */}
        {step === 2 && (
            <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
              <div style={{background:'#0f172a', padding:'10px', borderRadius:'8px', maxHeight:'250px', overflowY:'auto'}}>
                {courses.length > 0 ? courses.map(c => (
                  <label key={c.id} style={{display:'flex', justifyContent:'space-between', padding:'10px', borderBottom:'1px solid #334155', cursor:'pointer'}}>
                    <span>
                      <input type="checkbox" style={{marginLeft:'8px'}}
                        checked={formData.selectedCourses.includes(c.id)}
                        onChange={e => {
                          const sel = e.target.checked 
                            ? [...formData.selectedCourses, c.id]
                            : formData.selectedCourses.filter(id => id !== c.id);
                          setFormData({...formData, selectedCourses: sel});
                        }} 
                      />
                      {c.title}
                    </span>
                    <span style={{color:'#38bdf8'}}>{c.price} ج.م</span>
                  </label>
                )) : <p style={{textAlign:'center', padding:'20px', color:'#ccc'}}>لا توجد كورسات متاحة حالياً.</p>}
              </div>

              <div style={{display:'flex', gap:'10px'}}>
                <button onClick={()=>setStep(1)} className="button-link" style={{background:'#334155', flex:1, justifyContent:'center'}}>رجوع</button>
                <button onClick={nextStep} className="button-link" style={{flex:2, justifyContent:'center'}}>التالي ⬅️</button>
              </div>
            </div>
        )}

        {/* الخطوة 3 */}
        {step === 3 && (
            <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:'15px'}}>
              <div style={{textAlign:'center', padding:'15px', background:'rgba(56, 189, 248, 0.1)', borderRadius:'8px', border:'1px dashed #38bdf8'}}>
                 <p style={{marginBottom:'5px'}}>يرجى تحويل المبلغ الإجمالي على فودافون كاش:</p>
                 <h2 style={{color:'#38bdf8', direction:'ltr'}}>010 XXXXX XXXX</h2>
              </div>

              <div>
                <p style={{color:'#cbd5e1', fontSize:'0.9em', marginBottom:'5px'}}>صورة إيصال الدفع:</p>
                <input type="file" accept="image/*" required style={{color:'white'}}
                  onChange={e=>setFormData({...formData, receiptFile: e.target.files[0]})} />
              </div>

              <div style={{display:'flex', gap:'10px'}}>
                <button type="button" onClick={()=>setStep(2)} className="button-link" style={{background:'#334155', flex:1, justifyContent:'center'}}>رجوع</button>
                <button type="submit" disabled={loading} className="button-link" style={{justifyContent:'center', background:'#22c55e', color:'white', flex:2}}>
                    {loading ? 'جاري الإرسال...' : '🚀 إرسال الطلب'}
                </button>
              </div>
            </form>
        )}
        
        {step === 1 && (
            <button type="button" onClick={()=>router.push('/login')} style={{background:'none', border:'none', color:'#94a3b8', cursor:'pointer', marginTop:'15px', width:'100%'}}>
                العودة لتسجيل الدخول
            </button>
        )}
      </div>
      <style jsx>{`.input-field { padding:12px; background:#0f172a; border:1px solid #475569; borderRadius:5px; color:white; width:100% }`}</style>
    </div>
  );
}
