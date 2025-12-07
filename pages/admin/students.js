import AdminLayout from '../../components/AdminLayout';
import { useState, useEffect } from 'react';

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [allCourses, setAllCourses] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  // البحث والفلترة
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  const [selectedUsers, setSelectedUsers] = useState([]);

  // --- حالات النوافذ المنبثقة (Custom Modals) ---
  const [viewUser, setViewUser] = useState(null); // ملف الطالب
  const [userSubs, setUserSubs] = useState({ courses: [], subjects: [] });
  const [loadingSubs, setLoadingSubs] = useState(false);

  const [showGrantModal, setShowGrantModal] = useState(false); // منح صلاحيات
  const [grantTarget, setGrantTarget] = useState(null);
  const [selectedGrantItems, setSelectedGrantItems] = useState({ courses: [], subjects: [] });

  // نافذة التأكيد (بديل confirm)
  const [confirmData, setConfirmData] = useState({ show: false, message: '', onConfirm: null });
  
  // نافذة الإدخال (بديل prompt)
  const [promptData, setPromptData] = useState({ show: false, title: '', value: '', onSubmit: null });

  // إشعارات (Toast)
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  // --- دوال المساعدة ---
  const showToast = (msg, type = 'success') => {
      setToast({ show: true, message: msg, type });
      setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };

  const showConfirm = (msg, callback) => {
      setConfirmData({ show: true, message: msg, onConfirm: callback });
  };

  const showPrompt = (title, initialVal, callback) => {
      setPromptData({ show: true, title, value: initialVal || '', onSubmit: callback });
  };

  // --- 1. جلب البيانات ---
  const fetchData = async () => {
    setLoading(true);
    try {
        if (allCourses.length === 0) {
            const resCourses = await fetch('/api/public/get-courses');
            const coursesData = await resCourses.json();
            setAllCourses(coursesData);
        }

        let url = '/api/admin/students';
        if (selectedFilter) {
            const [type, id] = selectedFilter.split('_');
            url += `?filter_type=${type}&filter_id=${id}`;
        }
        
        const res = await fetch(url);
        const data = await res.json();
        if (Array.isArray(data)) {
            setStudents(data);
            setCurrentPage(1);
            setSelectedUsers([]);
        }
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [selectedFilter]);

  // --- 2. ملف الطالب ---
  const openUserProfile = async (user) => {
      setViewUser(user);
      setLoadingSubs(true);
      try {
          const res = await fetch(`/api/admin/students?get_details_for_user=${user.id}`);
          const data = await res.json();
          setUserSubs(data);
      } catch (e) {}
      setLoadingSubs(false);
  };

  const closeUserProfile = () => {
      setViewUser(null);
      setUserSubs({ courses: [], subjects: [] });
  };

  // --- 3. تنفيذ الإجراءات (Backend) ---
  const runApiCall = async (action, payload, autoCloseProfile = false) => {
      try {
          const res = await fetch('/api/admin/students', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action, ...payload })
          });
          const resData = await res.json();
          if (res.ok) {
              showToast(resData.message, 'success');
              if (autoCloseProfile) setViewUser(null);
              
              if ((action === 'grant_access' || action === 'revoke_access' || action === 'change_username' || action === 'change_phone') && viewUser) {
                  // تحديث الواجهة المحلية فوراً
                  if (action === 'change_username') setViewUser({...viewUser, username: payload.newData.username});
                  if (action === 'change_phone') setViewUser({...viewUser, phone: payload.newData.phone});
                  openUserProfile(viewUser); // إعادة تحميل الاشتراكات
                  fetchData(); // تحديث الجدول في الخلفية
              } else {
                  fetchData();
              }
          } else { showToast(resData.error, 'error'); }
      } catch (e) { showToast('خطأ في الاتصال', 'error'); }
  };

  // --- 4. معالجات الأحداث (UI Handlers) ---
  const handlePassChange = () => {
      showPrompt('أدخل كلمة المرور الجديدة (ستيم تشفيرها):', '', (val) => {
          if(val) runApiCall('change_password', { userId: viewUser.id, newData: { password: val } });
      });
  };
  const handleUserChange = () => {
      showPrompt('تغيير اسم المستخدم:', viewUser.username, (val) => {
          if(val) runApiCall('change_username', { userId: viewUser.id, newData: { username: val } });
      });
  };
  const handlePhoneChange = () => {
      showPrompt('تغيير رقم الهاتف:', viewUser.phone, (val) => {
          if(val) runApiCall('change_phone', { userId: viewUser.id, newData: { phone: val } });
      });
  };

  // إدارة مودال المنح
  const openGrantModal = (target) => {
      setGrantTarget(target);
      setSelectedGrantItems({ courses: [], subjects: [] });
      setShowGrantModal(true);
  };
  
  const toggleGrantItem = (type, id) => {
      const currentList = selectedGrantItems[type];
      const newList = currentList.includes(id) ? currentList.filter(item => item !== id) : [...currentList, id];
      setSelectedGrantItems({ ...selectedGrantItems, [type]: newList });
  };

  const submitGrant = () => {
      if (selectedGrantItems.courses.length === 0 && selectedGrantItems.subjects.length === 0) {
          return showToast("يجب اختيار عنصر واحد على الأقل", 'error');
      }
      const isBulk = grantTarget === 'bulk';
      const payload = {
          userIds: isBulk ? selectedUsers : [grantTarget.id],
          grantList: selectedGrantItems
      };
      runApiCall('grant_access', payload, false);
      setShowGrantModal(false);
  };

  // إدارة العمليات الجماعية
  const toggleSelectAll = (e) => {
      if (e.target.checked) setSelectedUsers(currentTableData.map(u => u.id));
      else setSelectedUsers([]);
  };
  const toggleSelectUser = (id) => {
      if (selectedUsers.includes(id)) setSelectedUsers(selectedUsers.filter(uid => uid !== id));
      else setSelectedUsers([...selectedUsers, id]);
  };
  
  const handleBulkAction = (actionType) => {
      if (selectedUsers.length === 0) return;
      
      if (actionType === 'grant') {
          openGrantModal('bulk');
      }
      else if (actionType === 'revoke_bulk') {
          showConfirm('هل أنت متأكد من سحب الصلاحية المفلترة من هؤلاء الطلاب؟', () => {
              const [type, id] = selectedFilter.split('_');
              runApiCall('revoke_access', { userIds: selectedUsers, [type === 'course' ? 'courseId' : 'subjectId']: id });
          });
      }
      else if (actionType === 'reset_device') {
          showConfirm('هل أنت متأكد من إلغاء قفل الأجهزة للمحددين؟', () => {
              runApiCall('reset_device', { userIds: selectedUsers });
          });
      }
      else if (actionType === 'block') {
          showConfirm('تحذير: سيتم حظر الطلاب المحددين. هل أنت متأكد؟', () => {
              runApiCall('toggle_block', { userIds: selectedUsers, newData: { is_blocked: true } });
          });
      }
  };

  // --- 5. العرض والفلترة ---
  // تحديث منطق البحث ليشمل الـ ID
  const filteredStudents = students.filter(s => 
    s.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.phone?.includes(searchTerm) ||
    String(s.id).includes(searchTerm) // ✅ البحث بالـ ID
  );

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const currentTableData = filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const formatDate = (dateString) => {
      if (!dateString) return '-';
      return new Date(dateString).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <AdminLayout title="إدارة الطلاب">
      
      {/* Toast Notification */}
      <div className={`toast ${toast.show ? 'show' : ''} ${toast.type}`}>
          {toast.message}
      </div>

      {/* الشريط العلوي */}
      <div className="controls-container">
          <input className="search-input" placeholder="🔍 بحث (الاسم، الهاتف، ID)..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
          
          <div className="filter-wrapper">
            <select className="filter-select" onChange={e => setSelectedFilter(e.target.value)} value={selectedFilter}>
                <option value="">📂 كل الطلاب</option>
                {allCourses.map(c => (
                    <optgroup key={c.id} label={`📦 ${c.title}`}>
                        {/* خيار الكورس نفسه */}
                        <option value={`course_${c.id}`}>[مشتركي الكورس كامل]</option>
                        {/* خيارات المواد */}
                        {c.subjects?.map(s => (
                            <option key={s.id} value={`subject_${s.id}`}>📄 {s.title}</option>
                        ))}
                    </optgroup>
                ))}
            </select>
          </div>

          <button onClick={fetchData} className="btn-refresh">🔄</button>
      </div>

      {/* شريط الإجراءات الجماعية (Glass) */}
      {selectedUsers.length > 0 && (
          <div className="bulk-glass-bar">
              <div className="bulk-info">
                  <span className="count-badge">{selectedUsers.length}</span>
                  <span>محدد</span>
              </div>
              <div className="bulk-actions">
                  <button onClick={() => handleBulkAction('reset_device')} className="glass-btn">🔓 إلغاء قفل الأجهزة</button>
                  <button onClick={() => handleBulkAction('grant')} className="glass-btn">➕ صلاحيات</button>
                  {/* زر سحب المادة المفلترة */}
                  {selectedFilter && (
                      <button onClick={() => handleBulkAction('revoke_bulk')} className="glass-btn warning">
                          ❌ سحب ({selectedFilter.includes('course') ? 'الكورس' : 'المادة'} المفلترة)
                      </button>
                  )}
                  <button onClick={() => handleBulkAction('block')} className="glass-btn danger">⛔ حظر</button>
              </div>
          </div>
      )}

      {/* الجدول */}
      <div className="table-box">
          <table className="std-table">
              <thead>
                  <tr>
                      <th style={{width:'40px', textAlign:'center'}}><input type="checkbox" onChange={toggleSelectAll} checked={selectedUsers.length === currentTableData.length && currentTableData.length > 0} /></th>
                      <th style={{width:'80px'}}>ID</th>
                      <th style={{textAlign:'right'}}>الاسم</th>
                      <th style={{textAlign:'center'}}>المستخدم</th>
                      <th style={{textAlign:'center'}}>الهاتف</th>
                      <th style={{textAlign:'center'}}>التاريخ</th>
                      <th style={{textAlign:'center', width:'100px'}}>الحالة</th>
                  </tr>
              </thead>
              <tbody>
                  {currentTableData.map(std => (
                      <tr key={std.id} onClick={() => openUserProfile(std)} className="clickable">
                          <td onClick={e => e.stopPropagation()} style={{textAlign:'center'}}>
                              <input type="checkbox" checked={selectedUsers.includes(std.id)} onChange={() => toggleSelectUser(std.id)} />
                          </td>
                          <td style={{fontFamily:'monospace', color:'#94a3b8'}}>{std.id}</td>
                          <td style={{fontWeight:'600'}}>{std.first_name}</td>
                          <td style={{textAlign:'center', direction:'ltr', fontFamily:'monospace', color:'#38bdf8'}}>{std.username}</td>
                          <td style={{textAlign:'center', direction:'ltr', fontFamily:'monospace'}}>{std.phone}</td>
                          <td style={{textAlign:'center', fontSize:'0.85em', color:'#cbd5e1'}}>{formatDate(std.created_at)}</td>
                          <td style={{textAlign:'center'}}>
                              <div style={{display:'flex', justifyContent:'center', gap:'5px'}}>
                                {std.is_blocked ? <span className="status-dot red" title="محظور"></span> : <span className="status-dot green" title="نشط"></span>}
                                {std.device_linked && <span className="device-icon" title="جهاز مرتبط">📱</span>}
                              </div>
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
          <div className="pagination">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}>السابق</button>
              <span>{currentPage} / {totalPages}</span>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)}>التالي</button>
          </div>
      )}

      {/* --- 1. Profile Modal --- */}
      {viewUser && (
          <div className="modal-overlay" onClick={() => setViewUser(null)}>
              <div className="modal-box profile-modal" onClick={e => e.stopPropagation()}>
                  <div className="modal-head">
                      <div className="user-avatar-placeholder">{viewUser.first_name[0]}</div>
                      <div className="head-info">
                          <h3>{viewUser.first_name}</h3>
                          <span className="sub-text">ID: {viewUser.id}</span>
                      </div>
                      <button className="close-icon" onClick={() => setViewUser(null)}>✕</button>
                  </div>
                  
                  <div className="modal-content">
                      <div className="data-row">
                          <div className="data-item">
                              <label>اسم المستخدم</label>
                              <div className="val-box">{viewUser.username} <button onClick={handleUserChange}>✏️</button></div>
                          </div>
                          <div className="data-item">
                              <label>رقم الهاتف</label>
                              <div className="val-box ltr">{viewUser.phone} <button onClick={handlePhoneChange}>✏️</button></div>
                          </div>
                      </div>

                      <div className="actions-row">
                          <button onClick={() => showConfirm('إلغاء قفل الجهاز؟', () => runApiCall('reset_device', { userId: viewUser.id }))}>🔓 إلغاء قفل الجهاز</button>
                          <button onClick={handlePassChange}>🔑 تغيير الباسورد</button>
                          <button className={viewUser.is_blocked ? 'btn-green' : 'btn-red'} 
                                  onClick={() => showConfirm('تغيير حالة الحظر؟', () => runApiCall('toggle_block', { userId: viewUser.id, newData: { is_blocked: !viewUser.is_blocked } }, true))}>
                              {viewUser.is_blocked ? 'فك الحظر' : 'حظر الحساب'}
                          </button>
                      </div>

                      <div className="subs-wrapper">
                          <div className="subs-header">
                              <h4>الاشتراكات والصلاحيات</h4>
                              <button className="add-sub-btn" onClick={() => openGrantModal(viewUser)}>➕ إضافة</button>
                          </div>
                          
                          {loadingSubs ? <div className="loader-line"></div> : (
                              <div className="subs-grid">
                                  <div className="sub-column">
                                      <h5>📦 الكورسات الكاملة</h5>
                                      {userSubs.courses.length === 0 && <p className="empty-text">لا يوجد</p>}
                                      {userSubs.courses.map(c => (
                                          <div key={c.course_id} className="sub-chip">
                                              <span>{c.courses?.title}</span>
                                              <button onClick={() => showConfirm('سحب صلاحية الكورس؟', () => runApiCall('revoke_access', { userId: viewUser.id, courseId: c.course_id }))}>✕</button>
                                          </div>
                                      ))}
                                  </div>
                                  <div className="sub-column">
                                      <h5>📄 المواد الفردية</h5>
                                      {userSubs.subjects.length === 0 && <p className="empty-text">لا يوجد</p>}
                                      {userSubs.subjects.map(s => (
                                          <div key={s.subject_id} className="sub-chip">
                                              <span>{s.subjects?.title}</span>
                                              <button onClick={() => showConfirm('سحب صلاحية المادة؟', () => runApiCall('revoke_access', { userId: viewUser.id, subjectId: s.subject_id }))}>✕</button>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- 2. Grant Access Modal --- */}
      {showGrantModal && (
          <div className="modal-overlay" onClick={() => setShowGrantModal(false)}>
              <div className="modal-box grant-modal" onClick={e => e.stopPropagation()}>
                  <div className="modal-head">
                      <h3>➕ إضافة صلاحيات</h3>
                      <button className="close-icon" onClick={() => setShowGrantModal(false)}>✕</button>
                  </div>
                  <div className="modal-content scrollable">
                      {allCourses.map(course => (
                          <div key={course.id} className="course-group">
                              <div className="course-check-row">
                                  <label className="checkbox-container main">
                                      <input 
                                          type="checkbox" 
                                          checked={selectedGrantItems.courses.includes(course.id)}
                                          onChange={() => toggleGrantItem('courses', course.id)}
                                      />
                                      <span className="checkmark"></span>
                                      <span className="label-text">📦 {course.title} (كامل)</span>
                                  </label>
                              </div>
                              
                              {course.subjects && course.subjects.length > 0 && (
                                  <div className="subjects-grid">
                                      {course.subjects.map(subject => (
                                          <label key={subject.id} className="checkbox-container sub">
                                              <input 
                                                  type="checkbox" 
                                                  checked={selectedGrantItems.subjects.includes(subject.id)}
                                                  onChange={() => toggleGrantItem('subjects', subject.id)}
                                                  disabled={selectedGrantItems.courses.includes(course.id)} 
                                              />
                                              <span className="checkmark"></span>
                                              <span className="label-text">{subject.title}</span>
                                          </label>
                                      ))}
                                  </div>
                              )}
                          </div>
                      ))}
                  </div>
                  <div className="modal-footer">
                      <button className="cancel-btn" onClick={() => setShowGrantModal(false)}>إلغاء</button>
                      <button className="confirm-btn" onClick={submitGrant}>تأكيد وإضافة ✅</button>
                  </div>
              </div>
          </div>
      )}

      {/* --- 3. Custom Confirm Modal --- */}
      {confirmData.show && (
          <div className="modal-overlay alert-overlay" onClick={() => setConfirmData({...confirmData, show: false})}>
              <div className="alert-box" onClick={e => e.stopPropagation()}>
                  <h3>تأكيد الإجراء</h3>
                  <p>{confirmData.message}</p>
                  <div className="alert-actions">
                      <button className="cancel-btn" onClick={() => setConfirmData({...confirmData, show: false})}>إلغاء</button>
                      <button className="confirm-btn" onClick={() => { confirmData.onConfirm(); setConfirmData({...confirmData, show: false}); }}>نعم، متأكد</button>
                  </div>
              </div>
          </div>
      )}

      {/* --- 4. Custom Prompt Modal --- */}
      {promptData.show && (
          <div className="modal-overlay alert-overlay">
              <div className="alert-box" onClick={e => e.stopPropagation()}>
                  <h3>{promptData.title}</h3>
                  <input 
                    autoFocus
                    type="text" 
                    defaultValue={promptData.value} 
                    id="promptInput"
                    className="prompt-input"
                  />
                  <div className="alert-actions">
                      <button className="cancel-btn" onClick={() => setPromptData({...promptData, show: false})}>إلغاء</button>
                      <button className="confirm-btn" onClick={() => { 
                          const val = document.getElementById('promptInput').value;
                          promptData.onSubmit(val); 
                          setPromptData({...promptData, show: false}); 
                      }}>حفظ</button>
                  </div>
              </div>
          </div>
      )}

      <style jsx>{`
        /* --- Toast --- */
        .toast { position: fixed; top: 20px; right: 20px; padding: 15px 25px; border-radius: 8px; color: white; font-weight: bold; transform: translateX(150%); transition: transform 0.3s; z-index: 9999; box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
        .toast.show { transform: translateX(0); }
        .toast.success { background: #22c55e; }
        .toast.error { background: #ef4444; }

        /* --- General Layout --- */
        .controls-container { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; align-items: center; }
        .search-input { flex: 2; padding: 12px; border-radius: 8px; border: 1px solid #334155; background: #1e293b; color: white; min-width: 200px; }
        .filter-wrapper { flex: 1; min-width: 200px; position: relative; }
        .filter-select { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #334155; background: #1e293b; color: white; appearance: none; cursor: pointer; font-weight: 500; }
        .filter-select optgroup { color: #38bdf8; background: #0f172a; font-style: normal; font-weight: bold; }
        .filter-select option { color: white; background: #1e293b; padding: 10px; }
        .btn-refresh { background: #334155; color: #38bdf8; border: 1px solid #38bdf8; padding: 12px 15px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s; }
        .btn-refresh:hover { background: #38bdf8; color: #0f172a; }

        /* --- Bulk Glass Bar --- */
        .bulk-glass-bar {
            position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
            width: 95%; max-width: 850px;
            background: rgba(15, 23, 42, 0.85); /* لون داكن مع شفافية */
            backdrop-filter: blur(16px);
            border: 1px solid rgba(56, 189, 248, 0.3);
            padding: 12px 25px;
            border-radius: 50px;
            display: flex; justify-content: space-between; align-items: center;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            z-index: 50; animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideUp { from { transform: translate(-50%, 50px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        
        .bulk-info { display: flex; align-items: center; gap: 10px; color: #cbd5e1; font-weight: bold; }
        .count-badge { background: #38bdf8; color: #0f172a; padding: 2px 10px; border-radius: 20px; font-weight: 800; }
        .bulk-actions { display: flex; gap: 10px; }
        .glass-btn { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: white; padding: 8px 16px; border-radius: 20px; cursor: pointer; font-size: 0.9em; transition: 0.2s; font-weight: 500; }
        .glass-btn:hover { background: rgba(56, 189, 248, 0.2); border-color: #38bdf8; }
        .glass-btn.danger { background: rgba(239, 68, 68, 0.15); border-color: rgba(239, 68, 68, 0.4); color: #fca5a5; }
        .glass-btn.danger:hover { background: rgba(239, 68, 68, 0.3); border-color: #ef4444; }
        .glass-btn.warning { background: rgba(245, 158, 11, 0.15); border-color: rgba(245, 158, 11, 0.4); color: #fcd34d; }
        .glass-btn.warning:hover { background: rgba(245, 158, 11, 0.3); border-color: #f59e0b; }

        /* --- Custom Modals & Alerts --- */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 200; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(3px); }
        .alert-box { background: #1e293b; padding: 25px; border-radius: 16px; border: 1px solid #334155; width: 90%; max-width: 400px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); animation: popIn 0.2s; }
        .alert-box h3 { margin-top: 0; color: #38bdf8; margin-bottom: 10px; }
        .alert-box p { color: #cbd5e1; line-height: 1.5; margin-bottom: 20px; }
        .prompt-input { width: 100%; padding: 12px; background: #0f172a; border: 1px solid #475569; border-radius: 8px; color: white; margin-bottom: 20px; font-size: 16px; }
        .alert-actions { display: flex; gap: 10px; justify-content: flex-end; }
        
        .modal-box { background: #1e293b; width: 90%; max-height: 90vh; border-radius: 16px; border: 1px solid #475569; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 20px 50px rgba(0,0,0,0.5); animation: popIn 0.3s; }
        @keyframes popIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        
        .profile-modal { max-width: 600px; }
        .grant-modal { max-width: 700px; }
        
        .modal-head { background: #0f172a; padding: 20px; display: flex; align-items: center; gap: 15px; border-bottom: 1px solid #334155; }
        .user-avatar-placeholder { width: 50px; height: 50px; background: #38bdf8; color: #0f172a; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 1.5em; font-weight: bold; }
        .head-info h3 { margin: 0; font-size: 1.2em; color: white; }
        .sub-text { font-size: 0.85em; color: #94a3b8; }
        .close-icon { margin-right: auto; background: none; border: none; color: #cbd5e1; font-size: 20px; cursor: pointer; padding: 5px; }
        
        .modal-content { padding: 25px; overflow-y: auto; flex: 1; }
        .modal-footer { padding: 15px 25px; background: #0f172a; display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #334155; }

        /* --- Profile Modal Styles --- */
        .data-row { display: flex; gap: 20px; margin-bottom: 25px; }
        .data-item { flex: 1; }
        .data-item label { display: block; font-size: 0.85em; color: #94a3b8; margin-bottom: 5px; }
        .val-box { background: #0f172a; padding: 10px; border-radius: 6px; border: 1px solid #334155; color: white; display: flex; justify-content: space-between; align-items: center; }
        .val-box.ltr { direction: ltr; font-family: monospace; }
        .val-box button { background: none; border: none; cursor: pointer; color: #38bdf8; }

        .actions-row { display: flex; gap: 10px; margin-bottom: 30px; }
        .actions-row button { flex: 1; padding: 12px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; background: #334155; color: white; transition: 0.2s; }
        .actions-row button:hover { background: #475569; }
        .btn-red { background: #ef4444 !important; } .btn-red:hover { background: #dc2626 !important; }
        .btn-green { background: #22c55e !important; }

        .subs-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px dashed #475569; padding-bottom: 10px; }
        .add-sub-btn { background: #38bdf8; color: #0f172a; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.9em; }
        .subs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .sub-column h5 { margin: 0 0 10px 0; color: #94a3b8; font-size: 0.9em; }
        .sub-chip { background: #0f172a; border: 1px solid #334155; padding: 8px 12px; border-radius: 20px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 0.9em; }
        .sub-chip button { background: none; border: none; color: #ef4444; font-weight: bold; cursor: pointer; padding: 0 5px; }
        .empty-text { font-size: 0.8em; color: #64748b; font-style: italic; }

        /* --- Grant Modal Styles --- */
        .course-group { background: #0f172a; border-radius: 8px; border: 1px solid #334155; padding: 15px; margin-bottom: 15px; }
        .course-check-row { margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #1e293b; }
        .subjects-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }

        .checkbox-container { display: flex; align-items: center; cursor: pointer; position: relative; padding-right: 30px; user-select: none; }
        .checkbox-container input { position: absolute; opacity: 0; cursor: pointer; }
        .checkmark { position: absolute; top: 0; right: 0; height: 20px; width: 20px; background-color: #1e293b; border: 2px solid #475569; border-radius: 4px; }
        .checkbox-container:hover input ~ .checkmark { background-color: #334155; }
        .checkbox-container input:checked ~ .checkmark { background-color: #38bdf8; border-color: #38bdf8; }
        .checkmark:after { content: ""; position: absolute; display: none; }
        .checkbox-container input:checked ~ .checkmark:after { display: block; }
        .checkbox-container .checkmark:after { left: 6px; top: 2px; width: 5px; height: 10px; border: solid #0f172a; border-width: 0 2px 2px 0; transform: rotate(45deg); }
        .checkbox-container.main .label-text { font-weight: bold; color: #fff; }
        .checkbox-container.sub .label-text { font-size: 0.9em; color: #cbd5e1; }
        .checkbox-container input:disabled ~ .checkmark { background-color: #334155; border-color: #334155; opacity: 0.5; }
        .checkbox-container input:disabled ~ .label-text { color: #64748b; text-decoration: line-through; }

        .confirm-btn { background: #22c55e; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; }
        .cancel-btn { background: transparent; color: #cbd5e1; border: 1px solid #475569; padding: 10px 20px; border-radius: 6px; cursor: pointer; }

        /* --- Table Styling --- */
        .table-box { background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow-x: auto; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .std-table { width: 100%; border-collapse: collapse; min-width: 800px; }
        .std-table th { background: #0f172a; padding: 15px; text-align: right; color: #94a3b8; border-bottom: 1px solid #334155; font-size: 0.9em; white-space: nowrap; }
        .std-table td { padding: 15px; border-bottom: 1px solid #334155; color: #e2e8f0; vertical-align: middle; }
        .clickable { cursor: pointer; transition: background 0.1s; }
        .clickable:hover { background: rgba(56, 189, 248, 0.05); }
        .status-dot { height: 10px; width: 10px; border-radius: 50%; display: inline-block; }
        .status-dot.green { background: #22c55e; box-shadow: 0 0 5px #22c55e; }
        .status-dot.red { background: #ef4444; }
        .device-icon { font-size: 1.1em; cursor: help; }
        
        .pagination { display: flex; justify-content: center; gap: 20px; margin-top: 25px; padding-bottom: 50px; color: #cbd5e1; align-items: center; }
        .pagination button { padding: 8px 16px; background: #334155; color: white; border: none; border-radius: 6px; cursor: pointer; transition: 0.2s; }
        .pagination button:hover:not(:disabled) { background: #38bdf8; color: #0f172a; }
        .pagination button:disabled { opacity: 0.5; cursor: default; }
      `}</style>
    </AdminLayout>
  );
}
