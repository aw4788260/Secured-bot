import TeacherLayout from '../../../components/TeacherLayout';
import { useState, useEffect } from 'react';

// --- أيقونات SVG الاحترافية ---
const Icons = {
    inbox: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>,
    clock: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
    check: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>,
    x: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
    refresh: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>,
    user: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>,
    phone: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>,
    cart: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>,
    note: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
    receipt: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>,
    zoom: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
};

export default function RequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  
  // حالات Pagination
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  // حالات الفلترة
  const [filter, setFilter] = useState('pending'); // pending, approved, rejected

  // حالات النوافذ والتنبيهات
  const [modalImage, setModalImage] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  const [confirmModal, setConfirmModal] = useState({ show: false, id: null, action: null });
  const [rejectionReason, setRejectionReason] = useState('');

  const showToast = (msg, type = 'success') => {
      setToast({ show: true, message: msg, type });
      setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      // جلب البيانات بناءً على الفلتر والصفحة
      const res = await fetch(`/api/dashboard/teacher/requests?status=${filter}&page=${page}&limit=${pageSize}`);
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

  // إعادة تعيين الصفحة عند تغيير الفلتر
  useEffect(() => {
    setPage(1);
  }, [filter]);

  // جلب الطلبات عند تغيير الفلتر أو الصفحة
  useEffect(() => {
    fetchRequests();
  }, [filter, page]);

  const initiateAction = (requestId, action) => {
      setRejectionReason('');
      setConfirmModal({ show: true, id: requestId, action });
  };

  const executeAction = async () => {
    const { id: requestId, action } = confirmModal;
    setConfirmModal({ show: false, id: null, action: null });
    setProcessingId(requestId);

    try {
      const res = await fetch('/api/dashboard/teacher/requests', {
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

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <TeacherLayout title="طلبات الاشتراك">
      <div className={`toast-notification ${toast.show ? 'show' : ''} ${toast.type}`}>
          {toast.message}
      </div>

      <div className="page-header">
        <div className="title-area">
            <div className="title-icon">{Icons.inbox}</div>
            <div>
                <h1 className="page-title">طلبات الاشتراك</h1>
                <p className="page-sub">متابعة وإدارة الاشتراكات الخاصة بكورساتك والموافقة عليها.</p>
            </div>
        </div>
        
        <div className="header-actions">
            <div className="filter-tabs">
                <button 
                    className={`tab ${filter === 'pending' ? 'active' : ''}`} 
                    onClick={() => setFilter('pending')}
                >
                    <span className="tab-icon">{Icons.clock}</span> المعلقة
                </button>
                <button 
                    className={`tab ${filter === 'approved' ? 'active' : ''}`} 
                    onClick={() => setFilter('approved')}
                >
                    <span className="tab-icon">{Icons.check}</span> المقبولة
                </button>
                <button 
                    className={`tab ${filter === 'rejected' ? 'active' : ''}`} 
                    onClick={() => setFilter('rejected')}
                >
                    <span className="tab-icon">{Icons.x}</span> المرفوضة
                </button>
            </div>
            <button onClick={fetchRequests} className="btn-refresh" title="تحديث البيانات">
                {Icons.refresh}
            </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
            <div className="spinner"></div>
            <p>جاري تحميل الطلبات...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="empty-state">
            <div className="empty-icon">{Icons.inbox}</div>
            <h3>لا توجد طلبات للعرض</h3>
            <p>لا توجد طلبات في هذه الفئة حالياً.</p>
        </div>
      ) : (
        <>
            <div className="requests-grid">
            {requests.map(req => {
                const receiptUrl = req.payment_file_path 
                    ? `/api/admin/file-proxy?type=receipts&filename=${req.payment_file_path}` 
                    : null;
                
                // حساب تفاصيل السعر والخصم
                const originalPrice = req.total_price || 0;
                const actualPaidPrice = req.actual_paid_price;
                const hasDiscount = req.has_discount === true || (actualPaidPrice !== null && actualPaidPrice !== undefined && actualPaidPrice < originalPrice);
                
                return (
                    <div key={req.id} className={`request-card ${req.status}`}>
                        <div className="card-header">
                            <span className="req-id">#{req.id}</span>
                            <span className="req-date">{new Date(req.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                        </div>

                        <div className="card-body">
                            <div className="info-row">
                                <div className="info-col">
                                    <span className="label"><span className="mini-icon">{Icons.user}</span> اسم الطالب</span>
                                    <span className="value">{req.user_name}</span>
                                </div>
                                <div className="info-col right">
                                    <span className="label"><span className="mini-icon">{Icons.phone}</span> هاتف الطالب</span>
                                    <span className="value ltr" dir="ltr">{req.phone}</span>
                                </div>
                            </div>
                            
                            {/* صندوق السعر */}
                            <div className={`price-box ${hasDiscount ? 'discounted' : ''}`}>
                                <span className="label">المبلغ المدفوع</span>
                                {hasDiscount ? (
                                    <div className="price-group">
                                        <span className="old-price">{originalPrice} ج.م</span>
                                        <span className="price-value discount">{actualPaidPrice} ج.م</span>
                                    </div>
                                ) : (
                                    <span className="price-value">{originalPrice} ج.م</span>
                                )}
                            </div>
                            
                            <div className="details-box">
                                <span className="label"><span className="mini-icon">{Icons.cart}</span> المحتوى المطلوب</span>
                                <p className="details-text">{req.course_title || 'محتوى غير محدد'}</p>
                            </div>

                            {req.user_note && (
                                <div className="note-box">
                                    <span className="label"><span className="mini-icon">{Icons.note}</span> ملاحظات الطالب</span>
                                    <p className="note-text">{req.user_note}</p>
                                </div>
                            )}

                            {receiptUrl && (
                                <div className="receipt-section">
                                    <p className="label" style={{marginBottom:'8px'}}><span className="mini-icon">{Icons.receipt}</span> إيصال الدفع</p>
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
                                        <div className="zoom-hint">{Icons.zoom}</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* إظهار أزرار الإجراءات فقط إذا كان الطلب معلقاً */}
                        {filter === 'pending' && (
                            <div className="card-actions">
                                <button 
                                    onClick={() => initiateAction(req.id, 'approve')} 
                                    disabled={processingId === req.id}
                                    className="btn approve-btn"
                                >
                                    {processingId === req.id ? '...' : <><span className="btn-icon">{Icons.check}</span> تفعيل</>}
                                </button>
                                <button 
                                    onClick={() => initiateAction(req.id, 'reject')} 
                                    disabled={processingId === req.id}
                                    className="btn reject-btn"
                                >
                                    {processingId === req.id ? '...' : <><span className="btn-icon">{Icons.x}</span> رفض</>}
                                </button>
                            </div>
                        )}
                        
                        {/* إظهار سبب الرفض إذا كان مرفوضاً */}
                        {filter === 'rejected' && req.rejection_reason && (
                            <div className="rejection-note">
                                <strong>سبب الرفض:</strong> {req.rejection_reason}
                            </div>
                        )}
                    </div>
                );
            })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="pagination-controls">
                    <button 
                        disabled={page === 1} 
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        className="page-btn"
                    >
                        السابق
                    </button>
                    <span className="page-info">صفحة <strong className="highlight-text">{page}</strong> من {totalPages}</span>
                    <button 
                        disabled={page >= totalPages} 
                        onClick={() => setPage(p => p + 1)}
                        className="page-btn"
                    >
                        التالي
                    </button>
                </div>
            )}
        </>
      )}

      {/* Modal: Image Viewer */}
      {modalImage && (
          <div className="modal-overlay image-viewer" onClick={() => setModalImage(null)}>
              <div className="modal-content-img" onClick={e => e.stopPropagation()}>
                  <button className="close-modal" onClick={() => setModalImage(null)}>{Icons.x}</button>
                  <img src={modalImage} alt="Full Receipt" className="modal-img" />
              </div>
          </div>
      )}

      {/* Modal: Action Confirmation */}
      {confirmModal.show && (
          <div className="modal-overlay alert-mode" onClick={() => setConfirmModal({ show: false })}>
              <div className="modal-box" onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                      <h3>⚠️ تأكيد الإجراء</h3>
                      <button className="close-icon" onClick={() => setConfirmModal({ show: false })}>{Icons.x}</button>
                  </div>
                  
                  <div className="modal-body">
                      <p className="confirm-text">
                          {confirmModal.action === 'approve' 
                            ? 'هل أنت متأكد من تفعيل هذا الاشتراك؟ سيتمكن الطالب من الوصول للمحتوى فوراً.' 
                            : 'هل أنت متأكد من رفض هذا الطلب؟'}
                      </p>

                      {confirmModal.action === 'reject' && (
                          <div className="form-group">
                              <label>سبب الرفض (سيظهر للطالب):</label>
                              <textarea
                                  className="input area"
                                  placeholder="اكتب سبب الرفض هنا (اختياري)..."
                                  value={rejectionReason}
                                  onChange={(e) => setRejectionReason(e.target.value)}
                                  rows="3"
                              ></textarea>
                          </div>
                      )}
                  </div>

                  <div className="modal-footer">
                      <button className="btn-cancel" onClick={() => setConfirmModal({ show: false })}>تراجع</button>
                      <button 
                        className={`btn-confirm ${confirmModal.action === 'reject' ? 'danger-bg' : 'success-bg'}`} 
                        onClick={executeAction}
                      >
                          نعم، تأكيد
                      </button>
                  </div>
              </div>
          </div>
      )}

      <style jsx>{`
        /* ── THEME VARS ── */
        .toast-notification { position: fixed; top: 24px; left: 50%; transform: translate(-50%, -150%); padding: 14px 28px; border-radius: 12px; font-weight: bold; transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1); z-index: 99999; box-shadow: 0 10px 30px rgba(0,0,0,0.5); font-size: 0.95rem; border: 1px solid rgba(255,255,255,0.1); }
        .toast-notification.show { transform: translate(-50%, 0); } 
        .toast-notification.success { background: #22c55e; color: #111009; } 
        .toast-notification.error { background: #ef4444; color: #fff; }

        .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; flex-wrap: wrap; gap: 20px; border-bottom: 1px solid var(--border); padding-bottom: 20px; }
        .title-area { display: flex; align-items: center; gap: 16px; }
        .title-icon { width: 50px; height: 50px; background: var(--gold-dim); color: var(--gold); border-radius: 14px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border-accent); }
        .page-title { margin: 0 0 6px 0; color: var(--text-primary); font-size: 1.6rem; font-weight: 800; }
        .page-sub { margin: 0; color: var(--text-secondary); font-size: 0.95rem; }
        
        .header-actions { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
        
        .filter-tabs { display: flex; background: var(--bg-surface); padding: 5px; border-radius: 12px; border: 1px solid var(--border); }
        .tab { background: transparent; border: none; color: var(--text-secondary); padding: 8px 18px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: all 0.2s; white-space: nowrap; display: flex; align-items: center; gap: 6px; font-size: 0.9rem; }
        .tab-icon { display: flex; align-items: center; opacity: 0.8; }
        .tab:hover { color: var(--text-primary); background: var(--bg-hover); }
        .tab.active { background: var(--gold-dim); color: var(--gold); border: 1px solid var(--border-accent); box-shadow: 0 2px 8px rgba(201,168,76,0.1); }

        .btn-refresh { background: var(--bg-surface); color: var(--text-secondary); border: 1px solid var(--border); width: 42px; height: 42px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
        .btn-refresh:hover { background: var(--bg-hover); color: var(--gold); border-color: var(--border-accent); transform: rotate(15deg); }

        .loading-state { text-align: center; color: var(--gold); padding: 80px 20px; display: flex; flex-direction: column; align-items: center; gap: 15px; font-weight: bold; }
        .spinner { width: 36px; height: 36px; border: 3px solid var(--border); border-top-color: var(--gold); border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px; color: var(--text-muted); background: var(--bg-surface); border-radius: 16px; border: 1px dashed var(--border); margin-top: 20px; text-align: center; }
        .empty-icon { font-size: 3rem; color: var(--border); margin-bottom: 15px; }
        .empty-state h3 { color: var(--text-secondary); margin: 0 0 10px 0; }

        .requests-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 24px; }
        .request-card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; box-shadow: var(--shadow); transition: transform 0.2s, border-color 0.2s; display: flex; flex-direction: column; position: relative; }
        .request-card:hover { transform: translateY(-5px); border-color: var(--border-accent); box-shadow: 0 8px 24px rgba(201,168,76,0.1); }
        .request-card.approved { border-top: 4px solid #22c55e; }
        .request-card.rejected { border-top: 4px solid #ef4444; opacity: 0.85; }

        .card-header { background: var(--bg-elevated); padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); }
        .req-id { font-family: monospace; background: var(--bg-base); border: 1px solid var(--border); padding: 4px 10px; border-radius: 6px; color: var(--text-secondary); font-size: 0.85rem; font-weight: bold; }
        .req-date { font-size: 0.85rem; color: var(--text-muted); font-weight: 500; }

        .card-body { padding: 22px; flex: 1; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .info-col { display: flex; flex-direction: column; }
        .info-col.right { align-items: flex-end; }
        
        .label { color: var(--text-muted); font-size: 0.8rem; font-weight: bold; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
        .mini-icon { display: flex; opacity: 0.7; color: var(--gold); }
        .value { color: var(--text-primary); font-weight: 600; font-size: 1rem; }
        .value.ltr { direction: ltr; font-family: monospace; }
        
        .price-box { background: var(--bg-base); border: 1px solid var(--border); padding: 12px 15px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; transition: 0.3s; }
        .price-box.discounted { background: rgba(245, 158, 11, 0.05); border-color: rgba(245, 158, 11, 0.2); }
        .price-box .label { margin: 0; color: var(--text-secondary); }
        .price-value { color: var(--text-primary); font-weight: 800; font-size: 1.15rem; }
        .price-value.discount { color: #f59e0b; }
        .price-group { display: flex; align-items: center; gap: 10px; }
        .old-price { text-decoration: line-through; color: var(--text-muted); font-size: 0.9rem; }

        .details-box { background: var(--bg-elevated); padding: 14px; border-radius: 10px; border: 1px solid var(--border); margin-bottom: 16px; }
        .details-text { color: var(--text-primary); margin: 0; font-size: 0.95rem; font-weight: 500; line-height: 1.5; white-space: pre-wrap; }

        .note-box { background: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.2); padding: 14px; border-radius: 10px; margin-bottom: 16px; }
        .note-text { color: #fcd34d; margin: 0; font-size: 0.95rem; line-height: 1.5; white-space: pre-wrap; }

        .receipt-section { margin-top: 20px; }
        .receipt-thumbnail-wrapper { position: relative; height: 180px; width: 100%; background: var(--bg-base); border-radius: 12px; overflow: hidden; cursor: zoom-in; border: 1px solid var(--border); transition: border-color 0.2s; }
        .receipt-thumbnail-wrapper:hover { border-color: var(--gold); box-shadow: 0 4px 15px var(--gold-dim); }
        .receipt-thumbnail { width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease; }
        .receipt-thumbnail-wrapper:hover .receipt-thumbnail { transform: scale(1.05); opacity: 0.7; filter: blur(1px); }
        .zoom-hint { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: var(--text-primary); opacity: 0; transition: opacity 0.3s; pointer-events: none; background: rgba(0,0,0,0.5); padding: 12px; border-radius: 50%; backdrop-filter: blur(4px); display: flex; }
        .receipt-thumbnail-wrapper:hover .zoom-hint { opacity: 1; }

        .card-actions { display: flex; gap: 12px; padding: 18px 20px; border-top: 1px solid var(--border); background: var(--bg-elevated); }
        .btn { flex: 1; padding: 12px; border: none; border-radius: 10px; cursor: pointer; font-weight: bold; transition: all 0.2s; font-size: 0.95rem; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-icon { display: flex; align-items: center; }
        .approve-btn { background: #22c55e; color: #111009; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.2); }
        .approve-btn:hover:not(:disabled) { background: #16a34a; transform: translateY(-2px); box-shadow: 0 6px 16px rgba(34, 197, 94, 0.3); }
        .reject-btn { background: transparent; color: #ef4444; border: 1px solid #ef4444; }
        .reject-btn:hover:not(:disabled) { background: #ef4444; color: white; transform: translateY(-2px); box-shadow: 0 6px 16px rgba(239, 68, 68, 0.2); }

        .rejection-note { padding: 16px 20px; background: rgba(239, 68, 68, 0.05); color: #fca5a5; font-size: 0.9rem; border-top: 1px solid rgba(239, 68, 68, 0.2); line-height: 1.5; }

        .pagination-controls { display: flex; justify-content: center; align-items: center; gap: 20px; margin-top: 40px; padding-bottom: 20px; }
        .page-btn { background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border); padding: 10px 20px; border-radius: 10px; cursor: pointer; transition: 0.2s; font-weight: bold; }
        .page-btn:hover:not(:disabled) { background: var(--bg-hover); border-color: var(--gold); color: var(--gold); }
        .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .page-info { color: var(--text-secondary); font-size: 0.95rem; }
        .highlight-text { color: var(--gold); font-weight: bold; }

        /* MODALS */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 2000; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(5px); padding: 20px; }
        .image-viewer { z-index: 3000; }
        .modal-content-img { position: relative; max-width: 95vw; max-height: 95vh; display: flex; justify-content: center; align-items: center; animation: popIn 0.3s; }
        .modal-img { max-width: 100%; max-height: 90vh; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.6); }
        .close-modal { position: absolute; top: -45px; right: 0; background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border); width: 36px; height: 36px; border-radius: 50%; font-weight: bold; cursor: pointer; display: flex; justify-content: center; align-items: center; transition: 0.2s; }
        .close-modal:hover { background: var(--bg-hover); color: var(--gold); border-color: var(--gold); }

        .modal-box { background: var(--bg-surface); width: 100%; max-width: 450px; border-radius: 20px; border: 1px solid var(--border); display: flex; flex-direction: column; box-shadow: 0 25px 50px rgba(0,0,0,0.5); animation: popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); overflow: hidden; }
        .modal-header { background: var(--bg-elevated); padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); }
        .modal-header h3 { margin: 0; color: var(--gold); font-size: 1.2rem; font-weight: bold; }
        .close-icon { background: var(--bg-surface); border: 1px solid var(--border); color: var(--text-secondary); width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; justify-content: center; align-items: center; transition: 0.2s; }
        .close-icon:hover { background: var(--bg-hover); color: var(--text-primary); }
        
        .modal-body { padding: 24px; }
        .confirm-text { color: var(--text-primary); font-size: 1.05rem; margin-bottom: 20px; line-height: 1.5; }
        
        .form-group label { display: block; margin-bottom: 8px; color: var(--text-secondary); font-weight: bold; font-size: 0.9rem; }
        .input.area { width: 100%; background: var(--bg-base); border: 1px solid var(--border); color: var(--text-primary); padding: 12px; border-radius: 10px; font-family: inherit; resize: vertical; transition: 0.2s; }
        .input.area:focus { border-color: var(--gold); outline: none; box-shadow: 0 0 0 2px var(--gold-dim); }
        
        .modal-footer { padding: 18px 24px; background: var(--bg-elevated); display: flex; justify-content: flex-end; gap: 12px; border-top: 1px solid var(--border); }
        .btn-cancel { background: transparent; color: var(--text-secondary); border: 1px solid var(--border); padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s; }
        .btn-cancel:hover { background: var(--bg-hover); color: var(--text-primary); }
        .btn-confirm { border: none; padding: 10px 24px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s; color: white; }
        .btn-confirm.success-bg { background: #22c55e; color: #111009; }
        .btn-confirm.success-bg:hover { background: #16a34a; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3); }
        .btn-confirm.danger-bg { background: #ef4444; }
        .btn-confirm.danger-bg:hover { background: #dc2626; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); }

        @keyframes popIn { from { transform: scale(0.95) translateY(10px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }

        @media (max-width: 600px) {
            .page-header { flex-direction: column; align-items: flex-start; gap: 15px; }
            .header-actions { width: 100%; justify-content: space-between; }
            .filter-tabs { width: 100%; overflow-x: auto; padding-bottom: 5px; }
            .tab { flex: 1; justify-content: center; }
            .requests-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </TeacherLayout>
  );
}
