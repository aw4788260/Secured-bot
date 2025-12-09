import AdminLayout from '../../components/AdminLayout';
import { useState, useEffect } from 'react';

export default function RequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  
  // حالة نافذة الصور
  const [modalImage, setModalImage] = useState(null);

  // حالة الإشعارات (Toast)
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  // حالة نافذة التأكيد (Confirm Modal)
  const [confirmModal, setConfirmModal] = useState({ show: false, id: null, action: null });
  
  // [✅] حالة جديدة لتخزين سبب الرفض
  const [rejectionReason, setRejectionReason] = useState('');

  // دالة عرض الإشعار
  const showToast = (msg, type = 'success') => {
      setToast({ show: true, message: msg, type });
      setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/requests');
      const data = await res.json();
      if (Array.isArray(data)) setRequests(data);
    } catch (err) {
      console.error(err);
      showToast('فشل جلب البيانات', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // 1. فتح نافذة التأكيد
  const initiateAction = (requestId, action) => {
      setRejectionReason(''); // [✅] تصفير السبب عند فتح النافذة
      setConfirmModal({ show: true, id: requestId, action });
  };

  // 2. تنفيذ الإجراء فعلياً
  const executeAction = async () => {
    const { id: requestId, action } = confirmModal;
    setConfirmModal({ show: false, id: null, action: null }); // إغلاق النافذة
    setProcessingId(requestId);

    try {
      const res = await fetch('/api/admin/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // [✅] إرسال سبب الرفض (إذا كان الإجراء رفض)
        body: JSON.stringify({ 
            requestId, 
            action, 
            rejectionReason: action === 'reject' ? rejectionReason : null 
        })
      });
      
      const result = await res.json();
      
      if (res.ok) {
        showToast(result.message, 'success');
        setRequests(requests.filter(r => r.id !== requestId));
      } else {
        showToast(result.error, 'error');
      }
    } catch (err) {
      showToast("حدث خطأ في الاتصال", 'error');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <AdminLayout title="طلبات الاشتراك">
      {/* مكون الإشعار */}
      <div className={`toast ${toast.show ? 'show' : ''} ${toast.type}`}>
          {toast.message}
      </div>

      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
        <h1>📥 طلبات الاشتراك المعلقة</h1>
        <button onClick={fetchRequests} className="refresh-btn">🔄 تحديث</button>
      </div>

      {loading ? (
        <div style={{textAlign:'center', color:'#38bdf8'}}>جاري التحميل...</div>
      ) : requests.length === 0 ? (
        <div style={{textAlign:'center', padding:'40px', color:'#94a3b8', background:'#1e293b', borderRadius:'10px'}}>
            ✅ لا توجد طلبات معلقة حالياً.
        </div>
      ) : (
        <div className="requests-grid">
          {requests.map(req => {
            const receiptUrl = `/api/admin/file-proxy?type=receipts&filename=${req.payment_file_path}`;
            
            return (
                <div key={req.id} className="request-card">
                    <div className="card-header">
                        <span className="req-id">#{req.id}</span>
                        <span className="req-date">{new Date(req.created_at).toLocaleDateString('ar-EG')}</span>
                    </div>

                    <div className="card-body">
                        <div className="info-block">
                            <span className="label">👤 اسم الطالب</span>
                            <span className="value">{req.user_name}</span>
                        </div>
                        
                        <div className="info-block">
                            <span className="label">📱 رقم الهاتف</span>
                            <span className="value" dir="ltr">{req.phone}</span>
                        </div>
                        
                        <div className="info-block">
                            <span className="label">💰 المبلغ المدفوع</span>
                            <span className="value price">{req.total_price} ج.م</span>
                        </div>
                        
                        <div className="info-block box">
                            <span className="label">🛒 تفاصيل الطلب</span>
                            <p className="value text-wrap">{req.course_title}</p>
                        </div>

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
                                />
                                <div className="zoom-hint">🔍</div>
                            </div>
                        </div>
                    </div>

                    <div className="card-actions">
                        <button 
                            onClick={() => initiateAction(req.id, 'approve')} 
                            disabled={processingId === req.id}
                            className="btn approve"
                        >
                            ✅ تفعيل
                        </button>
                        <button 
                            onClick={() => initiateAction(req.id, 'reject')} 
                            disabled={processingId === req.id}
                            className="btn reject"
                        >
                            ❌ رفض
                        </button>
                    </div>
                </div>
            );
          })}
        </div>
      )}

      {/* --- نافذة تكبير الصورة --- */}
      {modalImage && (
          <div className="modal-overlay" onClick={() => setModalImage(null)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                  <button className="close-modal" onClick={() => setModalImage(null)}>✕</button>
                  <img src={modalImage} alt="Full Receipt" className="modal-img" />
              </div>
          </div>
      )}

      {/* --- نافذة التأكيد (Custom Confirm Modal) --- */}
      {confirmModal.show && (
          <div className="modal-overlay alert-mode">
              <div className="alert-box">
                  <h3>⚠️ تأكيد الإجراء</h3>
                  <p>
                      {confirmModal.action === 'approve' 
                        ? 'هل أنت متأكد من تفعيل هذا الاشتراك؟' 
                        : 'هل أنت متأكد من رفض هذا الطلب وحذفه؟'}
                  </p>

                  {/* [✅] حقل إدخال سبب الرفض (يظهر فقط عند الرفض) */}
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

      <style jsx>{`
        /* Grid Layout */
        .requests-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
        
        /* Card Styles */
        .request-card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: transform 0.2s; display: flex; flex-direction: column; }
        .request-card:hover { transform: translateY(-5px); border-color: #38bdf8; }
        
        .card-header { background: #0f172a; padding: 12px 20px; display: flex; justify-content: space-between; border-bottom: 1px solid #334155; color: #94a3b8; font-size: 0.9em; }
        .card-body { padding: 20px; flex: 1; }

        .info-block { margin-bottom: 15px; display: flex; flex-direction: column; gap: 5px; }
        .info-block.box { background: #0f172a; padding: 12px; border-radius: 8px; border: 1px solid #334155; }
        
        .label { color: #94a3b8; font-size: 0.85em; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
        .value { color: white; font-size: 1.1em; font-weight: 500; }
        .value.price { color: #4ade80; font-size: 1.3em; font-weight: bold; }
        .value.text-wrap { white-space: pre-wrap; line-height: 1.6; font-size: 0.95em; }

        /* Actions */
        .card-actions { display: flex; gap: 10px; padding: 15px 20px; border-top: 1px solid #334155; background: #0f172a; }
        .btn { flex: 1; padding: 12px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; transition: opacity 0.2s; font-size: 1em; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn.approve { background: #22c55e; color: #0f172a; }
        .btn.reject { background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.5); }
        .btn.reject:hover { background: #ef4444; color: white; }
        
        .refresh-btn { background: #334155; color: #38bdf8; border: 1px solid #38bdf8; padding: 8px 15px; border-radius: 6px; cursor: pointer; }

        /* Receipt Thumbnail */
        .receipt-section { margin-top: 20px; text-align: center; }
        .receipt-thumbnail-wrapper {
            position: relative; height: 180px; width: 100%; background: #0f172a; border-radius: 10px; overflow: hidden; cursor: zoom-in; border: 1px solid #334155; transition: border-color 0.2s;
        }
        .receipt-thumbnail-wrapper:hover { border-color: #38bdf8; }
        .receipt-thumbnail { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s; }
        .receipt-thumbnail-wrapper:hover .receipt-thumbnail { transform: scale(1.05); opacity: 0.8; }
        .zoom-hint { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 30px; opacity: 0; transition: opacity 0.3s; pointer-events: none; }
        .receipt-thumbnail-wrapper:hover .zoom-hint { opacity: 1; }

        /* Modals & Alerts */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); z-index: 1000; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(5px); }
        .modal-content { position: relative; max-width: 95%; max-height: 95%; display: flex; justify-content: center; align-items: center; }
        .modal-img { max-width: 100%; max-height: 90vh; border-radius: 8px; box-shadow: 0 0 20px rgba(0,0,0,0.5); }
        .close-modal { position: absolute; top: -40px; right: 0px; background: white; color: black; border: none; width: 30px; height: 30px; border-radius: 50%; font-weight: bold; cursor: pointer; font-size: 18px; }

        /* Alert Box Styling */
        .alert-mode { background: rgba(0,0,0,0.7); backdrop-filter: blur(2px); }
        .alert-box { background: #1e293b; padding: 25px; border-radius: 16px; border: 1px solid #475569; width: 90%; max-width: 400px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.5); animation: popIn 0.3s; }
        .alert-box h3 { margin-top: 0; color: #38bdf8; }
        .alert-box p { color: #cbd5e1; font-size: 1.1em; margin-bottom: 25px; }
        
        /* [✅] ستايل حقل سبب الرفض */
        .reason-input { 
            width: 100%; 
            padding: 10px; 
            background: #0f172a; 
            border: 1px solid #475569; 
            border-radius: 8px; 
            color: white; 
            margin-bottom: 20px; 
            resize: vertical; 
            font-family: inherit;
        }
        .reason-input:focus { border-color: #ef4444; outline: none; }

        .alert-actions { display: flex; gap: 10px; justify-content: center; }
        .alert-actions button { padding: 10px 20px; border-radius: 8px; border: none; font-weight: bold; cursor: pointer; font-size: 1em; }
        .cancel-btn { background: transparent; border: 1px solid #64748b; color: #94a3b8; }
        .confirm-btn.green { background: #22c55e; color: #0f172a; }
        .confirm-btn.red { background: #ef4444; color: white; }

        /* Toast Notification */
        .toast { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%) translateY(100px); background: #333; color: white; padding: 12px 25px; border-radius: 50px; font-weight: bold; box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 2000; transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); opacity: 0; }
        .toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }
        .toast.success { background: #22c55e; color: #0f172a; }
        .toast.error { background: #ef4444; color: white; }

        @keyframes popIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </AdminLayout>
  );
}
