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

  const [newlyGeneratedCodes, setNewlyGeneratedCodes] = useState([]);
  const [copied, setCopied] = useState(false);

  // دالة موحدة لجلب البيانات من الـ API
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

  const handleGenerate = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setNewlyGeneratedCodes([]); 
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
        if (data.generated_codes) {
          setNewlyGeneratedCodes(data.generated_codes); 
        }
        setDiscountValue('');
        setQuantity(10);
        fetchData(); // تحديث الجدول بعد التوليد
      } else {
        setMessage({ type: 'error', text: data.message || 'حدث خطأ غير متوقع' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'حدث خطأ في الاتصال بالخادم' });
    } finally {
      setLoading(false);
    }
  };

  const copyCodesToClipboard = () => {
    if (!newlyGeneratedCodes || newlyGeneratedCodes.length === 0) return;

    const textToCopy = newlyGeneratedCodes.map(item => {
      const valText = item.discount_type === 'percentage' 
        ? `${item.discount_value}%` 
        : `${item.discount_value} ج.م`;
      return `${item.code} (${valText})`;
    }).join('\n');

    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000); 
    }).catch(err => {
      console.error("Failed to copy:", err);
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
        <div style={{ padding: '20px', direction: 'rtl', fontFamily: 'system-ui, sans-serif' }}>
          <h2 style={{ marginBottom: '20px', color: '#fff' }}>🎟️ إدارة وتوليد أكواد الخصم (Coupons)</h2>
          
          {message.text && (
            <div style={{
              padding: '12px',
              marginBottom: '20px',
              backgroundColor: message.type === 'success' ? '#d4edda' : '#f8d7da',
              color: message.type === 'success' ? '#155724' : '#721c24',
              border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
              borderRadius: '5px',
              fontWeight: 'bold'
            }}>
              {message.text}
            </div>
          )}

          {newlyGeneratedCodes.length > 0 && (
            <div style={{ background: '#e8f4fd', padding: '20px', borderRadius: '10px', border: '1px solid #b6d4fe', marginBottom: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, color: '#084298' }}>🎉 الأكواد الجديدة (جاهزة للنسخ)</h3>
                <button 
                  onClick={copyCodesToClipboard}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: copied ? '#198754' : '#0d6efd',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {copied ? '✅ تم النسخ!' : '📋 نسخ الأكواد'}
                </button>
              </div>
              
              <textarea 
                readOnly 
                value={newlyGeneratedCodes.map(item => `${item.code} (${item.discount_type === 'percentage' ? item.discount_value + '%' : item.discount_value + ' ج.م'})`).join('\n')}
                style={{
                  width: '100%',
                  height: '150px',
                  padding: '10px',
                  borderRadius: '5px',
                  border: '1px solid #b6d4fe',
                  fontSize: '16px',
                  fontFamily: 'monospace',
                  resize: 'vertical',
                  backgroundColor: '#fff',
                  color: '#000'
                }}
              />
            </div>
          )}

          <div style={{ background: '#1e293b', padding: '24px', borderRadius: '10px', border: '1px solid #334155', marginBottom: '30px' }}>
            <h3 style={{ marginBottom: '20px', color: '#f8fafc', borderBottom: '2px solid #334155', paddingBottom: '10px' }}>
              ⚙️ إعدادات التوليد
            </h3>
            
            <form onSubmit={handleGenerate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#cbd5e1' }}>ارتباط الأكواد بالمدرس:</label>
                <select 
                  value={teacherId} 
                  onChange={(e) => setTeacherId(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff', fontSize: '15px' }}
                  required
                >
                  <option value="">-- يرجى اختيار المدرس --</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#cbd5e1' }}>نوع الخصم:</label>
                <select 
                  value={discountType} 
                  onChange={(e) => setDiscountType(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff', fontSize: '15px' }}
                >
                  <option value="percentage">نسبة مئوية (%)</option>
                  <option value="fixed">مبلغ ثابت (جنيه)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#cbd5e1' }}>قيمة الخصم:</label>
                <input 
                  type="number" 
                  min="1"
                  step="any"
                  value={discountValue} 
                  onChange={(e) => setDiscountValue(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff', fontSize: '15px' }}
                  placeholder={discountType === 'percentage' ? 'مثال: 20 (يعني 20%)' : 'مثال: 100 (يعني خصم 100 جنيه)'}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#cbd5e1' }}>الكمية المطلوبة:</label>
                <input 
                  type="number" 
                  min="1"
                  max="1000"
                  value={quantity} 
                  onChange={(e) => setQuantity(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff', fontSize: '15px' }}
                  required
                />
              </div>

              <div style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
                <button 
                  type="submit" 
                  disabled={loading}
                  style={{ 
                    padding: '14px 30px', 
                    backgroundColor: loading ? '#475569' : '#3b82f6', 
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: '6px', 
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    width: '100%',
                    transition: 'background-color 0.3s'
                  }}
                >
                  {loading ? '⏳ جاري توليد الأكواد وحفظها...' : '⚡ توليد الأكواد الآن'}
                </button>
              </div>
            </form>
          </div>

          <div style={{ background: '#1e293b', padding: '24px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ marginBottom: '20px', color: '#f8fafc', borderBottom: '2px solid #334155', paddingBottom: '10px' }}>
              📋 أحدث الأكواد (أحدث 100 كود)
            </h3>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0f172a', borderBottom: '2px solid #475569' }}>
                    <th style={{ padding: '15px', color: '#94a3b8' }}>كود الخصم</th>
                    <th style={{ padding: '15px', color: '#94a3b8' }}>يتبع للمدرس</th>
                    <th style={{ padding: '15px', color: '#94a3b8' }}>قيمة الخصم</th>
                    <th style={{ padding: '15px', color: '#94a3b8' }}>تاريخ الإنشاء</th>
                    <th style={{ padding: '15px', color: '#94a3b8' }}>حالة الكود</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                        لا توجد أكواد خصم مسجلة في قاعدة البيانات حتى الآن.
                      </td>
                    </tr>
                  ) : (
                    codes.map(code => (
                      <tr key={code.id} style={{ borderBottom: '1px solid #334155' }}>
                        <td style={{ padding: '15px', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '1px', color: '#60a5fa' }}>
                          {code.code}
                        </td>
                        <td style={{ padding: '15px', fontWeight: '500', color: '#f8fafc' }}>
                          {getTeacherName(code)}
                        </td>
                        <td style={{ padding: '15px', color: '#34d399', fontWeight: '900' }}>
                          {renderDiscountValue(code.discount_type, code.discount_value)}
                        </td>
                        <td style={{ padding: '15px', fontSize: '13px', color: '#94a3b8' }}>
                          {formatDate(code.created_at)}
                        </td>
                        <td style={{ padding: '15px' }}>
                          {code.is_used ? (
                            <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #ef4444' }}>
                              🔥 مستخدَم
                            </span>
                          ) : (
                            <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #10b981' }}>
                              ✅ متاح
                            </span>
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
        <div style={{ minHeight: '50vh', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#fff' }}>
           جاري التحميل...
        </div>
      )}
    </SuperLayout>
  );
}
