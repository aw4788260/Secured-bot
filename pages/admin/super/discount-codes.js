import { useState, useEffect } from 'react';
import Head from 'next/head';
import SuperLayout from '../../../components/SuperLayout';

export default function DiscountCodes() {
  const [isClient, setIsClient] = useState(false);
  const [teachers, setTeachers] = useState([]);
  const [codes, setCodes] = useState([]);
  const [totalCodes, setTotalCodes] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  
  // الفورم
  const [teacherId, setTeacherId] = useState('');
  const [discountType, setDiscountType] = useState('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [quantity, setQuantity] = useState(10);
  
  // التنبيهات والأكواد المولدة
  const [message, setMessage] = useState({ type: '', text: '' });
  const [newlyGeneratedCodes, setNewlyGeneratedCodes] = useState([]);
  const [copiedBulk, setCopiedBulk] = useState(false);

  // التصفح (Pagination)
  const [page, setPage] = useState(1);
  const limit = 50;

  // الفلاتر
  const [filters, setFilters] = useState({
    teacherId: 'all',
    type: 'all',
    value: '',
    isUsed: 'all'
  });

  // العمليات الجماعية (Bulk Actions)
  const [selectedCodes, setSelectedCodes] = useState([]);

  // جلب البيانات مع الفلاتر والتصفح
  const fetchData = async () => {
    setTableLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page,
        limit,
        teacherId: filters.teacherId,
        type: filters.type,
        value: filters.value,
        isUsed: filters.isUsed
      }).toString();

      const res = await fetch(`/api/dashboard/super/generate-discount-codes?${queryParams}`);
      if (res.ok) {
        const data = await res.json();
        setTeachers(data.teachers || []);
        setCodes(data.codes || []);
        setTotalCodes(data.total || 0);
        setSelectedCodes([]); // تصفير التحديد عند تغيير الصفحة أو الفلتر
      }
    } catch (e) {
      console.error("فشل الاتصال بالخادم", e);
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    setIsClient(true);
    fetchData();
  }, [page]); // يعيد الجلب عند تغيير الصفحة فقط

  const handleApplyFilters = () => {
    setPage(1); // العودة للصفحة الأولى عند تطبيق الفلتر
    fetchData();
  };

  const handleClearFilters = () => {
    setFilters({ teacherId: 'all', type: 'all', value: '', isUsed: 'all' });
    setPage(1);
    setTimeout(fetchData, 100);
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setNewlyGeneratedCodes([]);
    setCopiedBulk(false);

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
          action: 'generate', // ✅ تحديد الإجراء للباك اند
          teacher_id: parseInt(teacherId),
          discount_type: discountType,
          discount_value: parseFloat(discountValue),
          quantity: parseInt(quantity)
        })
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message });
        if (data.generated_codes) setNewlyGeneratedCodes(data.generated_codes); 
        
        setDiscountValue('');
        setQuantity(10);
        
        // مسح الفلاتر ليظهر الكود الجديد في الجدول أولاً
        handleClearFilters(); 
      } else {
        setMessage({ type: 'error', text: data.message || 'حدث خطأ غير متوقع' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'حدث خطأ في الاتصال بالخادم' });
    } finally {
      setLoading(false);
    }
  };

  // دوال النسخ
  const copySingleCode = (codeStr) => {
    navigator.clipboard.writeText(codeStr);
    // إشعار بسيط جداً
    const toast = document.createElement('div');
    toast.textContent = 'تم النسخ!';
    toast.style.cssText = 'position:fixed; bottom:20px; right:20px; background:#10b981; color:#fff; padding:10px 20px; border-radius:5px; z-index:9999;';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  };

  const copyBulkCodes = () => {
    if (!newlyGeneratedCodes.length) return;
    const textToCopy = newlyGeneratedCodes.map(item => item.code).join('\n');
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedBulk(true);
      setTimeout(() => setCopiedBulk(false), 2000); 
    });
  };

  // العمليات الجماعية
  const toggleSelectAll = (e) => {
    setSelectedCodes(e.target.checked ? codes.map(c => c.id) : []);
  };

  const toggleSelect = (id) => {
    setSelectedCodes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const executeBulkAction = async (actionType) => {
    if (selectedCodes.length === 0) return;

    let confirmMsg = '';
    let apiAction = '';
    let extraPayload = {};

    if (actionType === 'delete') {
      confirmMsg = `هل أنت متأكد من حذف ${selectedCodes.length} كوبون نهائياً؟`;
      apiAction = 'delete';
    } else if (actionType === 'deactivate') {
      confirmMsg = `تعطيل ${selectedCodes.length} كوبون وجعلها (مستخدمة)؟`;
      apiAction = 'update_status';
      extraPayload = { is_used: true };
    } else if (actionType === 'activate') {
      confirmMsg = `إعادة تنشيط ${selectedCodes.length} كوبون؟`;
      apiAction = 'update_status';
      extraPayload = { is_used: false };
    }

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch('/api/dashboard/super/generate-discount-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: apiAction, ids: selectedCodes, ...extraPayload })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message });
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'خطأ بالاتصال بالخادم' });
    }
  };

  const renderDiscountValue = (type, val) => type === 'percentage' ? `${val} %` : `${val} ج.م`;
  const totalPages = Math.ceil(totalCodes / limit);

  return (
    <SuperLayout>
      <Head><title>إدارة الكوبونات | الإدارة العليا</title></Head>

      {isClient ? (
        <div className="page-wrapper">
          <h2 className="page-title">🎟️ إدارة وتوليد أكواد الخصم (Coupons)</h2>
          
          {message.text && (
            <div className={`alert-box ${message.type}`}>{message.text}</div>
          )}

          {/* 1. إعدادات التوليد */}
          <div className="card-container">
            <h3 className="card-title">⚙️ إنشاء كوبونات جديدة</h3>
            <form onSubmit={handleGenerate} className="generate-form">
              <div className="form-group">
                <label>ارتباط الأكواد بالمدرس:</label>
                <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="form-input" required>
                  <option value="">-- يرجى اختيار المدرس --</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>نوع الخصم:</label>
                <select value={discountType} onChange={(e) => setDiscountType(e.target.value)} className="form-input">
                  <option value="percentage">نسبة مئوية (%)</option>
                  <option value="fixed">مبلغ ثابت (جنيه)</option>
                </select>
              </div>
              <div className="form-group">
                <label>قيمة الخصم:</label>
                <input type="number" min="1" step="any" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className="form-input" placeholder={discountType === 'percentage' ? 'مثال: 20' : 'مثال: 100'} required />
              </div>
              <div className="form-group">
                <label>الكمية المطلوبة:</label>
                <input type="number" min="1" max="1000" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="form-input" required />
              </div>
              <div className="form-submit">
                <button type="submit" disabled={loading} className={`submit-btn ${loading ? 'loading' : ''}`}>
                  {loading ? '⏳ جاري التوليد...' : '⚡ توليد الأكواد الآن'}
                </button>
              </div>
            </form>
          </div>

          {/* 2. الأكواد المولدة حديثاً (مكانها الجديد فوق الجدول) */}
          {newlyGeneratedCodes.length > 0 && (
            <div className="new-codes-container">
              <div className="new-codes-header">
                <h3>🎉 الأكواد الجديدة (جاهزة للنسخ)</h3>
                <button onClick={copyBulkCodes} className={`copy-btn ${copiedBulk ? 'copied' : ''}`}>
                  {copiedBulk ? '✅ تم النسخ!' : '📋 نسخ الكل كقائمة'}
                </button>
              </div>
              <textarea readOnly className="new-codes-textarea" value={newlyGeneratedCodes.map(item => item.code).join('\n')} rows={Math.min(10, newlyGeneratedCodes.length)} />
            </div>
          )}

          {/* 3. شريط الفلترة والأدوات للجدول */}
          <div className="filters-container">
              <div className="filters-grid">
                  <select className="filter-input" value={filters.teacherId} onChange={e=>setFilters({...filters, teacherId: e.target.value})}>
                      <option value="all">👨‍🏫 كل المدرسين</option>
                      {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <select className="filter-input" value={filters.type} onChange={e=>setFilters({...filters, type: e.target.value})}>
                      <option value="all">نوع الخصم (الكل)</option>
                      <option value="percentage">نسبة مئوية (%)</option>
                      <option value="fixed">مبلغ ثابت</option>
                  </select>
                  <input type="number" className="filter-input" placeholder="قيمة الخصم..." value={filters.value} onChange={e=>setFilters({...filters, value: e.target.value})} />
                  <select className="filter-input" value={filters.isUsed} onChange={e=>setFilters({...filters, isUsed: e.target.value})}>
                      <option value="all">الحالة (الكل)</option>
                      <option value="false">✅ متاح</option>
                      <option value="true">🔥 مستخدم/معطل</option>
                  </select>
              </div>
              <div className="filters-actions">
                  <button onClick={handleApplyFilters} className="btn-apply">🔍 بحث وتطبيق</button>
                  <button onClick={handleClearFilters} className="btn-clear">✖ مسح الفلاتر</button>
              </div>
          </div>

          {/* 4. العمليات الجماعية والجدول */}
          <div className="card-container table-card">
            <div className="table-header-flex">
               <h3 className="card-title m-0">📋 قاعدة بيانات الكوبونات ({totalCodes})</h3>
               {selectedCodes.length > 0 && (
                   <div className="bulk-actions">
                       <span className="selected-count">محدد ({selectedCodes.length})</span>
                       <button className="bulk-btn green" onClick={() => executeBulkAction('activate')}>تنشيط</button>
                       <button className="bulk-btn orange" onClick={() => executeBulkAction('deactivate')}>تعطيل</button>
                       <button className="bulk-btn red" onClick={() => executeBulkAction('delete')}>حذف</button>
                   </div>
               )}
            </div>

            <div className="table-responsive">
              <table className="codes-table">
                <thead>
                  <tr>
                    <th style={{width: '40px'}}><input type="checkbox" onChange={toggleSelectAll} checked={codes.length > 0 && selectedCodes.length === codes.length} /></th>
                    <th>كود الخصم</th>
                    <th>المدرس</th>
                    <th>القيمة</th>
                    <th>تاريخ الإنشاء</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {tableLoading ? (
                    <tr><td colSpan="6" className="empty-table">جاري التحميل...</td></tr>
                  ) : codes.length === 0 ? (
                    <tr><td colSpan="6" className="empty-table">لا توجد نتائج تطابق بحثك.</td></tr>
                  ) : (
                    codes.map(code => (
                      <tr key={code.id} className={selectedCodes.includes(code.id) ? 'selected-row' : ''}>
                        <td><input type="checkbox" checked={selectedCodes.includes(code.id)} onChange={() => toggleSelect(code.id)} /></td>
                        <td>
                            <div className="code-cell">
                                <span className="code-text">{code.code}</span>
                                <button className="icon-btn" onClick={() => copySingleCode(code.code)} title="نسخ الكود">📋</button>
                            </div>
                        </td>
                        <td className="teacher-name">{code.teachers?.name || 'غير محدد'}</td>
                        <td className="discount-value">{renderDiscountValue(code.discount_type, code.discount_value)}</td>
                        <td className="date-text">{new Date(code.created_at).toLocaleDateString('ar-EG')}</td>
                        <td>
                          {code.is_used ? (
                            <span className="status-badge used">🔥 معطل/مستخدم</span>
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="pagination">
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>السابق</button>
                    <span>صفحة {page} من {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>التالي</button>
                </div>
            )}
          </div>
        </div>
      ) : (
        <div className="loading-screen">جاري التحميل...</div>
      )}

      <style jsx>{`
        .page-wrapper { padding: 20px; direction: rtl; font-family: system-ui, sans-serif; padding-bottom: 50px; }
        .page-title { margin-bottom: 20px; color: #fff; }
        .loading-screen { min-height: 50vh; display: flex; justify-content: center; align-items: center; color: #38bdf8; font-size: 1.2rem; font-weight: bold; }

        .alert-box { padding: 12px 20px; margin-bottom: 20px; border-radius: 8px; font-weight: bold; }
        .alert-box.success { background-color: rgba(34, 197, 94, 0.1); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); }
        .alert-box.error { background-color: rgba(239, 68, 68, 0.1); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.3); }

        .card-container { background: #1e293b; padding: 25px; border-radius: 12px; border: 1px solid #334155; margin-bottom: 30px; }
        .card-title { margin: 0 0 20px 0; color: #f8fafc; border-bottom: 2px solid #334155; padding-bottom: 12px; }
        .m-0 { margin-bottom: 0; border: none; padding: 0; }

        /* Form */
        .generate-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
        .form-group label { display: block; margin-bottom: 8px; font-weight: bold; color: #cbd5e1; font-size: 0.9rem; }
        .form-input { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #475569; background-color: #0f172a; color: #fff; outline: none; }
        .form-input:focus { border-color: #38bdf8; }
        .form-submit { grid-column: 1 / -1; margin-top: 5px; }
        .submit-btn { width: 100%; padding: 14px; background: #3b82f6; color: #fff; border: none; border-radius: 8px; font-weight: bold; font-size: 1.1rem; cursor: pointer; transition: 0.2s; }
        .submit-btn:hover:not(:disabled) { background: #2563eb; }
        .submit-btn.loading { background: #475569; cursor: not-allowed; }

        /* New Codes Box */
        .new-codes-container { background: rgba(56, 189, 248, 0.05); padding: 20px; border-radius: 12px; border: 1px solid #38bdf8; margin-bottom: 30px; }
        .new-codes-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .new-codes-header h3 { margin: 0; color: #38bdf8; }
        .copy-btn { background: #38bdf8; color: #0f172a; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s; }
        .copy-btn.copied { background: #22c55e; color: white; }
        .new-codes-textarea { width: 100%; padding: 15px; background: #0f172a; color: #e2e8f0; border: 1px solid #475569; border-radius: 8px; font-family: monospace; font-size: 1.1rem; line-height: 1.6; resize: vertical; outline: none; }

        /* Filters */
        .filters-container { background: #0f172a; padding: 15px; border-radius: 12px; border: 1px solid #334155; margin-bottom: 20px; display: flex; flex-direction: column; gap: 15px; }
        .filters-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }
        .filter-input { padding: 10px; border-radius: 6px; border: 1px solid #475569; background: #1e293b; color: white; outline: none; }
        .filters-actions { display: flex; justify-content: flex-end; gap: 10px; }
        .btn-apply { background: #3b82f6; color: white; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; }
        .btn-clear { background: transparent; color: #fca5a5; border: 1px solid #ef4444; padding: 8px 20px; border-radius: 6px; cursor: pointer; }

        /* Table & Bulk */
        .table-card { padding: 0; overflow: hidden; }
        .table-header-flex { display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid #334155; background: #111827; flex-wrap: wrap; gap: 15px; }
        
        .bulk-actions { display: flex; gap: 10px; align-items: center; background: rgba(255,255,255,0.05); padding: 5px 10px; border-radius: 8px; }
        .selected-count { color: #38bdf8; font-weight: bold; font-size: 0.9rem; margin-left: 10px; }
        .bulk-btn { border: none; padding: 6px 12px; border-radius: 6px; color: white; cursor: pointer; font-size: 0.85rem; font-weight: bold; }
        .bulk-btn.green { background: #22c55e; } .bulk-btn.orange { background: #f59e0b; } .bulk-btn.red { background: #ef4444; }

        .table-responsive { overflow-x: auto; }
        .codes-table { width: 100%; border-collapse: collapse; text-align: right; }
        .codes-table th { padding: 15px; background: #0f172a; color: #94a3b8; font-size: 0.9rem; border-bottom: 1px solid #334155; white-space: nowrap; }
        .codes-table td { padding: 15px; border-bottom: 1px solid #334155; vertical-align: middle; }
        .codes-table tr:hover { background: rgba(255, 255, 255, 0.02); }
        .selected-row { background: rgba(56, 189, 248, 0.05) !important; }
        .empty-table { text-align: center; padding: 40px !important; color: #64748b; }

        .code-cell { display: flex; align-items: center; gap: 10px; }
        .code-text { font-family: monospace; font-size: 1.1rem; color: #60a5fa; font-weight: bold; }
        .icon-btn { background: #334155; border: none; padding: 5px; border-radius: 4px; cursor: pointer; transition: 0.2s; }
        .icon-btn:hover { background: #38bdf8; color: #0f172a; }

        .teacher-name { color: #f8fafc; font-weight: 500; }
        .discount-value { color: #34d399; font-weight: bold; }
        .date-text { color: #94a3b8; font-size: 0.85rem; }

        .status-badge { padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; }
        .status-badge.used { background: rgba(239, 68, 68, 0.15); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.3); }
        .status-badge.active { background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); }

        /* Pagination */
        .pagination { display: flex; justify-content: center; align-items: center; gap: 15px; padding: 20px; background: #0f172a; color: #94a3b8; }
        .pagination button { background: #1e293b; border: 1px solid #334155; color: white; padding: 8px 16px; border-radius: 6px; cursor: pointer; }
        .pagination button:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </SuperLayout>
  );
}
