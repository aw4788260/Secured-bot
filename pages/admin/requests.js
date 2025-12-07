import AdminLayout from '../../components/AdminLayout';
import { useState, useEffect } from 'react';

export default function RequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null); // لمنع الضغط المتكرر

  // دالة جلب البيانات
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

  // دالة التعامل مع القبول/الرفض
  const handleAction = async (requestId, action) => {
    let reason = null;
    if (action === 'reject') {
        reason = prompt("ما هو سبب الرفض؟ (اختياري)");
        if (reason === null) return; // إلغاء
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
        // تحديث القائمة بحذف الطلب الذي تمت معالجته
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
          {requests.map(req => (
            <div key={req.id} className="request-card">
              
              {/* رأس البطاقة */}
              <div className="card-header">
                <span className="req-id">#{req.id}</span>
                <span className="req-date">{new Date(req.created_at).toLocaleDateString('ar-EG')}</span>
              </div>

              {/* تفاصيل الطالب */}
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

                {/* صورة الإيصال */}
                <div className="receipt-section">
                    <p className="label">📄 إيصال الدفع:</p>
                    <a href={`/api/admin/file-proxy?type=receipts&filename=${req.payment_file_path}`} target="_blank" rel="noreferrer">
                        <img 
                            src={`/api/admin/file-proxy?type=receipts&filename=${req.payment_file_path}`} 
                            alt="إيصال" 
                            className="receipt-img"
                        />
                    </a>
                </div>
              </div>

              {/* أزرار التحكم */}
              <div className="card-actions">
                <button 
                    onClick={() => handleAction(req.id, 'approve')} 
                    disabled={processingId === req.id}
                    className="btn approve"
                >
                    ✅ موافقة وتفعيل
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
          ))}
        </div>
      )}

      <style jsx>{`
        .requests-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
        }
        .request-card {
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: transform 0.2s;
        }
        .request-card:hover { transform: translateY(-5px); border-color: #38bdf8; }
        
        .card-header {
            background: #0f172a;
            padding: 10px 15px;
            display: flex;
            justify-content: space-between;
            border-bottom: 1px solid #334155;
            font-size: 0.9em;
            color: #94a3b8;
        }
        
        .card-body { padding: 15px; }
        
        .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px dashed #334155; padding-bottom: 5px; }
        .label { color: #94a3b8; font-size: 0.9em; }
        .value { color: white; font-weight: bold; }
        .value.price { color: #4ade80; }

        .items-box { margin: 10px 0; background: #0f172a; padding: 10px; border-radius: 6px; }
        .items-box .value { font-size: 0.9em; line-height: 1.4; }

        .receipt-section { text-align: center; margin-top: 10px; }
        .receipt-img { 
            max-width: 100%; height: 150px; object-fit: cover; 
            border-radius: 6px; border: 1px solid #475569; margin-top: 5px; cursor: pointer; 
        }
        .receipt-img:hover { opacity: 0.8; }

        .card-actions {
            display: flex;
            gap: 10px;
            padding: 15px;
            border-top: 1px solid #334155;
            background: #0f172a;
        }
        .btn { flex: 1; padding: 10px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; transition: opacity 0.2s; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn.approve { background: #22c55e; color: white; }
        .btn.reject { background: #ef4444; color: white; }
        
        .refresh-btn {
            background: #334155; color: #38bdf8; border: 1px solid #38bdf8;
            padding: 8px 15px; border-radius: 5px; cursor: pointer;
        }
        .refresh-btn:hover { background: #38bdf8; color: #0f172a; }
      `}</style>
    </AdminLayout>
  );
}
