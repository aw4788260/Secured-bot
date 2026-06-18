import SuperLayout from '../../../components/SuperLayout';
import { useState, useEffect } from 'react';

export default function SuperRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  
  // ✅ حالات Pagination
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  // ✅ حالات المدرسين
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState('all');

  // حالات النوافذ والتنبيهات
  const [modalImage, setModalImage] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  const [confirmModal, setConfirmModal] = useState({ show: false, id: null, action: null });
  const [rejectionReason, setRejectionReason] = useState('');
  
  // ✅ حالة نافذة تعديل السعر
  const [editPriceModal, setEditPriceModal] = useState({ show: false, id: null, price: '' });

  // الفلترة
  const [filter, setFilter] = useState('pending'); // pending, approved, rejected

  const showToast = (msg, type = 'success') => {
      setToast({ show: true, message: msg, type });
      setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };

  // ✅ جلب قائمة المدرسين للفلتر
  const fetchTeachers = async () => {
    try {
      const res = await fetch('/api/dashboard/super/teachers'); 
      if (res.ok) {
        const data = await res.json();
        setTeachers(data);
      }
    } catch (err) {
      console.error("فشل جلب المدرسين", err);
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      // ✅ إرسال teacherId مع الطلب
      const res = await fetch(`/api/dashboard/super/requests?status=${filter}&page=${page}&limit=${pageSize}&teacherId=${selectedTeacher}`);
      const result = await res.json();
      
      if (result.data) {
          setRequests(result.data);
          setTotalCount(result.count || 0);
      } else if (Array.isArray(result)) {
          setRequests(result);
          setTotalCount(result.length);
      } else {
          setRequests([]);
          setTotalCount(0);
      }
    } catch (err) {
      console.error(err);
      showToast('فشل جلب البيانات', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ✅ جلب المدرسين عند تحميل الصفحة مرة واحدة
  useEffect(() => {
    fetchTeachers();
  }, []);

  // إعادة تعيين الصفحة عند تغيير الفلتر أو المدرس
  useEffect(() => {
    setPage(1);
  }, [filter, selectedTeacher]);

  // جلب الطلبات عند تغيير أي من المحددات
  useEffect(() => {
    fetchRequests();
  }, [filter, page, selectedTeacher]);

  const initiateAction = (requestId, action) => {
      setRejectionReason('');
      setConfirmModal({ show: true, id: requestId, action });
  };

  const executeAction = async () => {
    const { id: requestId, action } = confirmModal;
    setConfirmModal({ show: false, id: null, action: null });
    setProcessingId(requestId);

    try {
      const res = await fetch('/api/dashboard/super/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            requestId, 
            action, 
            rejectionReason: action === 'reject' ? rejectionReason : null 
        })
      });
      
      const result = await res.json();
      
      if (res.ok) {
        showToast(result.message || 'تم تنفيذ العملية بنجاح', 'success');
        setRequests(requests.filter(r => r.id !== requestId));
        setTotalCount(prev => Math.max(0, prev - 1));
      } else {
        showToast(result.error, 'error');
      }
    } catch (err) {
      showToast("حدث خطأ في الاتصال", 'error');
    } finally {
      setProcessingId(null);
    }
  };

  // ✅ دالة تحديث السعر الفعلي
  const handleUpdatePrice = async () => {
    const { id, price } = editPriceModal;
    if (!price || isNaN(price) || price < 0) {
      showToast('يرجى إدخال مبلغ صحيح', 'error');
      return;
    }

    setProcessingId(id);
    try {
      const res = await fetch('/api/dashboard/super/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: id,
          action: 'update_price',
          newPrice: Number(price)
        })
      });

      const result = await res.json();
      if (res.ok) {
        showToast(result.message, 'success');
        setRequests(requests.map(req => req.id === id ? { ...req, actual_paid_price: result.newPrice } : req));
        setEditPriceModal({ show: false, id: null, price: '' });
      } else {
        showToast(result.error, 'error');
      }
    } catch (err) {
      showToast("حدث خطأ في الاتصال", 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <SuperLayout title="كل طلبات الاشتراك">
      <div className={`toast ${toast.show ? 'show' : ''} ${toast.type}`}>
          {toast.message}
      </div>

      <div className="header-container">
        <div>
            <h1>📥 مركز طلبات الاشتراك</h1>
            <p className="sub-header">مراقبة وإدارة جميع طلبات الاشتراك لكافة المدرسين</p>
        </div>
        
        <div className="header-actions">
            
            {/* ✅ قائمة اختيار المدرس */}
            <div className="teacher-select-wrapper">
              <select 
                value={selectedTeacher} 
                onChange={(e) => setSelectedTeacher(e.target.value)}
                className="teacher-select"
              >
                <option value="all">👨‍🏫 كل المدرسين</option>
                {teachers.map(teacher => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-tabs">
                <button 
                    className={`tab ${filter === 'pending' ? 'active' : ''}`} 
                    onClick={() => setFilter('pending')}
                >
                    ⏳ المعلقة
                </button>
                <button 
                    className={`tab ${filter === 'approved' ? 'active' : ''}`} 
                    onClick={() => setFilter('approved')}
                >
                    ✅ المقبولة
                </button>
                <button 
                    className={`tab ${filter === 'rejected' ? 'active' : ''}`} 
                    onClick={() => setFilter('rejected')}
                >
                    ❌ المرفوضة
                </button>
            </div>
            <button onClick={fetchRequests} className="refresh-btn" title="تحديث البيانات">🔄</button>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
            <div className="spinner"></div>
            <p>جاري تحميل الطلبات...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="empty-state">
            <div style={{fontSize:'3em', marginBottom:'15px'}}>📭</div>
            <h3>لا توجد طلبات للعرض</h3>
            <p>جرب تغيير الفلتر أو اختيار مدرس آخر.</p>
        </div>
      ) : (
        <>
            <div className="requests-grid">
            {requests.map(req => {
                const receiptUrl = req.payment_file_path 
                    ? `/api/admin/file-proxy?type=receipts&filename=${req.payment_file_path}` 
                    : null;
                
                // ✅ التحقق من وجود سعر فعلي مدفوع
                const hasActualPrice = req.actual_paid_price !== null && req.actual_paid_price !== undefined;
                
                return (
                    <div key={req.id} className={`request-card ${req.status}`}>
                        <div className="card-header">
                            <div className="req-meta">
                                <span className="req-id">#{req.id}</span>
                                <span className="req-date">{new Date(req.created_at).toLocaleDateString('ar-EG')}</span>
                            </div>
                            {req.teachers && (
                                <span className="teacher-badge">👨‍🏫 {req.teachers.name}</span>
                            )}
                        </div>

                        <div className="card-body">
                            <div className="info-row">
                                <div className="info-col">
                                    <span className="label">👤 اسم الطالب</span>
                                    <span className="value">{req.user_name}</span>
                                </div>
                                <div className="info-col right">
                                    <span className="label">📱 هاتف الطالب</span>
                                    <span className="value ltr">{req.phone}</span>
                                </div>
                            </div>
                            
                            {/* ✅ قسم عرض السعر الجديد */}
                            <div className="price-box">
                                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start'}}>
                                    <span className="label">المبلغ المطلوب</span>
                                    <span className="price-value" style={hasActualPrice ? {textDecoration: 'line-through', color: 'var(--text-muted)', fontSize: '0.9em'} : {}}>
                                        {req.total_price} ج.م
                                    </span>
                                    
                                    {hasActualPrice && (
                                        <>
                                            <span className="label" style={{marginTop: '5px', color: 'var(--gold)'}}>المدفوع فعلياً</span>
                                            <span className="price-value" style={{color: 'var(--gold)'}}>{req.actual_paid_price} ج.م</span>
                                        </>
                                    )}
                                </div>
                                
                                <button 
                                    className="btn-edit-price"
                                    onClick={() => setEditPriceModal({ show: true, id: req.id, price: hasActualPrice ? req.actual_paid_price : req.total_price })}
                                    title="تعديل المبلغ الفعلي"
                                >
                                    ✏️ تعديل
                                </button>
                            </div>
                            
                            <div className="details-box">
                                <span className="label">🛒 المحتوى المطلوب</span>
                                <p className="details-text">{req.course_title || 'محتوى غير محدد'}</p>
                            </div>

                            {req.user_note && (
                                <div className="note-box">
                                    <span className="label">📝 ملاحظات الطالب</span>
                                    <p className="note-text">{req.user_note}</p>
                                </div>
                            )}

                            {receiptUrl && (
                                <div className="receipt-section">
                                    <p className="label" style={{marginBottom:'8px'}}>📄 إيصال الدفع</p>
                                    <div 
                                        className="receipt-thumbnail-wrapper"
                                        onClick={() => setModalImage(receiptUrl)}
                                    >
                                        <img 
                                            src={receiptUrl} 
                                            alt="Receipt" 
                                            className="receipt-thumbnail" 
                                            loading="lazy"
                                            onError={(e) => {e.target.src = 'https://via.placeholder.com/300x200?text=No+Image';}}
                                        />
                                        <div className="zoom-hint">🔍</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {filter === 'pending' && (
                            <div className="card-actions">
                                <button 
                                    onClick={() => initiateAction(req.id, 'approve')} 
                                    disabled={processingId === req.id}
                                    className="btn approve"
                                >
                                    {processingId === req.id ? '...' : '✅ تفعيل'}
                                </button>
                                <button 
                                    onClick={() => initiateAction(req.id, 'reject')} 
                                    disabled={processingId === req.id}
                                    className="btn reject"
                                >
                                    {processingId === req.id ? '...' : '❌ رفض'}
                                </button>
                            </div>
                        )}
                        
                        {filter === 'rejected' && req.rejection_reason && (
                            <div className="rejection-note">
                                <strong>سبب الرفض:</strong> {req.rejection_reason}
                            </div>
                        )}
                    </div>
                );
            })}
            </div>

            <div className="pagination-controls">
                <button 
                    disabled={page === 1} 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="page-btn"
                >
                    ➡️ السابق
                </button>
                <span className="page-info">صفحة {page} من {totalPages || 1}</span>
                <button 
                    disabled={page >= totalPages} 
                    onClick={() => setPage(p => p + 1)}
                    className="page-btn"
                >
                    التالي ⬅️
                </button>
            </div>
        </>
      )}

      {/* نافذة عرض الصورة */}
      {modalImage && (
          <div className="modal-overlay" onClick={() => setModalImage(null)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                  <button className="close-modal" onClick={() => setModalImage(null)}>✕</button>
                  <img src={modalImage} alt="Full Receipt" className="modal-img" />
              </div>
          </div>
      )}

      {/* نافذة التأكيد (القبول/الرفض) */}
      {confirmModal.show && (
          <div className="modal-overlay alert-mode">
              <div className="alert-box">
                  <h3>⚠️ تأكيد الإجراء</h3>
                  <p>
                      {confirmModal.action === 'approve' 
                        ? 'هل أنت متأكد من تفعيل هذا الاشتراك؟ سيتمكن الطالب من الوصول للمحتوى فوراً.' 
                        : 'هل أنت متأكد من رفض هذا الطلب؟'}
                  </p>

                  {confirmModal.action === 'reject' && (
                      <textarea
                          className="reason-input"
                          placeholder="اكتب سبب الرفض هنا (اختياري)..."
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          rows="3"
                      ></textarea>
                  )}

                  <div className="alert-actions">
                      <button className="cancel-btn" onClick={() => setConfirmModal({ show: false })}>تراجع</button>
                      <button 
                        className={`confirm-btn ${confirmModal.action === 'reject' ? 'red' : 'green'}`} 
                        onClick={executeAction}
                      >
                          نعم، نفذ
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* ✅ نافذة تعديل السعر */}
      {editPriceModal.show && (
          <div className="modal-overlay alert-mode">
              <div className="alert-box">
                  <h3>✏️ تعديل المبلغ المدفوع</h3>
                  <p style={{marginBottom: '10px', color: 'var(--text-secondary)'}}>أدخل المبلغ الفعلي الذي تم دفعه للاحتفاظ به في السجلات:</p>
                  <input
                      type="number"
                      className="reason-input"
                      style={{ textAlign: 'center', fontSize: '1.5em', fontWeight: 'bold' }}
                      value={editPriceModal.price}
                      onChange={(e) => setEditPriceModal({ ...editPriceModal, price: e.target.value })}
                      placeholder="المبلغ بالجنيه..."
                      min="0"
                  />
                  <div className="alert-actions">
                      <button className="cancel-btn" onClick={() => setEditPriceModal({ show: false, id: null, price: '' })}>تراجع</button>
                      <button 
                        className="confirm-btn green" 
                        onClick={handleUpdatePrice}
                        disabled={processingId === editPriceModal.id}
                      >
                          {processingId === editPriceModal.id ? 'جاري الحفظ...' : 'حفظ التعديل'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      <style jsx>{`
        .header-container { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; flex-wrap: wrap; gap: 15px; border-bottom: 1px solid var(--border); padding-bottom: 20px; }
        .header-container h1 { margin: 0 0 5px 0; color: var(--text-primary); font-size: 1.8rem; }
        .sub-header { color: var(--text-secondary); margin: 0; font-size: 0.95em; }
        
        .header-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        
        .teacher-select-wrapper { position: relative; }
        .teacher-select { background: var(--bg-elevated); color: var(--text-primary); padding: 8px 30px 8px 15px; border: 1px solid var(--border); border-radius: 8px; font-size: 0.95rem; cursor: pointer; outline: none; height: 40px; min-width: 180px; }
        .teacher-select:focus { border-color: var(--gold); }

        .filter-tabs { display: flex; background: var(--bg-elevated); padding: 4px; border-radius: 8px; border: 1px solid var(--border); }
        .tab { background: transparent; border: none; color: var(--text-secondary); padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s; white-space: nowrap; }
        .tab:hover { color: var(--text-primary); }
        .tab.active { background: var(--gold); color: #111009; }

        .refresh-btn { background: var(--bg-elevated); color: var(--gold); border: 1px solid var(--border-accent); width: 40px; height: 40px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; transition: 0.2s; }
        .refresh-btn:hover { background: var(--gold); color: #111009; }

        .loading-state { text-align: center; color: var(--gold); padding: 60px; }
        .empty-state { text-align: center; padding: 60px; color: var(--text-secondary); background: var(--bg-elevated); border-radius: 12px; border: 1px dashed var(--border); margin-top: 20px; }

        .requests-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
        .request-card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; box-shadow: var(--shadow); transition: transform 0.2s, border-color 0.2s; display: flex; flex-direction: column; }
        .request-card:hover { transform: translateY(-5px); border-color: var(--gold); }
        .request-card.approved { border-color: #22c55e; }
        .request-card.rejected { border-color: #ef4444; opacity: 0.8; }

        .card-header { background: var(--bg-elevated); padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); }
        .req-meta { display: flex; gap: 10px; align-items: center; font-size: 0.85em; color: var(--text-secondary); }
        .req-id { font-family: monospace; background: var(--bg-hover); padding: 2px 6px; border-radius: 4px; color: var(--text-primary); }
        .teacher-badge { background: var(--gold-dim); color: var(--gold); padding: 4px 8px; border-radius: 20px; font-size: 0.8em; font-weight: bold; border: 1px solid var(--border-accent); }

        .card-body { padding: 20px; flex: 1; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 15px; }
        .info-col { display: flex; flex-direction: column; }
        .info-col.right { align-items: flex-end; }
        
        .label { color: var(--text-muted); font-size: 0.8em; font-weight: bold; text-transform: uppercase; margin-bottom: 3px; }
        .value { color: var(--text-primary); font-weight: 500; font-size: 1em; }
        .value.ltr { direction: ltr; font-family: monospace; }
        
        /* مربع السعر */
        .price-box { background: rgba(34, 197, 94, 0.05); border: 1px solid rgba(34, 197, 94, 0.2); padding: 10px; border-radius: 8px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
        .price-value { color: #4ade80; font-weight: bold; font-size: 1.2em; }
        .layout-root.light .price-box { background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); }
        .layout-root.light .price-value { color: #16a34a; }

        .btn-edit-price { background: var(--gold-dimmer); border: 1px solid var(--border-accent); color: var(--gold); padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85em; font-weight: bold; transition: all 0.2s; }
        .btn-edit-price:hover { background: var(--gold); color: #111009; }

        .details-box { background: var(--bg-base); padding: 12px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 15px; }
        .details-text { color: var(--text-primary); margin: 0; font-size: 0.95em; line-height: 1.5; white-space: pre-wrap; }

        .note-box { background: var(--gold-dimmer); border: 1px solid var(--border-accent); padding: 12px; border-radius: 8px; margin-bottom: 15px; }
        .note-text { color: var(--gold); margin: 0; font-size: 0.95em; line-height: 1.4; white-space: pre-wrap; }

        .receipt-section { margin-top: 15px; text-align: center; }
        .receipt-thumbnail-wrapper { position: relative; height: 160px; width: 100%; background: var(--bg-base); border-radius: 10px; overflow: hidden; cursor: zoom-in; border: 1px solid var(--border); transition: border-color 0.2s; }
        .receipt-thumbnail-wrapper:hover { border-color: var(--gold); }
        .receipt-thumbnail { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s; }
        .receipt-thumbnail-wrapper:hover .receipt-thumbnail { transform: scale(1.05); opacity: 0.8; }
        .zoom-hint { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 30px; opacity: 0; transition: opacity 0.3s; pointer-events: none; }
        .receipt-thumbnail-wrapper:hover .zoom-hint { opacity: 1; }

        .card-actions { display: flex; gap: 10px; padding: 15px 20px; border-top: 1px solid var(--border); background: var(--bg-elevated); }
        .btn { flex: 1; padding: 12px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; transition: opacity 0.2s; font-size: 1em; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn.approve { background: #22c55e; color: #fff; }
        .btn.reject { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.5); }
        .btn.reject:hover { background: #ef4444; color: white; }

        .rejection-note { padding: 15px; background: rgba(239, 68, 68, 0.1); color: #ef4444; font-size: 0.9em; border-top: 1px solid rgba(239, 68, 68, 0.3); }

        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); z-index: 1000; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(5px); }
        .modal-content { position: relative; max-width: 95%; max-height: 95%; display: flex; justify-content: center; align-items: center; }
        .modal-img { max-width: 100%; max-height: 90vh; border-radius: 8px; box-shadow: 0 0 20px rgba(0,0,0,0.5); }
        .close-modal { position: absolute; top: -40px; right: 0px; background: white; color: black; border: none; width: 30px; height: 30px; border-radius: 50%; font-weight: bold; cursor: pointer; font-size: 18px; }

        .alert-mode { background: rgba(0,0,0,0.7); backdrop-filter: blur(2px); }
        .alert-box { background: var(--bg-surface); padding: 25px; border-radius: 16px; border: 1px solid var(--border-accent); width: 90%; max-width: 400px; text-align: center; box-shadow: var(--shadow); animation: popIn 0.3s; }
        .alert-box h3 { margin-top: 0; color: var(--gold); }
        .alert-box p { color: var(--text-secondary); font-size: 1.1em; margin-bottom: 25px; }
        .reason-input { width: 100%; padding: 10px; background: var(--bg-base); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); margin-bottom: 20px; resize: vertical; font-family: inherit; }
        .reason-input:focus { border-color: var(--gold); outline: none; }
        
        .alert-actions { display: flex; gap: 10px; justify-content: center; }
        .alert-actions button { padding: 10px 20px; border-radius: 8px; border: none; font-weight: bold; cursor: pointer; font-size: 1em; }
        .cancel-btn { background: transparent; border: 1px solid var(--border) !important; color: var(--text-secondary); }
        .cancel-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
        .confirm-btn.green { background: #22c55e; color: #fff; }
        .confirm-btn.red { background: #ef4444; color: white; }

        .toast { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%) translateY(100px); background: var(--bg-elevated); color: var(--text-primary); padding: 12px 25px; border-radius: 50px; font-weight: bold; box-shadow: var(--shadow); z-index: 2000; transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); opacity: 0; border: 1px solid var(--border); }
        .toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }
        .toast.success { background: #22c55e; color: #fff; border-color: #22c55e; }
        .toast.error { background: #ef4444; color: white; border-color: #ef4444; }
        
        .spinner { width: 30px; height: 30px; border: 3px solid var(--border); border-top: 3px solid var(--gold); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 10px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes popIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }

        .pagination-controls { display: flex; justify-content: center; align-items: center; gap: 20px; margin-top: 30px; padding-top: 20px; border-top: 1px solid var(--border); }
        .page-btn { background: var(--bg-surface); color: var(--gold); border: 1px solid var(--border); padding: 8px 16px; border-radius: 8px; cursor: pointer; transition: 0.2s; font-weight: bold; }
        .page-btn:hover:not(:disabled) { background: var(--bg-hover); border-color: var(--border-accent); }
        .page-btn:disabled { opacity: 0.5; cursor: not-allowed; color: var(--text-muted); }
        .page-info { color: var(--text-secondary); font-family: monospace; }
      `}</style>
    </SuperLayout>
  );
}
