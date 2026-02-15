import { useState, useEffect } from 'react';
import Head from 'next/head';
import SuperLayout from '../../../components/SuperLayout';
import { supabase } from '../../../lib/supabaseClient';

export default function DiscountCodes() {
  const [isClient, setIsClient] = useState(false); // ✅ حل مشكلة الـ Hydration Error
  const [teachers, setTeachers] = useState([]);
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // حالة النموذج
  const [teacherId, setTeacherId] = useState('');
  const [discountType, setDiscountType] = useState('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [quantity, setQuantity] = useState(10);
  const [message, setMessage] = useState({ type: '', text: '' });

  // حالة لحفظ الأكواد التي تم توليدها للتو
  const [newlyGeneratedCodes, setNewlyGeneratedCodes] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setIsClient(true); // ✅ تأكيد أننا في بيئة المتصفح
    fetchTeachers();
    fetchCodes();
  }, []);

  const fetchTeachers = async () => {
    try {
      const { data, error } = await supabase.from('teachers').select('id, name');
      if (data && !error) setTeachers(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('discount_codes')
        .select('*, teachers(name)')
        .order('created_at', { ascending: false })
        .limit(100);
        
      if (data && !error) setCodes(data);
    } catch (e) {
      console.error(e);
    }
  };

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

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message });
        if (data.generated_codes) {
          setNewlyGeneratedCodes(data.generated_codes); 
        }
        setDiscountValue('');
        setQuantity(10);
        fetchCodes();
      } else {
        setMessage({ type: 'error', text: data.message || 'حدث خطأ غير متوقع' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'حدث خطأ في الاتصال بالخادم' });
    } finally {
      setLoading(false);
    }
  };

  // دالة نسخ الأكواد بالشكل المطلوب
  const copyCodesToClipboard = () => {
    if (!newlyGeneratedCodes || newlyGeneratedCodes.length === 0) return;

    const textToCopy = newlyGeneratedCodes.map(item => {
      const valText = item.discount_type === 'percentage' 
        ? `${item.discount_value}%` 
        : `${item.discount_value} ج.م`;
      return `${item.code} (${valText})`; // كل كود وقيمته
    }).join('\n'); // سطر جديد لكل كود

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

  // ✅ منع الرندر حتى يتم التحميل في الكلاينت لتجنب الـ Hydration Error
  if (!isClient) return null;

  return (
    <SuperLayout>
      <Head>
        <title>توليد أكواد الخصم | الإدارة العليا</title>
      </Head>

      <div style={{ padding: '20px', direction: 'rtl', fontFamily: 'system-ui, sans-serif' }}>
        <h2 style={{ marginBottom: '20px', color: '#333' }}>🎟️ إدارة وتوليد أكواد الخصم (Coupons)</h2>
        
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

        {/* صندوق عرض الأكواد المولدّة حديثاً للنسخ */}
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
                backgroundColor: '#fff'
              }}
            />
          </div>
        )}

        {/* نموذج التوليد */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '30px' }}>
          <h3 style={{ marginBottom: '20px', color: '#444', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
            ⚙️ إعدادات التوليد
          </h3>
          
          <form onSubmit={handleGenerate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>ارتباط الأكواد بالمدرس:</label>
              <select 
                value={teacherId} 
                onChange={(e) => setTeacherId(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '15px' }}
                required
              >
                <option value="">-- يرجى اختيار المدرس --</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>نوع الخصم:</label>
              <select 
                value={discountType} 
                onChange={(e) => setDiscountType(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '15px' }}
              >
                <option value="percentage">نسبة مئوية (%)</option>
                <option value="fixed">مبلغ ثابت (جنيه)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>قيمة الخصم:</label>
              <input 
                type="number" 
                min="1"
                step="any"
                value={discountValue} 
                onChange={(e) => setDiscountValue(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '15px' }}
                placeholder={discountType === 'percentage' ? 'مثال: 20 (يعني 20%)' : 'مثال: 100 (يعني خصم 100 جنيه)'}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>الكمية المطلوبة:</label>
              <input 
                type="number" 
                min="1"
                max="1000"
                value={quantity} 
                onChange={(e) => setQuantity(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '15px' }}
                required
              />
            </div>

            <div style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
              <button 
                type="submit" 
                disabled={loading}
                style={{ 
                  padding: '14px 30px', 
                  backgroundColor: loading ? '#6c757d' : '#0d6efd', 
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

        {/* جدول عرض الأكواد */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginBottom: '20px', color: '#444', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
            📋 أحدث الأكواد (أحدث 100 كود)
          </h3>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ padding: '15px', color: '#495057' }}>كود الخصم</th>
                  <th style={{ padding: '15px', color: '#495057' }}>يتبع للمدرس</th>
                  <th style={{ padding: '15px', color: '#495057' }}>قيمة الخصم</th>
                  <th style={{ padding: '15px', color: '#495057' }}>تاريخ الإنشاء</th>
                  <th style={{ padding: '15px', color: '#495057' }}>حالة الكود</th>
                </tr>
              </thead>
              <tbody>
                {codes.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#6c757d' }}>
                      لا توجد أكواد خصم مسجلة في قاعدة البيانات حتى الآن.
                    </td>
                  </tr>
                ) : (
                  codes.map(code => (
                    <tr key={code.id} style={{ borderBottom: '1px solid #e9ecef', transition: 'background-color 0.2s' }}>
                      <td style={{ padding: '15px', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '1px', color: '#0d6efd' }}>
                        {code.code}
                      </td>
                      <td style={{ padding: '15px', fontWeight: '500' }}>
                        {code.teachers?.name || 'غير محدد'}
                      </td>
                      <td style={{ padding: '15px', color: '#198754', fontWeight: '900' }}>
                        {renderDiscountValue(code.discount_type, code.discount_value)}
                      </td>
                      <td style={{ padding: '15px', fontSize: '13px', color: '#6c757d' }}>
                        {/* استخدام دالة آمنة للتاريخ لتجنب أخطاء السيرفر/كلاينت */}
                        {code.created_at ? new Date(code.created_at).toLocaleDateString('ar-EG') : ''}
                      </td>
                      <td style={{ padding: '15px' }}>
                        {code.is_used ? (
                          <span style={{ backgroundColor: '#dc3545', color: '#fff', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                            🔥 مستخدَم (محروق)
                          </span>
                        ) : (
                          <span style={{ backgroundColor: '#198754', color: '#fff', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                            ✅ متاح للاستخدام
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
    </SuperLayout>
  );
}
