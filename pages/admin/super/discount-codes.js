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
  
  // الفورم الأساسي للتوليد
  const [teacherId, setTeacherId] = useState('');
  const [discountType, setDiscountType] = useState('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [quantity, setQuantity] = useState(10);
  
  // التنبيهات 
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // الأكواد المولدة حديثاً
  const [newlyGeneratedCodes, setNewlyGeneratedCodes] = useState([]);
  const [copiedBulk, setCopiedBulk] = useState(false);

  // مربع لصق الأكواد للإدارة السريعة
  const [pastedCodes, setPastedCodes] = useState('');

  // التصفح (Pagination)
  const [page, setPage] = useState(1);
  const limit = 50;

  // الفلاتر
  const [filters, setFilters] = useState({ teacherId: 'all', type: 'all', value: '', isUsed: 'all' });

  // العمليات الجماعية (Table)
  const [selectedCodes, setSelectedCodes] = useState([]);

  // نافذة التعديل المتقدم (Modal)
  const [advancedModal, setAdvancedModal] = useState({
      show: false, source: '', payload: {}, actionType: '', 
      newTeacher: '', newType: 'percentage', newValue: ''
  });

  // -------------------------------------------------------------
  // جلب البيانات
  // -------------------------------------------------------------
  const fetchData = async () => {
    setTableLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page, limit,
        teacherId: filters.teacherId, type: filters.type,
        value: filters.value, isUsed: filters.isUsed
      }).toString();

      const res = await fetch(`/api/dashboard/super/generate-discount-codes?${queryParams}`);
      if (res.ok) {
        const data = await res.json();
        setTeachers(data.teachers || []);
        setCodes(data.codes || []);
        setTotalCodes(data.total || 0);
        setSelectedCodes([]); 
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => { setIsClient(true); fetchData(); }, [page]);

  const handleApplyFilters = () => { setPage(1); fetchData(); };
  const handleClearFilters = () => {
    setFilters({ teacherId: 'all', type: 'all', value: '', isUsed: 'all' });
    setPage(1);
    setTimeout(fetchData, 100);
  };

  // -------------------------------------------------------------
  // توليد الأكواد
  // -------------------------------------------------------------
  const handleGenerate = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setNewlyGeneratedCodes([]);
    setCopiedBulk(false);

    if (!teacherId || !discountValue || !quantity) return setMessage({ type: 'error', text: 'يرجى تعبئة جميع الحقول المطلوبة' });

    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/super/generate-discount-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
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
        setDiscountValue(''); setQuantity(10);
        handleClearFilters(); 
      } else {
        setMessage({ type: 'error', text: data.message || 'خطأ غير متوقع' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'خطأ في الاتصال بالخادم' });
    } finally { setLoading(false); }
  };

  // -------------------------------------------------------------
  // إدارة العمليات الجماعية (API Caller الموحد)
  // -------------------------------------------------------------
  const executeBulkApi = async (apiPayload) => {
    try {
      const res = await fetch('/api/dashboard/super/generate-discount-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload)
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message });
        setPastedCodes(''); // تنظيف المربع بعد نجاح العملية
        setAdvancedModal({ ...advancedModal, show: false });
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'خطأ بالاتصال بالخادم' });
    }
  };

  // معالج أزرار المربع النصي
  const handleTextBulkAction = (actionType) => {
      const codeArray = pastedCodes.split('\n').map(c => c.trim()).filter(Boolean);
      if (codeArray.length === 0) return setMessage({ type: 'error', text: 'يرجى لصق الكوبونات في المربع أولاً' });

      processBulkRequest(actionType, { codes: codeArray }, ` بالنص المباشر (${codeArray.length} كود)`);
  };

  // معالج أزرار الجدول
  const handleTableBulkAction = (actionType) => {
      if (selectedCodes.length === 0) return;
      processBulkRequest(actionType, { ids: selectedCodes }, ` المحددة (${selectedCodes.length} كود)`);
  };

  // المعالج المركزي للإجراءات (يفتح النافذة للتعديل أو يؤكد الحذف/التنشيط)
  const processBulkRequest = (actionType, payloadObj, sourceTxt) => {
      setMessage({ type: '', text: '' });
      
      if (actionType === 'delete') {
          if (window.confirm(`هل أنت متأكد من حذف الأكواد${sourceTxt} نهائياً؟`)) {
              executeBulkApi({ action: 'delete', ...payloadObj });
          }
      } else if (actionType === 'activate') {
          if (window.confirm(`تفعيل وإتاحة الأكواد${sourceTxt}؟`)) {
              executeBulkApi({ action: 'update_status', is_used: false, ...payloadObj });
          }
      } else if (actionType === 'deactivate') {
          if (window.confirm(`تعطيل (حرق) الأكواد${sourceTxt}؟`)) {
              executeBulkApi({ action: 'update_status', is_used: true, ...payloadObj });
          }
      } else if (actionType === 'change_teacher' || actionType === 'change_value') {
          // فتح نافذة الإعدادات المتقدمة
          setAdvancedModal({
              show: true, payload: payloadObj, actionType, sourceTxt,
              newTeacher: '', newType: 'percentage', newValue: ''
          });
      }
  };

  // تنفيذ التعديل من داخل النافذة
  const submitAdvancedModal = () => {
      const { actionType, payload, newTeacher, newType, newValue } = advancedModal;
      let apiPayload = { action: 'update_advanced', ...payload };

      if (actionType === 'change_teacher') {
          if (!newTeacher) return alert('الرجاء اختيار المدرس');
          apiPayload.teacher_id = newTeacher;
      } else if (actionType === 'change_value') {
          if (!newValue) return alert('الرجاء كتابة القيمة');
          apiPayload.discount_type = newType;
          apiPayload.discount_value = newValue;
      }
      executeBulkApi(apiPayload);
  };


  // -------------------------------------------------------------
  // دوال مساعدة للواجهة
  // -------------------------------------------------------------
  const copySingleCode = (codeStr) => {
    navigator.clipboard.writeText(codeStr);
    const t = document.createElement('div');
    t.textContent = 'تم النسخ!';
    t.style.cssText = 'position:fixed; bottom:20px; right:20px; background:#10b981; color:#fff; padding:10px 20px; border-radius:5px; z-index:9999; font-weight:bold;';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2000);
  };

  const copyBulkCodes = () => {
    if (!newlyGeneratedCodes.length) return;
    const textToCopy = newlyGeneratedCodes.map(item => item.code).join('\n');
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedBulk(true); setTimeout(() => setCopiedBulk(false), 2000); 
    });
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

          <div className="top-grid">
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

              {/* 2. الإدارة السريعة بالنص (لصق الأكواد) */}
              <div className="card-container highlight-box">
                  <h3 className="card-title text-blue">🚀 إدارة سريعة للأكواد (بالنص)</h3>
                  <p className="hint-txt">الصق الكوبونات هنا (كل كوبون في سطر) لتطبيق إجراء سريع عليها.</p>
                  <textarea 
                      className="paste-textarea" 
                      placeholder="MED-XYZ123&#10;MED-ABC987"
                      value={pastedCodes}
                      onChange={e => setPastedCodes(e.target.value)}
                  />
                  <div className="bulk-grid-btns mt-3">
                      <button className="btn green" onClick={() => handleTextBulkAction('activate')}>✅ تفعيل</button>
                      <button className="btn orange" onClick={() => handleTextBulkAction('deactivate')}>🔥 تعطيل</button>
                      <button className="btn red" onClick={() => handleTextBulkAction('delete')}>🗑️ حذف</button>
                      <button className="btn blue" onClick={() => handleTextBulkAction('change_teacher')}>👨‍🏫 نقل لمدرس</button>
                      <button className="btn purple" onClick={() => handleTextBulkAction('change_value')}>💰 تغيير القيمة</button>
                  </div>
              </div>
          </div>

          {/* 3. الأكواد المولدة حديثاً */}
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

          {/* 4. شريط الفلترة والأدوات للجدول */}
          <div className="filters-container mt-4">
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
                  <button onClick={handleApplyFilters} className="btn-apply">🔍 تطبيق الفلتر</button>
                  <button onClick={handleClearFilters} className="btn-clear">✖ مسح الفلاتر</button>
              </div>
          </div>

          {/* 5. العمليات الجماعية للجدول */}
          <div className="card-container table-card">
            <div className="table-header-flex">
               <h3 className="card-title m-0">📋 قاعدة بيانات الكوبونات ({totalCodes})</h3>
               {selectedCodes.length > 0 && (
                   <div className="bulk-actions-bar">
                       <span className="selected-count">محدد ({selectedCodes.length})</span>
                       <button className="btn green" onClick={() => handleTableBulkAction('activate')}>تفعيل</button>
                       <button className="btn orange" onClick={() => handleTableBulkAction('deactivate')}>تعطيل</button>
                       <button className="btn blue" onClick={() => handleTableBulkAction('change_teacher')}>تغيير المدرس</button>
                       <button className="btn purple" onClick={() => handleTableBulkAction('change_value')}>تغيير القيمة</button>
                       <button className="btn red" onClick={() => handleTableBulkAction('delete')}>حذف</button>
                   </div>
               )}
            </div>

            <div className="table-responsive">
              <table className="codes-table">
                <thead>
                  <tr>
                    <th style={{width: '40px'}}><input type="checkbox" onChange={(e) => setSelectedCodes(e.target.checked ? codes.map(c => c.id) : [])} checked={codes.length > 0 && selectedCodes.length === codes.length} /></th>
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
                        <td><input type="checkbox" checked={selectedCodes.includes(code.id)} onChange={() => setSelectedCodes(prev => prev.includes(code.id) ? prev.filter(x => x !== code.id) : [...prev, code.id])} /></td>
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

      {/* نافذة التعديل المتقدم (Modal) */}
      {advancedModal.show && (
          <div className="modal-overlay" onClick={() => setAdvancedModal({...advancedModal, show: false})}>
              <div className="modal-box" onClick={e => e.stopPropagation()}>
                  <h3 className="modal-title">
                      {advancedModal.actionType === 'change_teacher' ? '👨‍🏫 نقل الكوبونات لمدرس آخر' : '💰 تعديل قيمة ونوع الخصم'}
                  </h3>
                  <p className="modal-desc">سيتم تطبيق التعديل على الأكواد {advancedModal.sourceTxt}</p>

                  {advancedModal.actionType === 'change_teacher' && (
                      <div className="form-group mt-3">
                          <label>اختر المدرس الجديد:</label>
                          <select className="form-input" value={advancedModal.newTeacher} onChange={e => setAdvancedModal({...advancedModal, newTeacher: e.target.value})}>
                              <option value="">-- يرجى الاختيار --</option>
                              {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                      </div>
                  )}

                  {advancedModal.actionType === 'change_value' && (
                      <>
                          <div className="form-group mt-3">
                              <label>نوع الخصم الجديد:</label>
                              <select className="form-input" value={advancedModal.newType} onChange={e => setAdvancedModal({...advancedModal, newType: e.target.value})}>
                                  <option value="percentage">نسبة مئوية (%)</option>
                                  <option value="fixed">مبلغ ثابت (جنيه)</option>
                              </select>
                          </div>
                          <div className="form-group mt-3">
                              <label>القيمة الجديدة:</label>
                              <input type="number" className="form-input" value={advancedModal.newValue} onChange={e => setAdvancedModal({...advancedModal, newValue: e.target.value})} placeholder="أدخل القيمة..." />
                          </div>
                      </>
                  )}

                  <div className="modal-actions">
                      <button className="btn-cancel" onClick={() => setAdvancedModal({...advancedModal, show: false})}>تراجع</button>
                      <button className="btn-save" onClick={submitAdvancedModal}>تنفيذ التعديل ✅</button>
                  </div>
              </div>
          </div>
      )}

      <style jsx>{`
        /* تنسيقات عامة للصفحة */
        .page-wrapper { padding: 20px; direction: rtl; font-family: system-ui, sans-serif; padding-bottom: 50px; }
        .page-title { margin-bottom: 20px; color: #fff; }
        .loading-screen { min-height: 50vh; display: flex; justify-content: center; align-items: center; color: #38bdf8; font-size: 1.2rem; font-weight: bold; }
        .mt-3 { margin-top: 15px; } .mt-4 { margin-top: 20px; }

        .alert-box { padding: 12px 20px; margin-bottom: 20px; border-radius: 8px; font-weight: bold; }
        .alert-box.success { background-color: rgba(34, 197, 94, 0.1); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); }
        .alert-box.error { background-color: rgba(239, 68, 68, 0.1); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.3); }

        .top-grid { display: grid; grid-template-columns: 2fr 1.2fr; gap: 20px; margin-bottom: 20px;}
        @media (max-width: 900px) { .top-grid { grid-template-columns: 1fr; } }

        .card-container { background: #1e293b; padding: 25px; border-radius: 12px; border: 1px solid #334155; }
        .highlight-box { border-color: #38bdf8; box-shadow: 0 4px 15px rgba(56, 189, 248, 0.1); }
        .card-title { margin: 0 0 20px 0; color: #f8fafc; border-bottom: 2px solid #334155; padding-bottom: 12px; }
        .card-title.text-blue { color: #38bdf8; border-color: #38bdf8; }
        
        .paste-textarea { width: 100%; height: 160px; background: #0f172a; border: 1px solid #475569; border-radius: 8px; color: #e2e8f0; padding: 15px; font-family: monospace; resize: vertical; outline: none; line-height: 1.6; }
        .paste-textarea:focus { border-color: #38bdf8; }
        .hint-txt { font-size: 0.85rem; color: #94a3b8; margin-bottom: 10px; }

        /* الأزرار الموحدة */
        .bulk-grid-btns { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
        .bulk-grid-btns .btn.blue, .bulk-grid-btns .btn.purple { grid-column: span 1.5; }
        
        .btn { padding: 8px 12px; border-radius: 6px; border: none; font-weight: bold; cursor: pointer; transition: 0.2s; font-size: 0.85rem; color: white;}
        .btn:hover { transform: translateY(-2px); filter: brightness(1.1); }
        .btn.green { background: #22c55e; color: #0f172a;} 
        .btn.orange { background: #f97316; } 
        .btn.red { background: #ef4444; } 
        .btn.blue { background: #3b82f6; } 
        .btn.purple { background: #a855f7; }

        /* Form */
        .generate-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
        .form-group label { display: block; margin-bottom: 8px; font-weight: bold; color: #cbd5e1; font-size: 0.9rem; }
        .form-input { width: 100%; padding: 12px 15px; border-radius: 8px; border: 1px solid #475569; background-color: #0f172a; color: #fff; outline: none; }
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
        .new-codes-textarea { width: 100%; padding: 15px; background: #0f172a; color: #e2e8f0; border: 1px solid #475569; border-radius: 8px; font-family: monospace; font-size: 1.1rem; resize: vertical; outline: none; }

        /* Filters */
        .filters-container { background: #0f172a; padding: 15px; border-radius: 12px; border: 1px solid #334155; margin-bottom: 20px; display: flex; flex-direction: column; gap: 15px; }
        .filters-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }
        .filter-input { padding: 10px; border-radius: 6px; border: 1px solid #475569; background: #1e293b; color: white; outline: none; }
        .filters-actions { display: flex; justify-content: flex-end; gap: 10px; }
        .btn-apply { background: #3b82f6; color: white; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; }
        .btn-clear { background: transparent; color: #fca5a5; border: 1px solid #ef4444; padding: 8px 20px; border-radius: 6px; cursor: pointer; }

        /* Table & Bulk Bar */
        .table-card { padding: 0; overflow: hidden; margin-top: 20px;}
        .table-header-flex { display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid #334155; background: #111827; flex-wrap: wrap; gap: 15px; }
        
        .bulk-actions-bar { display: flex; gap: 8px; align-items: center; background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 8px; flex-wrap: wrap; }
        .selected-count { color: #38bdf8; font-weight: bold; font-size: 0.9rem; margin-left: 10px; }

        .table-responsive { overflow-x: auto; }
        .codes-table { width: 100%; border-collapse: collapse; text-align: right; }
        .codes-table th { padding: 15px; background: #0f172a; color: #94a3b8; font-size: 0.9rem; border-bottom: 1px solid #334155; white-space: nowrap; }
        .codes-table td { padding: 15px; border-bottom: 1px solid #334155; vertical-align: middle; }
        .codes-table tr:hover { background: rgba(255, 255, 255, 0.02); }
        .selected-row { background: rgba(56, 189, 248, 0.05) !important; }
        .empty-table { text-align: center; padding: 40px !important; color: #64748b; font-style: italic;}

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

        /* Modal Styles */
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center; z-index: 1000; backdrop-filter: blur(4px); }
        .modal-box { background: #1e293b; padding: 25px; border-radius: 12px; border: 1px solid #475569; width: 90%; max-width: 400px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .modal-title { color: #f8fafc; margin-top: 0; margin-bottom: 10px; }
        .modal-desc { color: #94a3b8; font-size: 0.85rem; margin-bottom: 20px; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 25px; }
        .btn-cancel { background: transparent; color: #cbd5e1; border: 1px solid #475569; padding: 10px 20px; border-radius: 6px; cursor: pointer; }
        .btn-save { background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; }
      `}</style>
    </SuperLayout>
  );
}
