import AdminLayout from '../../components/AdminLayout';
import { useState, useEffect } from 'react';

export default function RequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  
  // حالة المودال (تحمل رابط الصورة المراد تكبيرها)
  const [modalImage, setModalImage] = useState(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/requests');
      const data = await res.json();
      if (Array.isArray(data)) setRequests(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // دالة المعالجة (قبول/رفض)
  const handleAction = async (requestId, action) => {
    let reason = null;
    if (action === 'reject') {
        reason = prompt("ما هو سبب الرفض؟ (اختياري)");
        if (reason === null) return;
    }

    if (!confirm(action === 'approve' ? "هل أنت متأكد من تفعيل الاشتراك؟" : "هل أنت متأكد من رفض الطلب؟")) return;

    setProcessingId(requestId);

    try {
      const res = await fetch('/api/admin/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action, rejectionReason: reason })
      });
      
      const result = await res.json();
      
      if (res.ok) {
        alert(result.message);
        setRequests(requests.filter(r => r.id !== requestId));
      } else {
        alert("خطأ: " + result.error);
      }
    } catch (err) {
      alert("حدث خطأ في الاتصال");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <AdminLayout title="طلبات الاشتراك">
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
            // نجهز الرابط المباشر للصورة هنا
            const receiptUrl = `/api/admin/file-proxy?type=receipts&filename=${req.payment_file_path}`;
            
            return (
                <div key={req.id} className="request-card">
                <div className="card-header">
                    <span className="req-id">#{req.id}</span>
                    <span className="req-date">{new Date(req.created_at).toLocaleDateString('ar-EG')}</span>
                </div>

                <div className="card-body">
                    <div className="info-row">
                        <span className="label">👤 الاسم:</span>
                        <span className="value">{req.user_name}</span>
                    </div>
                    <div className="info-row">
                        <span className="label">📱 الهاتف:</span>
                        <span className="value" dir="ltr">{req.phone}</span>
                    </div>
                    <div className="info-row">
                        <span className="label">💰 المبلغ:</span>
                        <span className="value price">{req.total_price} ج.م</span>
                    </div>
                    
                    <div className="items-box">
                        <p className="label">🛒 المطلوب:</p>
                        <p className="value">{req.course_title}</p>
                    </div>

                    {/* 🔥 التعديل هنا: عرض الصورة مباشرة بدلاً من الزر */}
                    <div className="receipt-section">
                        <p className="label" style={{marginBottom:'8px'}}>📄 إيصال الدفع (اضغط للتكبير):</p>
                        <div 
                            className="receipt-thumbnail-wrapper"
                            onClick={() => setModalImage(receiptUrl)} // عند الضغط، نرسل الرابط للمودال
                        >
                            <img 
                                src={receiptUrl} 
                                alt="Receipt" 
                                className="receipt-thumbnail" 
                                loading="lazy" // لتحسين الأداء
                            />
                            <div className="zoom-hint">🔍</div>
                        </div>
                    </div>
                </div>

                <div className="card-actions">
                    <button 
                        onClick={() => handleAction(req.id, 'approve')} 
                        disabled={processingId === req.id}
                        className="btn approve"
                    >
                        ✅ موافقة
                    </button>
                    <button 
                        onClick={() => handleAction(req.id, 'reject')} 
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

      {/* --- النافذة المنبثقة (Modal) --- */}
      {modalImage && (
          <div className="modal-overlay" onClick={() => setModalImage(null)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                  <button className="close-modal" onClick={() => setModalImage(null)}>✕</button>
                  <img src={modalImage} alt="Full Receipt" className="modal-img" />
              </div>
          </div>
      )}

      <style jsx>{`
        .requests-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
        .request-card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: transform 0.2s; }
        .request-card:hover { transform: translateY(-5px); border-color: #38bdf8; }
        .card-header { background: #0f172a; padding: 10px 15px; display: flex; justify-content: space-between; border-bottom: 1px solid #334155; font-size: 0.9em; color: #94a3b8; }
        .card-body { padding: 15px; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px dashed #334155; padding-bottom: 5px; }
        .label { color: #94a3b8; font-size: 0.9em; }
        .value { color: white; font-weight: bold; }
        .value.price { color: #4ade80; }
        .items-box { margin: 10px 0; background: #0f172a; padding: 10px; border-radius: 6px; }
        .items-box .value { font-size: 0.9em; line-height: 1.4; }
        .card-actions { display: flex; gap: 10px; padding: 15px; border-top: 1px solid #334155; background: #0f172a; }
        .btn { flex: 1; padding: 10px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; transition: opacity 0.2s; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn.approve { background: #22c55e; color: white; }
        .btn.reject { background: #ef4444; color: white; }
        .refresh-btn { background: #334155; color: #38bdf8; border: 1px solid #38bdf8; padding: 8px 15px; border-radius: 5px; cursor: pointer; }

        /* --- تنسيق الصورة المصغرة الجديد --- */
        .receipt-section { margin-top: 15px; text-align: center; }
        .receipt-thumbnail-wrapper {
            position: relative;
            height: 200px; /* ارتفاع ثابت للبطاقة */
            width: 100%;
            background: #0f172a;
            border-radius: 8px;
            overflow: hidden;
            cursor: zoom-in;
            border: 1px solid #334155;
        }
        .receipt-thumbnail {
            width: 100%;
            height: 100%;
            object-fit: cover; /* لملء المربع دون تشويه */
            transition: transform 0.3s;
        }
        .receipt-thumbnail-wrapper:hover .receipt-thumbnail {
            transform: scale(1.05);
            opacity: 0.8;
        }
        .zoom-hint {
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            font-size: 30px;
            opacity: 0;
            transition: opacity 0.3s;
            pointer-events: none;
        }
        .receipt-thumbnail-wrapper:hover .zoom-hint {
            opacity: 1;
        }

        /* --- تنسيق المودال --- */
        .modal-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.9);
            z-index: 1000;
            display: flex; justify-content: center; align-items: center;
            padding: 20px;
            backdrop-filter: blur(5px);
        }
        .modal-content {
            position: relative;
            max-width: 95%; max-height: 95%;
            display: flex; justify-content: center; align-items: center;
        }
        .modal-img {
            max-width: 100%; max-height: 90vh;
            border-radius: 5px;
            box-shadow: 0 0 20px rgba(0,0,0,0.5);
        }
        .close-modal {
            position: absolute; top: -40px; right: 0px;
            background: white; color: black; border: none;
            width: 30px; height: 30px; border-radius: 50%;
            font-weight: bold; cursor: pointer; font-size: 18px;
        }
      `}</style>
    </AdminLayout>
  );
}
