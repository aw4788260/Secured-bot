import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function StudentCourses() {
  const router = useRouter();
  const [courses, setCourses] = useState([]);
  const [myAccess, setMyAccess] = useState({ courses: [], subjects: [] });
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [uploading, setUploading] = useState(false);

  // جلب البيانات
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resCourses, resAccess] = await Promise.all([
            fetch('/api/public/get-courses'),
            fetch('/api/student/my-access')
        ]);
        const coursesData = await resCourses.json();
        const accessData = await resAccess.json();

        setCourses(coursesData);
        setMyAccess(accessData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const isSubscribed = (type, id) => {
      if (type === 'course') return myAccess.courses.includes(id);
      if (type === 'subject') return myAccess.subjects.includes(id); 
      return false;
  };

  const handleSubscribeClick = (item, type) => {
      setSelectedItem({ ...item, type });
      setShowModal(true);
  };

  const handleSubmit = async (e) => {
      e.preventDefault();
      setUploading(true);
      const formData = new FormData();
      formData.append('receipt', e.target.receipt.files[0]);
      if (selectedItem.type === 'course') formData.append('courseId', selectedItem.id);
      else formData.append('subjectId', selectedItem.id);
      
      formData.append('itemTitle', selectedItem.title);
      formData.append('price', selectedItem.price || '0'); 

      try {
          const res = await fetch('/api/student/request-course', { method: 'POST', body: formData });
          const result = await res.json();
          if (res.ok) {
              alert(result.message);
              setShowModal(false);
          } else { alert("خطأ: " + result.error); }
      } catch (err) { alert("فشل الاتصال بالسيرفر"); } 
      finally { setUploading(false); }
  };

  return (
    <div className="store-container" dir="rtl">
      <Head><title>متجر الكورسات</title></Head>
      
      <header className="store-header">
          <button onClick={() => router.push('/')} className="back-btn">🏠 مكتبتي</button>
          <h1>💎 متجر الكورسات</h1>
          <p>تصفح أحدث المواد واشترك الآن</p>
      </header>

      <div className="grid-container">
          {loading ? <div className="loader">جاري تحميل المتجر...</div> : courses.map(course => (
              <div key={course.id} className={`store-card ${isSubscribed('course', course.id) ? 'owned-card' : ''}`}>
                  <div className="card-banner">
                      <span className="category-badge">كورس كامل</span>
                      {isSubscribed('course', course.id) && <span className="owned-badge">✅ مملوك</span>}
                  </div>
                  
                  <div className="card-content">
                      <h2>{course.title}</h2>
                      <div className="price-row">
                          <span className="label">السعر:</span>
                          <span className="price">{course.price ? `${course.price} ج.م` : 'مجاني'}</span>
                      </div>

                      {/* المنطق الجديد: إخفاء زر الدخول */}
                      {isSubscribed('course', course.id) ? (
                          <div className="owned-status">
                              <p>هذا الكورس موجود في مكتبتك</p>
                          </div>
                      ) : (
                          <button onClick={() => handleSubscribeClick(course, 'course')} className="buy-btn">
                              🛒 اشتراك الآن
                          </button>
                      )}
                  </div>

                  {/* المواد الفرعية */}
                  {course.subjects && course.subjects.length > 0 && (
                      <div className="sub-items">
                          <h4>أو اشترِ مادة منفصلة:</h4>
                          {course.subjects.map(sub => {
                              const isOwned = isSubscribed('subject', sub.id) || isSubscribed('course', course.id);
                              return (
                                  <div key={sub.id} className="sub-row">
                                      <span>📄 {sub.title}</span>
                                      {isOwned ? (
                                          <span className="mini-owned">✅</span>
                                      ) : (
                                          <button onClick={() => handleSubscribeClick(sub, 'subject')} className="mini-buy">
                                              شراء
                                          </button>
                                      )}
                                  </div>
                              );
                          })}
                      </div>
                  )}
              </div>
          ))}
      </div>

      {/* Modal */}
      {showModal && selectedItem && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
              <div className="modal-box" onClick={e => e.stopPropagation()}>
                  <h3>تأكيد الطلب 📝</h3>
                  <div className="bill-info">
                      <p>الصنف: <strong>{selectedItem.title}</strong></p>
                      <p>السعر: <strong style={{color:'#4ade80'}}>{selectedItem.price || 0} ج.م</strong></p>
                  </div>
                  <p className="pay-hint">حول المبلغ على فودافون كاش: <span className="phone">010XXXXXXXX</span></p>
                  
                  <form onSubmit={handleSubmit}>
                      <label>إرفاق صورة التحويل:</label>
                      <input type="file" name="receipt" accept="image/*" required className="file-in" />
                      <div className="modal-acts">
                          <button type="button" onClick={() => setShowModal(false)} className="btn-cancel">إلغاء</button>
                          <button type="submit" disabled={uploading} className="btn-confirm">
                              {uploading ? 'جاري الرفع...' : 'إتمام الطلب ✅'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      <style jsx>{`
        .store-container { min-height: 100vh; background: #0f172a; color: white; font-family: 'Segoe UI', sans-serif; padding-bottom: 50px; }
        .store-header { background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%); padding: 30px 20px; text-align: center; border-bottom: 1px solid #334155; position: relative; }
        .store-header h1 { margin: 10px 0 5px; color: #38bdf8; font-size: 2rem; }
        .store-header p { color: #94a3b8; margin: 0; }
        .back-btn { position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; padding: 8px 15px; border-radius: 20px; cursor: pointer; font-weight: bold; }

        .grid-container { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 25px; padding: 30px 20px; max-width: 1200px; margin: 0 auto; }
        
        .store-card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; overflow: hidden; transition: transform 0.2s, box-shadow 0.2s; display: flex; flex-direction: column; }
        .store-card:hover { transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.3); border-color: #38bdf8; }
        .owned-card { border-color: #22c55e; opacity: 0.9; }

        .card-banner { height: 100px; background: linear-gradient(45deg, #334155, #475569); position: relative; display: flex; align-items: center; justify-content: center; font-size: 3em; }
        .category-badge { position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.6); padding: 4px 10px; border-radius: 12px; font-size: 0.75em; color: #cbd5e1; }
        .owned-badge { position: absolute; bottom: 10px; left: 10px; background: #22c55e; color: #000; padding: 4px 12px; border-radius: 12px; font-weight: bold; font-size: 0.85em; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }

        .card-content { padding: 20px; text-align: center; flex: 1; }
        .card-content h2 { margin: 0 0 15px; font-size: 1.4em; }
        .price-row { display: flex; justify-content: center; gap: 10px; margin-bottom: 20px; align-items: center; background: #0f172a; padding: 10px; border-radius: 8px; }
        .price { color: #4ade80; font-weight: bold; font-size: 1.2em; }
        
        .buy-btn { width: 100%; padding: 12px; background: #38bdf8; color: #0f172a; border: none; border-radius: 8px; font-weight: bold; font-size: 1em; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 10px rgba(56, 189, 248, 0.3); }
        .buy-btn:hover { background: #7dd3fc; transform: scale(1.02); }
        
        .owned-status { background: rgba(34, 197, 94, 0.1); color: #22c55e; padding: 10px; border-radius: 8px; border: 1px dashed #22c55e; font-size: 0.9em; font-weight: bold; }

        .sub-items { background: #0f172a; padding: 15px; border-top: 1px solid #334155; }
        .sub-items h4 { margin: 0 0 10px; color: #94a3b8; font-size: 0.85em; text-align: right; }
        .sub-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #1e293b; font-size: 0.9em; }
        .sub-row:last-child { border-bottom: none; }
        .mini-buy { background: transparent; border: 1px solid #38bdf8; color: #38bdf8; padding: 2px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8em; }
        .mini-buy:hover { background: #38bdf8; color: #0f172a; }

        /* Modal Styles */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); z-index: 1000; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(5px); }
        .modal-box { background: #1e293b; width: 90%; max-width: 400px; padding: 25px; border-radius: 20px; border: 1px solid #475569; box-shadow: 0 20px 50px rgba(0,0,0,0.5); animation: popIn 0.3s; }
        .modal-box h3 { margin-top: 0; color: #38bdf8; text-align: center; border-bottom: 1px solid #334155; padding-bottom: 15px; }
        .bill-info { background: #0f172a; padding: 15px; border-radius: 10px; margin: 20px 0; }
        .bill-info p { margin: 5px 0; display: flex; justify-content: space-between; }
        .pay-hint { font-size: 0.9em; color: #cbd5e1; margin-bottom: 15px; text-align: center; }
        .phone { color: #fca5a5; font-weight: bold; font-family: monospace; letter-spacing: 1px; }
        .file-in { width: 100%; background: #0f172a; padding: 10px; border-radius: 8px; border: 1px solid #334155; color: white; margin-bottom: 20px; }
        .modal-acts { display: flex; gap: 10px; }
        .btn-confirm { flex: 2; background: #22c55e; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; }
        .btn-cancel { flex: 1; background: transparent; border: 1px solid #64748b; color: #94a3b8; padding: 12px; border-radius: 8px; cursor: pointer; }
        
        @keyframes popIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}
