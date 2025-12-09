import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function StudentCourses() {
  const router = useRouter();
  const [courses, setCourses] = useState([]);
  const [myAccess, setMyAccess] = useState({ courses: [], subjects: [] });
  const [loading, setLoading] = useState(true);

  // السلة
  const [cart, setCart] = useState([]);
  
  // Modals
  const [showModal, setShowModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [myRequests, setMyRequests] = useState([]);
  
  const [receiptFile, setReceiptFile] = useState(null);
  const [userNote, setUserNote] = useState('');
  const [uploading, setUploading] = useState(false);

  // Toast
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  const showToast = (msg, type = 'success') => {
      setToast({ show: true, message: msg, type });
      setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };

  useEffect(() => {
    const fetchData = async () => {
      const uid = localStorage.getItem('auth_user_id');
      const did = localStorage.getItem('auth_device_id');

      if (!uid) { router.replace('/login'); return; }

      try {
        const [resCourses, resAccess] = await Promise.all([
            fetch('/api/public/get-courses'),
            fetch('/api/student/my-access', { headers: { 'x-user-id': uid, 'x-device-id': did } })
        ]);
        const coursesData = await resCourses.json();
        const accessData = await resAccess.json();
        setCourses(coursesData);
        setMyAccess(accessData);
      } catch (err) { console.error(err); } 
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const fetchMyRequests = async () => {
      const uid = localStorage.getItem('auth_user_id');
      try {
          const res = await fetch('/api/student/my-requests', {
              headers: { 'x-user-id': uid }
          });
          const data = await res.json();
          setMyRequests(data);
          setShowHistoryModal(true);
      } catch (e) { showToast("فشل جلب السجل", "error"); }
  };

  const handleBack = () => {
      if (typeof window !== 'undefined' && window.Android && window.Android.closeWebView) {
          window.Android.closeWebView();
      } else {
          router.push('/');
      }
  };

  const isSubscribed = (type, id) => {
      if (type === 'course') return myAccess.courses.includes(id);
      if (type === 'subject') return myAccess.subjects.includes(id); 
      return false;
  };

  const isInCart = (type, id) => cart.some(item => item.id === id && item.type === type);

  const toggleCart = (item, type) => {
      if (isInCart(type, item.id)) {
          setCart(cart.filter(i => !(i.id === item.id && i.type === type)));
      } else {
          let newCart = [...cart];
          if (type === 'course' && item.subjects) {
              const subIds = item.subjects.map(s => s.id);
              newCart = newCart.filter(i => !(i.type === 'subject' && subIds.includes(i.id)));
          }
          newCart.push({ ...item, type });
          setCart(newCart);
      }
  };

  const handleSubjectToggle = (subject, courseId) => {
      if (isInCart('course', courseId)) {
          showToast("الكورس الكامل يشمل هذه المادة", "error");
          return;
      }
      toggleCart(subject, 'subject');
  };

  const cartTotal = cart.reduce((sum, item) => sum + (parseInt(item.price) || 0), 0);

  const visibleCourses = courses.filter(course => {
      const hasFullCourse = isSubscribed('course', course.id);
      const hasAllSubjects = course.subjects && course.subjects.length > 0 && course.subjects.every(sub => isSubscribed('subject', sub.id));
      return !(hasFullCourse || hasAllSubjects);
  });

  const handleSubmit = async (e) => {
      e.preventDefault();
      if (!receiptFile) return showToast("يرجى إرفاق صورة التحويل", "error");
      if (cart.length === 0) return showToast("السلة فارغة!", "error");

      setUploading(true);
      const formData = new FormData();
      formData.append('receiptFile', receiptFile);
      formData.append('user_note', userNote);
      formData.append('selectedItems', JSON.stringify(cart));
      
      const uid = localStorage.getItem('auth_user_id'); 

      try {
          const res = await fetch('/api/student/request-course', { 
              method: 'POST', body: formData, headers: { 'x-user-id': uid } 
          });
          const result = await res.json();
          if (res.ok) {
              showToast(result.message, "success");
              setCart([]); setShowModal(false);
              setTimeout(() => router.reload(), 2000);
          } else { 
              showToast("خطأ: " + (result.error || "فشل الرفع"), "error");
          }
      } catch (err) { showToast("فشل الاتصال بالسيرفر", "error"); } 
      finally { setUploading(false); }
  };

  const getStatusLabel = (status) => {
      if (status === 'approved') return { text: 'مقبول ✅', color: '#22c55e' };
      if (status === 'rejected') return { text: 'مرفوض ❌', color: '#ef4444' };
      return { text: 'قيد المراجعة ⏳', color: '#f59e0b' };
  };

  return (
    <div className="store-container" dir="rtl">
      <Head><title>متجر الكورسات</title></Head>
      
      <div className={`toast ${toast.show ? 'show' : ''} ${toast.type}`}>
          {toast.type === 'success' ? '✅ ' : '⚠️ '} {toast.message}
      </div>

      {/* ✅ الهيدر المحسن والمتجاوب */}
      <header className="store-header">
          <div className="header-content">
              {/* زر الطلبات (يمين) */}
              <button onClick={fetchMyRequests} className="icon-btn history-btn">
                  📜 <span className="btn-text">طلباتي</span>
              </button>

              {/* العنوان (وسط) */}
              <h1 className="header-title">المتجر 💎</h1>

              {/* زر الرجوع (يسار) */}
              <button onClick={handleBack} className="icon-btn back-btn">
                  🔙 <span className="btn-text">رجوع</span>
              </button>
          </div>
      </header>

      <div className="grid-container">
          {loading ? (
              <div className="loader">جاري تحميل المتجر...</div>
          ) : visibleCourses.length > 0 ? (
              visibleCourses.map(course => (
                  <div key={course.id} className={`store-card ${isInCart('course', course.id) ? 'active-card' : ''}`}>
                      <div className="card-content">
                          <h2>{course.title}</h2>
                          <div className="price-row">
                              <span className="label">سعر الكورس:</span>
                              <span className="price">{course.price ? `${course.price} ج.م` : 'مجاني'}</span>
                          </div>
                          <button onClick={() => toggleCart(course, 'course')} className={`buy-btn ${isInCart('course', course.id) ? 'remove-btn' : ''}`}>
                              {isInCart('course', course.id) ? '❌ إلغاء الكورس' : '🛒 إضافة الكورس للسلة'}
                          </button>
                      </div>
                      {course.subjects && course.subjects.length > 0 && (
                          <div className="sub-items">
                              <h4>أو اختر مواد منفصلة:</h4>
                              {course.subjects.map(sub => {
                                  const isOwned = isSubscribed('subject', sub.id);
                                  const inCart = isInCart('subject', sub.id);
                                  return (
                                      <div key={sub.id} className={`sub-row ${inCart ? 'selected-sub' : ''}`}>
                                          <div style={{flex: 1}}>
                                              <span>📄 {sub.title}</span>
                                              <span style={{fontSize:'0.85em', color:'#4ade80', marginRight:'5px', fontWeight:'bold'}}>
                                                  ({sub.price || 0} ج.م)
                                              </span>
                                          </div>
                                          {isOwned ? (
                                              <span className="mini-owned">✅ مملوك</span>
                                          ) : (
                                              <button onClick={() => handleSubjectToggle(sub, course.id)} className={`mini-buy ${inCart ? 'mini-remove' : ''}`}>
                                                  {inCart ? 'حذف' : 'إضافة'}
                                              </button>
                                          )}
                                      </div>
                                  );
                              })}
                          </div>
                      )}
                  </div>
              ))
          ) : (
              <div className="empty-store">
                  <p>🎉 لا توجد كورسات جديدة للاشتراك!</p>
                  <button onClick={handleBack} className="back-home-btn">العودة للمكتبة</button>
              </div>
          )}
      </div>

      {cart.length > 0 && (
          <div className="checkout-bar">
              <div className="cart-info">
                  <span>تم اختيار {cart.length} عناصر</span>
                  <span className="total-price">الإجمالي: {cartTotal} ج.م</span>
              </div>
              <button onClick={() => { setReceiptFile(null); setShowModal(true); }} className="checkout-btn">
                  إتمام الطلب ✅
              </button>
          </div>
      )}

      {/* --- نافذة الطلب --- */}
      {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
              <div className="modal-box" onClick={e => e.stopPropagation()}>
                  <h3>تأكيد الطلب 📝</h3>
                  <div className="cart-summary-list">
                      {cart.map((item, idx) => (
                          <div key={idx} className="summary-item">
                              <span>{item.type === 'course' ? '📦' : '📄'} {item.title}</span>
                              <span>{item.price} ج.م</span>
                          </div>
                      ))}
                      <div className="summary-total">الإجمالي المطلوب: {cartTotal} ج.م</div>
                  </div>
                  <p className="pay-hint">حول المبلغ على فودافون كاش: <span className="phone">010XXXXXXXX</span></p>
                  <form onSubmit={handleSubmit}>
                      <label>إرفاق صورة التحويل:</label>
                      <input type="file" accept="image/*" onChange={(e) => setReceiptFile(e.target.files[0])} required className="file-in" />
                      <label>ملاحظة (اختياري):</label>
                      <textarea className="note-in" placeholder="أكتب أي ملاحظة للأدمن هنا..." value={userNote} onChange={(e) => setUserNote(e.target.value)} rows="3"></textarea>
                      <div className="modal-acts">
                          <button type="button" onClick={() => setShowModal(false)} className="btn-cancel">إلغاء</button>
                          <button type="submit" disabled={uploading} className="btn-confirm">
                              {uploading ? 'جاري الرفع...' : 'تأكيد وإرسال 🚀'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* --- نافذة الطلبات السابقة --- */}
      {showHistoryModal && (
          <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
              <div className="modal-box history-box" onClick={e => e.stopPropagation()}>
                  <h3>📜 سجل طلباتي</h3>
                  <div className="history-list">
                      {myRequests.length === 0 ? (
                          <p style={{textAlign:'center', color:'#aaa'}}>لا توجد طلبات سابقة.</p>
                      ) : (
                          myRequests.map(req => {
                              const status = getStatusLabel(req.status);
                              return (
                                  <div key={req.id} className="history-item">
                                      <div className="req-header">
                                          <span className="req-date">{new Date(req.created_at).toLocaleDateString('ar-EG')}</span>
                                          <span className="req-status" style={{color: status.color}}>{status.text}</span>
                                      </div>
                                      <p className="req-title text-wrap">{req.course_title}</p>
                                      {req.status === 'rejected' && req.rejection_reason && (
                                          <div className="rejection-box">
                                              🛑 <b>سبب الرفض:</b> {req.rejection_reason}
                                          </div>
                                      )}
                                      <span className="req-price">{req.total_price} ج.م</span>
                                  </div>
                              );
                          })
                      )}
                  </div>
                  <button onClick={() => setShowHistoryModal(false)} className="btn-cancel full-width">إغلاق</button>
              </div>
          </div>
      )}

      <style jsx>{`
        .store-container { min-height: 100vh; background: #0f172a; color: white; font-family: 'Segoe UI', sans-serif; padding-bottom: 100px; }
        
        /* ✅ الهيدر الجديد المتجاوب */
        .store-header { 
            background: #1e293b; 
            padding: 15px; 
            border-bottom: 1px solid #334155; 
            position: sticky; top: 0; z-index: 50; 
        }
        .header-content {
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            max-width: 1200px; 
            margin: 0 auto;
        }
        .header-title { 
            margin: 0; 
            color: #38bdf8; 
            font-size: 1.5rem; 
            white-space: nowrap; 
        }

        .icon-btn { 
            background: rgba(255,255,255,0.05); 
            border: 1px solid rgba(255,255,255,0.1); 
            color: white; 
            padding: 8px 15px; 
            border-radius: 12px; 
            cursor: pointer; 
            font-weight: bold; 
            display: flex; 
            align-items: center; 
            gap: 5px;
            font-size: 0.9rem;
            transition: 0.2s;
        }
        .icon-btn:active { transform: scale(0.95); }
        
        .history-btn { color: #fcd34d; border-color: rgba(245, 158, 11, 0.3); }
        .back-btn { color: #e2e8f0; }

        @media (max-width: 480px) {
            .header-title { font-size: 1.2rem; }
            .btn-text { display: none; } /* إخفاء النص في الشاشات الصغيرة جداً والاكتفاء بالأيقونة */
            .icon-btn { padding: 8px; }
        }

        .grid-container { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 25px; padding: 20px; max-width: 1200px; margin: 0 auto; }
        
        .store-card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; overflow: hidden; transition: transform 0.2s; display: flex; flex-direction: column; }
        .store-card.active-card { border-color: #38bdf8; box-shadow: 0 0 15px rgba(56, 189, 248, 0.2); }
        .card-content { padding: 20px; text-align: center; flex: 1; border-bottom: 1px solid #334155; }
        .card-content h2 { margin: 0 0 15px; font-size: 1.4em; }
        .price-row { display: flex; justify-content: center; gap: 10px; margin-bottom: 20px; align-items: center; background: #0f172a; padding: 10px; border-radius: 8px; }
        .price { color: #4ade80; font-weight: bold; font-size: 1.2em; }
        .buy-btn { width: 100%; padding: 12px; background: #38bdf8; color: #0f172a; border: none; border-radius: 8px; font-weight: bold; font-size: 1em; cursor: pointer; transition: 0.2s; }
        .buy-btn.remove-btn { background: #ef4444; color: white; }
        
        .sub-items { background: #0f172a; padding: 15px; }
        .sub-items h4 { margin: 0 0 10px; color: #94a3b8; font-size: 0.85em; text-align: right; }
        .sub-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-bottom: 1px solid #1e293b; font-size: 0.9em; border-radius: 6px; }
        .sub-row.selected-sub { background: rgba(56, 189, 248, 0.15); }
        .sub-row:last-child { border-bottom: none; }
        .mini-buy { background: transparent; border: 1px solid #38bdf8; color: #38bdf8; padding: 4px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85em; font-weight: bold; }
        .mini-buy.mini-remove { border-color: #ef4444; color: #ef4444; }
        .mini-owned { color: #94a3b8; font-size: 0.85em; font-style: italic; }

        .checkout-bar { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); width: 90%; max-width: 600px; background: rgba(30, 41, 59, 0.95); backdrop-filter: blur(10px); border: 1px solid #38bdf8; padding: 15px 25px; border-radius: 50px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 100; animation: slideUp 0.3s; }
        .cart-info { display: flex; flex-direction: column; }
        .total-price { color: #4ade80; font-weight: bold; font-size: 1.1em; }
        .checkout-btn { background: #38bdf8; color: #0f172a; border: none; padding: 10px 20px; border-radius: 30px; font-weight: bold; cursor: pointer; }

        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); z-index: 1000; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(5px); }
        .modal-box { background: #1e293b; width: 90%; max-width: 450px; padding: 25px; border-radius: 20px; border: 1px solid #475569; max-height: 90vh; overflow-y: auto; }
        .history-box { max-width: 500px; }
        .modal-box h3 { margin-top: 0; color: #38bdf8; text-align: center; border-bottom: 1px solid #334155; padding-bottom: 15px; }
        
        .cart-summary-list { background: #0f172a; padding: 15px; border-radius: 10px; margin-bottom: 20px; }
        .summary-item { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #334155; font-size: 0.9em; }
        .summary-total { margin-top: 10px; text-align: center; font-weight: bold; color: #4ade80; font-size: 1.2em; }

        .pay-hint { font-size: 0.9em; color: #cbd5e1; margin-bottom: 15px; text-align: center; }
        .phone { color: #fca5a5; font-weight: bold; font-family: monospace; letter-spacing: 1px; }
        .file-in { width: 100%; background: #0f172a; padding: 10px; border-radius: 8px; border: 1px solid #334155; color: white; margin-bottom: 15px; }
        .note-in { width: 100%; background: #0f172a; padding: 10px; border-radius: 8px; border: 1px solid #334155; color: white; margin-bottom: 20px; font-family: inherit; resize: vertical; min-height: 60px; }
        .note-in:focus { border-color: #38bdf8; outline: none; }

        .modal-acts { display: flex; gap: 10px; }
        .btn-confirm { flex: 2; background: #22c55e; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; }
        .btn-cancel { flex: 1; background: transparent; border: 1px solid #64748b; color: #94a3b8; padding: 12px; border-radius: 8px; cursor: pointer; }
        .btn-cancel.full-width { width: 100%; margin-top: 15px; }

        .history-list { max-height: 60vh; overflow-y: auto; }
        .history-item { background: #0f172a; border: 1px solid #334155; padding: 15px; border-radius: 10px; margin-bottom: 10px; }
        .req-header { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.85em; color: #94a3b8; }
        .req-status { font-weight: bold; }
        .req-title { margin: 0 0 8px; font-size: 0.95em; white-space: pre-wrap; }
        .rejection-box { background: rgba(239, 68, 68, 0.1); color: #fca5a5; padding: 8px; border-radius: 6px; font-size: 0.9em; margin-bottom: 8px; border: 1px dashed rgba(239, 68, 68, 0.3); }
        .req-price { display: block; text-align: left; color: #4ade80; font-weight: bold; font-size: 1.1em; }

        .toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%) translateY(-100px); background: #1e293b; color: white; padding: 12px 24px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 1px solid #334155; z-index: 2000; transition: transform 0.3s ease; font-weight: bold; display: flex; align-items: center; gap: 10px; white-space: nowrap; }
        .toast.show { transform: translateX(-50%) translateY(0); }
        .toast.success { border-color: #22c55e; color: #22c55e; }
        .toast.error { border-color: #ef4444; color: #ef4444; }

        @keyframes slideUp { from { transform: translate(-50%, 50px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
      `}</style>
    </div>
  );
}
