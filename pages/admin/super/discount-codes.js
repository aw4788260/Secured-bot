import { useState, useEffect } from 'react';
import Head from 'next/head';
import SuperLayout from '../../../components/SuperLayout';

export default function DiscountCodes() {
  const [isClient, setIsClient] = useState(false);
  const [teachers, setTeachers] = useState([]);
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // حالة النموذج
  const [teacherId, setTeacherId] = useState('');
  const [discountType, setDiscountType] = useState('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [quantity, setQuantity] = useState(10);
  const [message, setMessage] = useState({ type: '', text: '' });

  // ✅ حالات ميزة "نسخ الأكواد الجديدة"
  const [newlyGeneratedCodes, setNewlyGeneratedCodes] = useState([]);
  const [copied, setCopied] = useState(false);

  // دالة جلب البيانات الآمنة (API)
  const fetchData = async () => {
    try {
      const res = await fetch('/api/dashboard/super/generate-discount-codes');
      if (res.ok) {
        const data = await res.json();
        setTeachers(data.teachers || []);
        setCodes(data.codes || []);
      }
    } catch (e) {
      console.error("فشل الاتصال بالخادم", e);
    }
  };

  useEffect(() => {
    setIsClient(true);
    fetchData();
  }, []);

  // دالة توليد الأكواد
  const handleGenerate = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setNewlyGeneratedCodes([]); // تصفير الأكواد القديمة
    setCopied(false);

    if (!teacherId || !discountValue || !quantity) {
      setMessage({ type: 'error', text: 'يرجى تعبئة جميع الحقول المطلوبة' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/super/generate-discount-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_id: parseInt(teacherId),
          discount_type: discountType,
          discount_value: parseFloat(discountValue),
          quantity: parseInt(quantity)
        })
      });

      let data;
      try {
        data = await res.json();
      } catch (parseError) {
        throw new Error('الخادم لا يستجيب بشكل صحيح.');
      }

      if (res.ok) {
        setMessage({ type: 'success', text: data.message });
        
        // ✅ حفظ الأكواد الجديدة لعرضها في المربع المنفصل
        if (data.generated_codes) {
          setNewlyGeneratedCodes(data.generated_codes); 
        }
        
        setDiscountValue('');
        setQuantity(10);
        fetchData(); // تحديث الجدول السفلي
      } else {
        setMessage({ type: 'error', text: data.message || 'حدث خطأ غير متوقع' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'حدث خطأ في الاتصال بالخادم' });
    } finally {
      setLoading(false);
    }
  };

  // ✅ دالة النسخ إلى الحافظة (كل كود في سطر)
  const copyCodesToClipboard = () => {
    if (!newlyGeneratedCodes || newlyGeneratedCodes.length === 0) return;

    // استخراج نص الكود فقط ووضع كل كود في سطر جديد
    const textToCopy = newlyGeneratedCodes.map(item => item.code).join('\n');

    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      // إرجاع الزر لشكله الطبيعي بعد ثانيتين
      setTimeout(() => setCopied(false), 2000); 
    }).catch(err => {
      console.error("Failed to copy:", err);
      alert('فشل النسخ التلقائي، يرجى النسخ يدوياً.');
    });
  };

  const renderDiscountValue = (type, val) => {
    return type === 'percentage' ? `${val} %` : `${val} ج.م`;
  };

  const getTeacherName = (codeObj) => {
    if (!codeObj || !codeObj.teachers) return 'غير محدد';
    if (Array.isArray(codeObj.teachers)) return codeObj.teachers[0]?.name || 'غير محدد';
    return codeObj.teachers.name || 'غير محدد';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
    } catch (e) {
      return 'تاريخ غير صالح';
    }
  };

  return (
    <SuperLayout>
      <Head>
        <title>توليد أكواد الخصم | الإدارة العليا</title>
      </Head>

      {isClient ? (
        <div className="page-wrapper">
          <h2 className="page-title">🎟️ إدارة وتوليد أكواد الخصم (Coupons)</h2>
          
          {message.text && (
            <div className={`alert-box ${message.type}`}>
              {message.text}
            </div>
          )}

          {/* ✅ المربع المنفصل للأكواد المولدة حديثاً */}
          {newlyGeneratedCodes.length > 0 && (
            <div className="new-codes-container">
              <div className="new-codes-header">
                <h3>🎉 الأكواد الجديدة (جاهزة للنسخ)</h3>
                <button 
                  onClick={copyCodesToClipboard}
                  className={`copy-btn ${copied ? 'copied' : ''}`}
                >
                  {copied ? '✅ تم النسخ!' : '📋 نسخ الأكواد'}
                </button>
              </div>
              
              <textarea 
                readOnly 
                className="new-codes-textarea"
                value={newlyGeneratedCodes.map(item => item.code).join('\n')}
                rows={Math.min(10, newlyGeneratedCodes.length)} // تحديد الطول بناءً على العدد (بحد أقصى 10 سطور مرئية)
              />
              <p className="hint-text">الأكواد مرتبة كود واحد في كل سطر لتسهيل الإرسال.</p>
            </div>
          )}

          {/* فورم توليد الأكواد */}
          <div className="card-container">
            <h3 className="card-title">⚙️ إعدادات التوليد</h3>
            
            <form onSubmit={handleGenerate} className="generate-form">
              <div className="form-group">
                <label>ارتباط الأكواد بالمدرس:</label>
                <select 
                  value={teacherId} 
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="form-input"
                  required
                >
                  <option value="">-- يرجى اختيار المدرس --</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>نوع الخصم:</label>
                <select 
                  value={discountType} 
                  onChange={(e) => setDiscountType(e.target.value)}
                  className="form-input"
                >
                  <option value="percentage">نسبة مئوية (%)</option>
                  <option value="fixed">مبلغ ثابت (جنيه)</option>
                </select>
              </div>

              <div className="form-group">
                <label>قيمة الخصم:</label>
                <input 
                  type="number" 
                  min="1"
                  step="any"
                  value={discountValue} 
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="form-input"
                  placeholder={discountType === 'percentage' ? 'مثال: 20 (يعني 20%)' : 'مثال: 100 (يعني خصم 100 جنيه)'}
                  required
                />
              </div>

              <div className="form-group">
                <label>الكمية المطلوبة:</label>
                <input 
                  type="number" 
                  min="1"
                  max="1000"
                  value={quantity} 
                  onChange={(e) => setQuantity(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-submit">
                <button 
                  type="submit" 
                  disabled={loading}
                  className={`submit-btn ${loading ? 'loading' : ''}`}
                >
                  {loading ? '⏳ جاري توليد الأكواد وحفظها...' : '⚡ توليد الأكواد الآن'}
                </button>
              </div>
            </form>
          </div>

          {/* جدول أحدث 100 كود */}
          <div className="card-container">
            <h3 className="card-title">📋 أحدث الأكواد (أحدث 100 كود)</h3>
            
            <div className="table-responsive">
              <table className="codes-table">
                <thead>
                  <tr>
                    <th>كود الخصم</th>
                    <th>يتبع للمدرس</th>
                    <th>قيمة الخصم</th>
                    <th>تاريخ الإنشاء</th>
                    <th>حالة الكود</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="empty-table">
                        لا توجد أكواد خصم مسجلة في قاعدة البيانات حتى الآن.
                      </td>
                    </tr>
                  ) : (
                    codes.map(code => (
                      <tr key={code.id}>
                        <td className="code-text">{code.code}</td>
                        <td className="teacher-name">{getTeacherName(code)}</td>
                        <td className="discount-value">
                          {renderDiscountValue(code.discount_type, code.discount_value)}
                        </td>
                        <td className="date-text">{formatDate(code.created_at)}</td>
                        <td>
                          {code.is_used ? (
                            <span className="status-badge used">🔥 مستخدَم</span>
                          ) : (
                            <span className="status-badge active">✅ متاح</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      ) : (
        <div className="loading-screen">جاري التحميل...</div>
      )}

      <style jsx>{`
        /* تنسيقات عامة للصفحة */
        .page-wrapper { padding: 20px; direction: rtl; font-family: system-ui, sans-serif; }
        .page-title { margin-bottom: 20px; color: #fff; }
        
        .loading-screen { min-height: 50vh; display: flex; justify-content: center; align-items: center; color: #38bdf8; font-size: 1.2rem; font-weight: bold; }

        /* رسائل التنبيه */
        .alert-box { padding: 12px 20px; margin-bottom: 20px; border-radius: 8px; font-weight: bold; }
        .alert-box.success { background-color: rgba(34, 197, 94, 0.1); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); }
        .alert-box.error { background-color: rgba(239, 68, 68, 0.1); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.3); }

        /* ✅ تنسيقات المربع الجديد للأكواد المنسوخة */
        .new-codes-container { background: rgba(56, 189, 248, 0.05); padding: 25px; border-radius: 12px; border: 1px solid #38bdf8; margin-bottom: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); animation: fadeIn 0.4s ease-out; }
        .new-codes-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px; }
        .new-codes-header h3 { margin: 0; color: #38bdf8; font-size: 1.2rem; }
        
        .copy-btn { padding: 10px 20px; background-color: #38bdf8; color: #0f172a; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 8px; font-size: 1rem; transition: all 0.2s; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .copy-btn:hover { background-color: #0ea5e9; transform: translateY(-2px); }
        .copy-btn.copied { background-color: #22c55e; color: white; }
        
        .new-codes-textarea { width: 100%; padding: 15px; border-radius: 8px; border: 1px solid #475569; font-size: 1.1rem; font-family: monospace; resize: vertical; background-color: #0f172a; color: #e2e8f0; line-height: 1.6; letter-spacing: 1px; outline: none; }
        .new-codes-textarea:focus { border-color: #38bdf8; }
        .hint-text { margin: 10px 0 0 0; color: #94a3b8; font-size: 0.85rem; }

        /* البطاقات والنماذج */
        .card-container { background: #1e293b; padding: 25px; border-radius: 12px; border: 1px solid #334155; margin-bottom: 30px; }
        .card-title { margin: 0 0 20px 0; color: #f8fafc; border-bottom: 2px solid #334155; padding-bottom: 12px; }
        
        .generate-form { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        @media (max-width: 768px) { .generate-form { grid-template-columns: 1fr; } }
        
        .form-group label { display: block; margin-bottom: 8px; font-weight: 600; color: #cbd5e1; font-size: 0.95rem; }
        .form-input { width: 100%; padding: 12px 15px; border-radius: 8px; border: 1px solid #475569; background-color: #0f172a; color: #fff; font-size: 1rem; outline: none; transition: border-color 0.2s; }
        .form-input:focus { border-color: #38bdf8; }
        
        .form-submit { grid-column: 1 / -1; margin-top: 10px; }
        .submit-btn { padding: 14px 30px; background-color: #22c55e; color: #0f172a; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 1.1rem; width: 100%; transition: all 0.2s; }
        .submit-btn:hover:not(:disabled) { background-color: #16a34a; transform: translateY(-2px); }
        .submit-btn.loading { background-color: #475569; color: #cbd5e1; cursor: not-allowed; }

        /* الجدول */
        .table-responsive { overflow-x: auto; }
        .codes-table { width: 100%; border-collapse: collapse; text-align: right; }
        .codes-table thead tr { background-color: #0f172a; border-bottom: 2px solid #475569; }
        .codes-table th { padding: 15px; color: #94a3b8; font-weight: 600; white-space: nowrap; }
        .codes-table tbody tr { border-bottom: 1px solid #334155; transition: background-color 0.2s; }
        .codes-table tbody tr:hover { background-color: rgba(255, 255, 255, 0.02); }
        .codes-table td { padding: 15px; vertical-align: middle; }
        
        .empty-table { padding: 30px !important; text-align: center; color: #94a3b8; font-style: italic; }
        
        .code-text { font-weight: bold; font-family: monospace; letter-spacing: 1px; color: #38bdf8; font-size: 1.05rem; }
        .teacher-name { font-weight: 500; color: #f8fafc; }
        .discount-value { color: #34d399; font-weight: 900; font-size: 1.05rem; }
        .date-text { font-size: 0.85rem; color: #94a3b8; }
        
        .status-badge { padding: 6px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; display: inline-block; white-space: nowrap; }
        .status-badge.used { background-color: rgba(239, 68, 68, 0.15); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.3); }
        .status-badge.active { background-color: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </SuperLayout>
  );
}
