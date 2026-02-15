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
  
  // التنبيهات الذكية (Toasts)
  const [toast, setToast] = useState({ show: false, text: '', type: 'success' });
  
  const showToast = (text, type = 'success') => {
      setToast({ show: true, text, type });
      setTimeout(() => setToast({ show: false, text: '', type: 'success' }), 3000);
  };

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

  // -------------------------------------------------------------
  // النوافذ المنبثقة (Modals) الأنيقة
  // -------------------------------------------------------------
  // نافذة التأكيد (بديل window.confirm)
  const [confirmModal, setConfirmModal] = useState({ 
      show: false, title: '', message: '', action: null, type: 'danger' 
  });

  // نافذة التعديل المتقدم
  const [advancedModal, setAdvancedModal] = useState({
      show: false, sourceTxt: '', payload: {}, actionType: '', 
      newTeacher: '', newType: 'percentage', newValue: ''
  });

  // -------------------------------------------------------------
  // جلب البيانات (مع دعم الفلاتر المباشرة)
  // -------------------------------------------------------------
  const fetchData = async (overridePage = page, overrideFilters = filters) => {
    setTableLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: overridePage, limit,
        teacherId: overrideFilters.teacherId, type: overrideFilters.type,
        value: overrideFilters.value, isUsed: overrideFilters.isUsed
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
      showToast('خطأ في جلب البيانات', 'error');
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => { 
      setIsClient(true); 
      if (isClient) fetchData(page, filters); 
  }, [page]); // تحديث عند تغيير الصفحة فقط

  // ✅ حل مشكلة الفلتر ليعمل من الضغطة الأولى
  const handleApplyFilters = () => { 
      if (page !== 1) setPage(1); 
      else fetchData(1, filters); 
  };

  const handleClearFilters = () => {
    const emptyFilters = { teacherId: 'all', type: 'all', value: '', isUsed: 'all' };
    setFilters(emptyFilters);
    if (page !== 1) setPage(1);
    else fetchData(1, emptyFilters);
  };

  // -------------------------------------------------------------
  // توليد الأكواد
  // -------------------------------------------------------------
  const handleGenerate = async (e) => {
    e.preventDefault();
    setNewlyGeneratedCodes([]);
    setCopiedBulk(false);

    if (!teacherId || !discountValue || !quantity) return showToast('يرجى تعبئة جميع الحقول المطلوبة', 'error');

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
        showToast(data.message, 'success');
        if (data.generated_codes) setNewlyGeneratedCodes(data.generated_codes); 
        setDiscountValue(''); setQuantity(10);
        handleClearFilters(); 
      } else {
        showToast(data.message || 'خطأ غير متوقع', 'error');
      }
    } catch (error) {
      showToast('خطأ في الاتصال بالخادم', 'error');
    } finally { setLoading(false); }
  };

  // -------------------------------------------------------------
  // إدارة العمليات الجماعية (API Caller)
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
        showToast(data.message, 'success');
        setPastedCodes(''); 
        setAdvancedModal({ ...advancedModal, show: false });
        fetchData();
      } else {
        showToast(data.message, 'error');
      }
    } catch (e) {
      showToast('خطأ بالاتصال بالخادم', 'error');
    }
  };

  // معالج أزرار المربع النصي
  const handleTextBulkAction = (actionType) => {
      const codeArray = pastedCodes.split('\n').map(c => c.trim()).filter(Boolean);
      if (codeArray.length === 0) return showToast('يرجى لصق الكوبونات في المربع أولاً', 'error');

      processBulkRequest(actionType, { codes: codeArray }, ` (${codeArray.length} كود)`);
  };

  // معالج أزرار الجدول
  const handleTableBulkAction = (actionType) => {
      if (selectedCodes.length === 0) return;
      processBulkRequest(actionType, { ids: selectedCodes }, ` (${selectedCodes.length} كود)`);
  };

  // ✅ المعالج المركزي للـ Modals (بديل window.confirm الأنيق)
  const processBulkRequest = (actionType, payloadObj, sourceTxt) => {
      if (actionType === 'delete') {
          setConfirmModal({
              show: true, type: 'danger', title: 'حذف نهائي',
              message: `هل أنت متأكد من حذف الأكواد المحددة${sourceTxt} نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`,
              action: () => executeBulkApi({ action: 'delete', ...payloadObj })
          });
      } else if (actionType === 'activate') {
          setConfirmModal({
              show: true, type: 'success', title: 'تفعيل الأكواد',
              message: `هل تريد تفعيل وإتاحة الأكواد المحددة${sourceTxt} للمستخدمين؟`,
              action: () => executeBulkApi({ action: 'update_status', is_used: false, ...payloadObj })
          });
      } else if (actionType === 'deactivate') {
          setConfirmModal({
              show: true, type: 'warning', title: 'تعطيل الأكواد',
              message: `هل تريد تعطيل (حرق) الأكواد المحددة${sourceTxt} ومنع استخدامها؟`,
              action: () => executeBulkApi({ action: 'update_status', is_used: true, ...payloadObj })
          });
      } else if (actionType === 'change_teacher' || actionType === 'change_value') {
          setAdvancedModal({
              show: true, payload: payloadObj, actionType, sourceTxt,
              newTeacher: '', newType: 'percentage', newValue: ''
          });
      }
  };

  // تنفيذ التعديل من داخل نافذة التعديل المتقدم
  const submitAdvancedModal = () => {
      const { actionType, payload, newTeacher, newType, newValue } = advancedModal;
      let apiPayload = { action: 'update_advanced', ...payload };

      if (actionType === 'change_teacher') {
          if (!newTeacher) return showToast('الرجاء اختيار المدرس الجديد', 'error');
          apiPayload.teacher_id = newTeacher;
      } else if (actionType === 'change_value') {
          if (!newValue) return showToast('الرجاء كتابة القيمة الجديدة', 'error');
          apiPayload.discount_type = newType;
          apiPayload.discount_value = newValue;
      }
      executeBulkApi(apiPayload);
  };

  // -------------------------------------------------------------
  // دوال النسخ (Clipboard)
  // -------------------------------------------------------------
  const copySingleCode = (codeStr) => {
    navigator.clipboard.writeText(codeStr);
    showToast(`تم نسخ الكود: ${codeStr}`, 'success');
  };

  const copyBulkCodes = () => {
    if (!newlyGeneratedCodes.length) return;
    const textToCopy = newlyGeneratedCodes.map(item => item.code).join('\n');
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedBulk(true); 
      showToast('تم نسخ جميع الأكواد بنجاح!', 'success');
      setTimeout(() => setCopiedBulk(false), 2000); 
    });
  };

  const renderDiscountValue = (type, val) => type === 'percentage' ? `${val} %` : `${val} ج.م`;
  const totalPages = Math.ceil(totalCodes / limit);

  return (
    <SuperLayout>
      <Head><title>إدارة الكوبونات | الإدارة العليا</title></Head>

      {/* ✅ نظام الـ Toast الأنيق العائم */}
      <div className={`smart-toast ${toast.show ? 'show' : ''} ${toast.type}`}>
          <div className="toast-icon">
              {toast.type === 'success' ? '✅' : '⚠️'}
          </div>
          <div className="toast-msg">{toast.text}</div>
      </div>

      {isClient ? (
        <div className="page-wrapper">
          <div className="page-header">
              <h2>🎟️ مركز إدارة الكوبونات</h2>
              <p>توليد، تتبع، وتعديل أكواد الخصم الخاصة بالمنصة</p>
          </div>

          <div className="top-grid">
              {/* 1. إعدادات التوليد */}
              <div className="card-container border-glass">
                <h3 className="card-title">⚙️ إنشاء كوبونات جديدة</h3>
                <form onSubmit={handleGenerate} className="generate-form">
                  <div className="form-group">
                    <label>المدرس المرتبط:</label>
                    <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="form-input" required>
                      <option value="">-- اختر المدرس --</option>
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
                    <label>القيمة:</label>
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
              <div className="card-container highlight-box border-glass">
                  <h3 className="card-title text-blue">🚀 إدارة سريعة بالنص (Bulk Text)</h3>
                  <p className="hint-txt">الصق الكوبونات هنا (كل كوبون في سطر) لتطبيق الإجراء فوراً.</p>
                  <textarea 
                      className="paste-textarea" 
                      placeholder="MED-XYZ123&#10;MED-ABC987"
                      value={pastedCodes}
                      onChange={e => setPastedCodes(e.target.value)}
                  />
                  <div className="bulk-grid-btns mt-3">
                      <button className="btn outline-green" onClick={() => handleTextBulkAction('activate')}>✅ تفعيل</button>
                      <button className="btn outline-orange" onClick={() => handleTextBulkAction('deactivate')}>🔥 تعطيل</button>
                      <button className="btn outline-red" onClick={() => handleTextBulkAction('delete')}>🗑️ حذف</button>
                      <button className="btn outline-blue" onClick={() => handleTextBulkAction('change_teacher')}>👨‍🏫 نقل لمدرس</button>
                      <button className="btn outline-purple" onClick={() => handleTextBulkAction('change_value')}>💰 تغيير القيمة</button>
                  </div>
              </div>
          </div>

          {/* 3. الأكواد المولدة حديثاً */}
          {newlyGeneratedCodes.length > 0 && (
            <div className="new-codes-container">
              <div className="new-codes-header">
                <h3>🎉 تم التوليد بنجاح! ({newlyGeneratedCodes.length} كود)</h3>
                <button onClick={copyBulkCodes} className={`copy-btn ${copiedBulk ? 'copied' : ''}`}>
                  {copiedBulk ? '✅ تم النسخ!' : '📋 نسخ القائمة بالكامل'}
                </button>
              </div>
              <textarea readOnly className="new-codes-textarea" value={newlyGeneratedCodes.map(item => item.code).join('\n')} rows={Math.min(10, newlyGeneratedCodes.length)} />
            </div>
          )}

          {/* 4. شريط الفلترة والأدوات للجدول */}
          <div className="filters-container mt-4 border-glass">
              <div className="filters-grid">
                  <div className="filter-item">
                      <label>المدرس</label>
                      <select className="filter-input" value={filters.teacherId} onChange={e=>setFilters({...filters, teacherId: e.target.value})}>
                          <option value="all">الكل</option>
                          {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                  </div>
                  <div className="filter-item">
                      <label>نوع الخصم</label>
                      <select className="filter-input" value={filters.type} onChange={e=>setFilters({...filters, type: e.target.value})}>
                          <option value="all">الكل</option>
                          <option value="percentage">نسبة مئوية (%)</option>
                          <option value="fixed">مبلغ ثابت</option>
                      </select>
                  </div>
                  <div className="filter-item">
                      <label>القيمة</label>
                      <input type="number" className="filter-input" placeholder="بحث بالقيمة..." value={filters.value} onChange={e=>setFilters({...filters, value: e.target.value})} />
                  </div>
                  <div className="filter-item">
                      <label>حالة الكود</label>
                      <select className="filter-input" value={filters.isUsed} onChange={e=>setFilters({...filters, isUsed: e.target.value})}>
                          <option value="all">الكل</option>
                          <option value="false">✅ متاح للاستخدام</option>
                          <option value="true">🔥 مستخدم / معطل</option>
                      </select>
                  </div>
              </div>
              <div className="filters-actions">
                  <button onClick={handleApplyFilters} className="btn-apply">🔍 بحث</button>
                  <button onClick={handleClearFilters} className="btn-clear">✖ مسح</button>
              </div>
          </div>

          {/* 5. الجدول والعمليات الجماعية */}
          <div className="card-container table-card border-glass">
            <div className="table-header-flex">
               <h3 className="card-title m-0">📋 قاعدة البيانات ({totalCodes} كود)</h3>
               {selectedCodes.length > 0 && (
                   <div className="bulk-actions-bar">
                       <span className="selected-count">{selectedCodes.length} محدد</span>
                       <button className="btn green" onClick={() => handleTableBulkAction('activate')}>تفعيل</button>
                       <button className="btn orange" onClick={() => handleTableBulkAction('deactivate')}>تعطيل</button>
                       <button className="btn blue" onClick={() => handleTableBulkAction('change_teacher')}>نقل</button>
                       <button className="btn purple" onClick={() => handleTableBulkAction('change_value')}>تعديل</button>
                       <button className="btn red" onClick={() => handleTableBulkAction('delete')}>حذف</button>
                   </div>
               )}
            </div>

            <div className="table-responsive">
              <table className="codes-table">
                <thead>
                  <tr>
                    <th style={{width: '40px'}}><input type="checkbox" onChange={(e) => setSelectedCodes(e.target.checked ? codes.map(c => c.id) : [])} checked={codes.length > 0 && selectedCodes.length === codes.length} /></th>
                    <th>الكود</th>
                    <th>المدرس</th>
                    <th>الخصم</th>
                    <th>الإنشاء</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {tableLoading ? (
                    <tr><td colSpan="6" className="empty-table loading-txt">جاري التحميل...</td></tr>
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
                            <span className="status-badge used">🔥 معطل</span>
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
        <div className="loading-screen">
            <div className="loader-spinner"></div>
            جاري تهيئة الصفحة...
        </div>
      )}

      {/* ✅ نافذة التأكيد (Confirm Modal) الأنيقة */}
      {confirmModal.show && (
          <div className="modal-overlay blur-bg" onClick={() => setConfirmModal({...confirmModal, show: false})}>
              <div className="modal-box confirm-box" onClick={e => e.stopPropagation()}>
                  <div className={`modal-icon-header ${confirmModal.type}`}>
                      {confirmModal.type === 'danger' ? '🗑️' : confirmModal.type === 'warning' ? '🔥' : '✅'}
                  </div>
                  <h3 className="modal-title">{confirmModal.title}</h3>
                  <p className="modal-desc">{confirmModal.message}</p>
                  
                  <div className="modal-actions centered">
                      <button className="btn-cancel" onClick={() => setConfirmModal({...confirmModal, show: false})}>تراجع</button>
                      <button className={`btn-save ${confirmModal.type}`} onClick={() => { confirmModal.action(); setConfirmModal({...confirmModal, show: false}); }}>
                          تأكيد التنفيذ
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* ✅ نافذة التعديل المتقدم (Advanced Modal) الأنيقة */}
      {advancedModal.show && (
          <div className="modal-overlay blur-bg" onClick={() => setAdvancedModal({...advancedModal, show: false})}>
              <div className="modal-box" onClick={e => e.stopPropagation()}>
                  <div className="modal-header-glass">
                      <h3 className="modal-title m-0">
                          {advancedModal.actionType === 'change_teacher' ? '👨‍🏫 نقل الكوبونات' : '💰 تعديل القيمة'}
                      </h3>
                      <button className="close-x" onClick={() => setAdvancedModal({...advancedModal, show: false})}>✕</button>
                  </div>
                  
                  <p className="modal-desc mt-3" style={{color: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.1)', padding: '10px', borderRadius: '8px'}}>
                      سيتم التطبيق على الأكواد {advancedModal.sourceTxt}
                  </p>

                  {advancedModal.actionType === 'change_teacher' && (
                      <div className="form-group mt-4">
                          <label>اختر المدرس الجديد:</label>
                          <select className="form-input" value={advancedModal.newTeacher} onChange={e => setAdvancedModal({...advancedModal, newTeacher: e.target.value})}>
                              <option value="">-- يرجى الاختيار --</option>
                              {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                      </div>
                  )}

                  {advancedModal.actionType === 'change_value' && (
                      <>
                          <div className="form-group mt-4">
                              <label>نوع الخصم الجديد:</label>
                              <select className="form-input" value={advancedModal.newType} onChange={e => setAdvancedModal({...advancedModal, newType: e.target.value})}>
                                  <option value="percentage">نسبة مئوية (%)</option>
                                  <option value="fixed">مبلغ ثابت (جنيه)</option>
                              </select>
                          </div>
                          <div className="form-group mt-3">
                              <label>القيمة الجديدة:</label>
                              <input type="number" min="1" className="form-input" value={advancedModal.newValue} onChange={e => setAdvancedModal({...advancedModal, newValue: e.target.value})} placeholder="أدخل القيمة..." />
                          </div>
                      </>
                  )}

                  <div className="modal-actions mt-4">
                      <button className="btn-cancel" onClick={() => setAdvancedModal({...advancedModal, show: false})}>إلغاء</button>
                      <button className="btn-save primary" onClick={submitAdvancedModal}>حفظ التعديلات 💾</button>
                  </div>
              </div>
          </div>
      )}

      <style jsx>{`
        /* ==================== Global & Layout ==================== */
        .page-wrapper { padding: 25px; direction: rtl; font-family: 'Tajawal', system-ui, sans-serif; padding-bottom: 60px; }
        .page-header { margin-bottom: 25px; border-bottom: 1px solid #334155; padding-bottom: 15px; }
        .page-header h2 { margin: 0; color: #f8fafc; font-size: 1.8rem; }
        .page-header p { margin: 5px 0 0 0; color: #94a3b8; }
        
        .loading-screen { min-height: 60vh; display: flex; flex-direction: column; gap: 15px; justify-content: center; align-items: center; color: #38bdf8; font-size: 1.2rem; }
        .loader-spinner { width: 40px; height: 40px; border: 4px solid #1e293b; border-top: 4px solid #38bdf8; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        
        .mt-3 { margin-top: 15px; } .mt-4 { margin-top: 25px; } .m-0 { margin: 0; }

        /* ==================== Smart Toast ==================== */
        .smart-toast { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%) translateY(100px); background: #1e293b; color: white; padding: 12px 25px; border-radius: 50px; font-weight: bold; box-shadow: 0 10px 30px rgba(0,0,0,0.6); z-index: 20000; display: flex; align-items: center; gap: 10px; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); opacity: 0; border: 1px solid #334155; }
        .smart-toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }
        .smart-toast.success { border-bottom: 3px solid #22c55e; }
        .smart-toast.error { border-bottom: 3px solid #ef4444; }
        .toast-icon { font-size: 1.2em; }

        /* ==================== Grid & Cards ==================== */
        .top-grid { display: grid; grid-template-columns: 2fr 1.2fr; gap: 20px; margin-bottom: 25px;}
        @media (max-width: 1024px) { .top-grid { grid-template-columns: 1fr; } }

        .border-glass { border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .card-container { background: #1e293b; padding: 25px; border-radius: 16px; }
        .highlight-box { background: linear-gradient(145deg, #1e293b, #0f172a); border-color: #38bdf8; box-shadow: 0 0 20px rgba(56, 189, 248, 0.1); }
        
        .card-title { margin: 0 0 20px 0; color: #f8fafc; border-bottom: 1px dashed #334155; padding-bottom: 12px; }
        .card-title.text-blue { color: #38bdf8; border-color: rgba(56, 189, 248, 0.3); }
        
        .paste-textarea { width: 100%; height: 160px; background: #0b1120; border: 1px solid #334155; border-radius: 12px; color: #38bdf8; padding: 15px; font-family: monospace; resize: vertical; outline: none; line-height: 1.8; letter-spacing: 1px; transition: 0.3s; }
        .paste-textarea:focus { border-color: #38bdf8; background: #0f172a; box-shadow: inset 0 0 10px rgba(0,0,0,0.5); }
        .hint-txt { font-size: 0.85rem; color: #94a3b8; margin-bottom: 12px; }

        /* ==================== Buttons ==================== */
        .bulk-grid-btns { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
        .bulk-grid-btns .btn.outline-blue, .bulk-grid-btns .btn.outline-purple { grid-column: span 1.5; }
        
        .btn { padding: 10px 15px; border-radius: 8px; border: none; font-weight: bold; cursor: pointer; transition: 0.2s; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; gap: 5px; }
        .btn:hover { transform: translateY(-2px); filter: brightness(1.1); box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
        
        .btn.green { background: #22c55e; color: #0f172a;} 
        .btn.orange { background: #f97316; color: white;} 
        .btn.red { background: #ef4444; color: white;} 
        .btn.blue { background: #3b82f6; color: white;} 
        .btn.purple { background: #a855f7; color: white;}

        .btn.outline-green { background: rgba(34,197,94,0.1); border: 1px solid #22c55e; color: #4ade80; }
        .btn.outline-orange { background: rgba(249,115,22,0.1); border: 1px solid #f97316; color: #fb923c; }
        .btn.outline-red { background: rgba(239,68,68,0.1); border: 1px solid #ef4444; color: #fca5a5; }
        .btn.outline-blue { background: rgba(59,130,246,0.1); border: 1px solid #3b82f6; color: #60a5fa; }
        .btn.outline-purple { background: rgba(168,85,247,0.1); border: 1px solid #a855f7; color: #c084fc; }

        /* ==================== Form ==================== */
        .generate-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
        .form-group label { display: block; margin-bottom: 8px; font-weight: bold; color: #cbd5e1; font-size: 0.9rem; }
        .form-input { width: 100%; padding: 12px 15px; border-radius: 8px; border: 1px solid #475569; background-color: #0f172a; color: #fff; outline: none; transition: 0.2s; font-family: inherit;}
        .form-input:focus { border-color: #38bdf8; box-shadow: 0 0 0 3px rgba(56,189,248,0.1); }
        .form-submit { grid-column: 1 / -1; margin-top: 10px; }
        .submit-btn { width: 100%; padding: 15px; background: linear-gradient(135deg, #3b82f6, #2563eb); color: #fff; border: none; border-radius: 12px; font-weight: bold; font-size: 1.1rem; cursor: pointer; transition: 0.3s; box-shadow: 0 4px 15px rgba(37,99,235,0.3); }
        .submit-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(37,99,235,0.4); }
        .submit-btn.loading { background: #475569; box-shadow: none; cursor: not-allowed; }

        /* ==================== New Codes Box ==================== */
        .new-codes-container { background: linear-gradient(to right, rgba(56,189,248,0.05), rgba(56,189,248,0.01)); padding: 25px; border-radius: 16px; border: 1px solid rgba(56,189,248,0.3); margin-bottom: 30px; animation: slideDown 0.4s ease-out; }
        .new-codes-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .new-codes-header h3 { margin: 0; color: #38bdf8; }
        .copy-btn { background: #38bdf8; color: #0f172a; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s; display: flex; align-items: center; gap: 8px;}
        .copy-btn.copied { background: #22c55e; color: white; }
        .new-codes-textarea { width: 100%; padding: 20px; background: #0f172a; color: #e2e8f0; border: 1px dashed #475569; border-radius: 12px; font-family: monospace; font-size: 1.2rem; resize: vertical; outline: none; text-align: center; letter-spacing: 2px; }

        @keyframes slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }

        /* ==================== Filters ==================== */
        .filters-container { background: #162032; padding: 20px; border-radius: 16px; margin-bottom: 25px; display: flex; flex-direction: column; gap: 15px; }
        .filters-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; }
        .filter-item label { display: block; font-size: 0.8rem; color: #64748b; margin-bottom: 5px; }
        .filter-input { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #334155; background: #0f172a; color: white; outline: none; transition: 0.2s; }
        .filter-input:focus { border-color: #3b82f6; }
        
        .filters-actions { display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #334155; padding-top: 15px; }
        .btn-apply { background: #3b82f6; color: white; border: none; padding: 10px 25px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s; }
        .btn-apply:hover { background: #2563eb; }
        .btn-clear { background: transparent; color: #94a3b8; border: 1px solid #475569; padding: 10px 25px; border-radius: 8px; cursor: pointer; transition: 0.2s;}
        .btn-clear:hover { background: rgba(255,255,255,0.05); color: white; }

        /* ==================== Table & Bulk Bar ==================== */
        .table-card { padding: 0; overflow: hidden; margin-top: 10px;}
        .table-header-flex { display: flex; justify-content: space-between; align-items: center; padding: 20px 25px; border-bottom: 1px solid #334155; background: #111827; flex-wrap: wrap; gap: 15px; }
        
        .bulk-actions-bar { display: flex; gap: 10px; align-items: center; background: rgba(56,189,248,0.05); padding: 8px 15px; border-radius: 12px; border: 1px solid rgba(56,189,248,0.2); flex-wrap: wrap; animation: fadeIn 0.3s; }
        .selected-count { color: #38bdf8; font-weight: bold; font-size: 0.95rem; margin-left: 10px; background: rgba(56,189,248,0.1); padding: 4px 10px; border-radius: 20px;}

        .table-responsive { overflow-x: auto; }
        .codes-table { width: 100%; border-collapse: collapse; text-align: right; }
        .codes-table th { padding: 15px 20px; background: #0f172a; color: #94a3b8; font-size: 0.9rem; border-bottom: 1px solid #334155; white-space: nowrap; font-weight: normal; text-transform: uppercase; }
        .codes-table td { padding: 15px 20px; border-bottom: 1px solid #334155; vertical-align: middle; }
        .codes-table tr:hover { background: rgba(255, 255, 255, 0.02); }
        .selected-row { background: rgba(56, 189, 248, 0.05) !important; }
        .empty-table { text-align: center; padding: 50px !important; color: #64748b; font-size: 1.1rem;}
        .loading-txt { color: #38bdf8; }

        .code-cell { display: flex; align-items: center; gap: 10px; }
        .code-text { font-family: monospace; font-size: 1.15rem; color: #60a5fa; font-weight: bold; background: #0f172a; padding: 4px 8px; border-radius: 6px; }
        .icon-btn { background: transparent; border: 1px solid #475569; padding: 6px; border-radius: 6px; cursor: pointer; transition: 0.2s; color: #cbd5e1;}
        .icon-btn:hover { background: #38bdf8; border-color: #38bdf8; color: #0f172a; }

        .teacher-name { color: #f8fafc; font-weight: bold; }
        .discount-value { color: #34d399; font-weight: 900; font-size: 1.1rem; }
        .date-text { color: #94a3b8; font-size: 0.85rem; }

        .status-badge { padding: 6px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; }
        .status-badge.used { background: rgba(239, 68, 68, 0.1); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.2); }
        .status-badge.active { background: rgba(34, 197, 94, 0.1); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.2); }

        /* Pagination */
        .pagination { display: flex; justify-content: center; align-items: center; gap: 15px; padding: 25px; background: #111827; color: #94a3b8; font-weight: bold;}
        .pagination button { background: #1e293b; border: 1px solid #334155; color: white; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: inherit; transition: 0.2s;}
        .pagination button:hover:not(:disabled) { background: #38bdf8; color: #0f172a; border-color: #38bdf8; }
        .pagination button:disabled { opacity: 0.4; cursor: not-allowed; }

        /* ==================== Modals (Premium Design) ==================== */
        .blur-bg { backdrop-filter: blur(8px); }
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center; z-index: 10000; animation: fadeIn 0.2s ease-out;}
        .modal-box { background: #1e293b; padding: 30px; border-radius: 20px; border: 1px solid #475569; width: 90%; max-width: 420px; box-shadow: 0 20px 50px rgba(0,0,0,0.6); animation: scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); position: relative; overflow: hidden; }
        
        .modal-header-glass { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 15px; }
        .close-x { background: transparent; border: none; color: #94a3b8; font-size: 1.5rem; cursor: pointer; transition: 0.2s; }
        .close-x:hover { color: #ef4444; }

        .modal-title { color: #f8fafc; margin: 0; font-size: 1.3rem; }
        .modal-desc { color: #94a3b8; font-size: 0.95rem; margin-top: 10px; line-height: 1.5; }
        
        .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 30px; }
        .modal-actions.centered { justify-content: center; }
        
        .btn-cancel { background: #0f172a; color: #cbd5e1; border: 1px solid #475569; padding: 12px 25px; border-radius: 10px; cursor: pointer; font-weight: bold; transition: 0.2s; }
        .btn-cancel:hover { background: #334155; color: white; }
        
        .btn-save { padding: 12px 25px; border-radius: 10px; font-weight: bold; cursor: pointer; border: none; transition: 0.2s; color: white; }
        .btn-save:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
        .btn-save.primary { background: #3b82f6; }
        .btn-save.danger { background: #ef4444; }
        .btn-save.warning { background: #f97316; }
        .btn-save.success { background: #22c55e; color: #0f172a; }

        .confirm-box { text-align: center; }
        .modal-icon-header { width: 70px; height: 70px; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 2rem; margin: 0 auto 20px auto; }
        .modal-icon-header.danger { background: rgba(239, 68, 68, 0.1); border: 2px solid #ef4444; }
        .modal-icon-header.warning { background: rgba(249, 115, 22, 0.1); border: 2px solid #f97316; }
        .modal-icon-header.success { background: rgba(34, 197, 94, 0.1); border: 2px solid #22c55e; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleUp { from { opacity: 0; transform: scale(0.9) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </SuperLayout>
  );
}
