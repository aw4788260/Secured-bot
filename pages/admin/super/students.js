import SuperLayout from '../../../components/SuperLayout';
import { useState, useEffect } from 'react';

export default function SuperStudentsPage() {
  const [students, setStudents] = useState([]);
  const [allCourses, setAllCourses] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0); 
  
  // البحث والفلترة
  const [searchTerm, setSearchTerm] = useState('');
  
  // --- نظام الفلترة (Modal) ---
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [activeFilters, setActiveFilters] = useState({ courses: [], subjects: [] });
  const [tempFilters, setTempFilters] = useState({ courses: [], subjects: [] });
  // حالة القوائم المنسدلة للفلتر
  const [expandedFilters, setExpandedFilters] = useState({});

  // التصفح (Pagination)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  const [selectedUsers, setSelectedUsers] = useState([]);

  // حالات النوافذ
  const [viewUser, setViewUser] = useState(null);
  const [userSubs, setUserSubs] = useState({ courses: [], subjects: [] });
  const [loadingSubs, setLoadingSubs] = useState(false);
  
  // حالة التعديل
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({});

  // للمنح
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantTarget, setGrantTarget] = useState(null); // 'bulk' OR user object
  const [selectedGrantItems, setSelectedGrantItems] = useState({ courses: [], subjects: [] });
  // حالة القوائم المنسدلة للمنح
  const [expandedGrants, setExpandedGrants] = useState({});

  const [confirmData, setConfirmData] = useState({ show: false, message: '', onConfirm: null });
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  // --- دوال المساعدة ---
  const showToast = (msg, type = 'success') => {
      setToast({ show: true, message: msg, type });
      setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };
  const showConfirm = (msg, callback) => setConfirmData({ show: true, message: msg, onConfirm: callback });
  
  const formatDate = (dateString) => {
      if (!dateString) return '-';
      return new Date(dateString).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const toggleExpand = (id, stateSetter) => {
      stateSetter(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // --- 1. جلب البيانات ---
  const fetchData = async () => {
    setLoading(true);
    try {
        // جلب كل الكورسات في النظام لأغراض الفلترة والمنح
        if (allCourses.length === 0) {
            const resCourses = await fetch('/api/dashboard/super/content?type=all'); 
            if (resCourses.ok) {
                const coursesData = await resCourses.json();
                setAllCourses(coursesData.courses || []);
            }
        }

        // بناء رابط الـ API مع الفلاتر
        let url = `/api/dashboard/super/students?page=${currentPage}&limit=${itemsPerPage}`;
        
        const params = new URLSearchParams();
        if (searchTerm) params.append('search', searchTerm);
        // إرسال الفلاتر بنفس صيغة الباك اند
        if (activeFilters.courses.length > 0) params.append('courses_filter', activeFilters.courses.join(','));
        if (activeFilters.subjects.length > 0) params.append('subjects_filter', activeFilters.subjects.join(','));
        
        if (params.toString()) url += `&${params.toString()}`;
        
        const res = await fetch(url);
        const data = await res.json();
        
        if (res.ok) {
            setStudents(data.students || []);
            setTotalStudents(data.total || 0);
            setSelectedUsers([]); 
        }
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  useEffect(() => { 
      fetchData(); 
  }, [currentPage, activeFilters]);

  const handleSearchKey = (e) => {
      if (e.key === 'Enter') {
          setCurrentPage(1);
          fetchData();
      }
  };

  // --- 2. ملف الطالب ---
  const openUserProfile = async (user) => {
      setViewUser(user);
      setIsEditing(false);
      setEditFormData({
          first_name: user.first_name,
          username: user.username,
          phone: user.phone,
          password: '' 
      });
      
      setLoadingSubs(true);
      try {
          const res = await fetch(`/api/dashboard/super/students?get_details_for_user=${user.id}`);
          const data = await res.json();
          // data يحتوي على: courses (المملوكة), subjects (المملوكة), available_courses, available_subjects
          setUserSubs(data);
      } catch (e) {}
      setLoadingSubs(false);
  };

  // --- 3. تنفيذ الإجراءات العامة (API) ---
  const runApiCall = async (action, payload, autoCloseProfile = false) => {
      try {
          const res = await fetch('/api/dashboard/super/students', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action, ...payload })
          });
          const resData = await res.json();
          if (res.ok) {
              showToast(resData.message, 'success');
              
              if (autoCloseProfile) {
                  setViewUser(null);
                  fetchData();
              } else {
                  if (viewUser) {
                      if (action === 'update_profile') {
                          setViewUser({ ...viewUser, ...payload.data });
                      }
                      // إعادة جلب الاشتراكات لتحديث القائمة
                      if (['grant_access', 'revoke_access'].includes(action)) {
                           const subRes = await fetch(`/api/dashboard/super/students?get_details_for_user=${viewUser.id}`);
                           const subData = await subRes.json();
                           setUserSubs(subData);
                      }
                  }
                  fetchData(); 
              }
          } else { showToast(resData.error || 'حدث خطأ', 'error'); }
      } catch (e) { showToast('خطأ في الاتصال', 'error'); }
  };

  // --- إجراءات الأدمن الخاصة ---
  const handleResetDevice = () => {
      showConfirm('هل أنت متأكد من تصفير بصمة الجهاز لهذا الطالب؟', () => {
          runApiCall('reset_device', { userId: viewUser.id });
      });
  };

  const handleToggleBlock = () => {
      const action = viewUser.is_blocked ? 'unblock_user' : 'block_user';
      const msg = viewUser.is_blocked ? 'فك الحظر عن هذا الطالب؟' : 'حظر هذا الطالب ومنعه من الدخول؟';
      showConfirm(msg, () => {
          runApiCall(action, { userId: viewUser.id }, true);
      });
  };

  const handleDeleteUser = () => {
      showConfirm('⚠️ تحذير: هل أنت متأكد تماماً من حذف هذا الحساب؟', () => {
          runApiCall('delete_user', { userId: viewUser.id }, true);
      });
  };

  const handleSaveChanges = () => {
      if (!editFormData.first_name || !editFormData.phone) return showToast('الاسم والهاتف مطلوبان', 'error');
      
      const payload = {
          userId: viewUser.id,
          data: {
              first_name: editFormData.first_name,
              phone: editFormData.phone,
              username: editFormData.username,
              ...(editFormData.password ? { password: editFormData.password } : {}) 
          }
      };
      runApiCall('update_profile', payload);
      setIsEditing(false);
  };

  // --- منطق المنح (Grant) ---
  const openGrantModal = (target) => {
      setGrantTarget(target);
      setSelectedGrantItems({ courses: [], subjects: [] });
      setExpandedGrants({}); // تصفير التوسيع
      setShowGrantModal(true);
  };

  const toggleGrantItem = (type, id) => {
      const list = selectedGrantItems[type];
      const newList = list.includes(id) ? list.filter(x => x !== id) : [...list, id];
      setSelectedGrantItems({ ...selectedGrantItems, [type]: newList });
  };

  const submitGrant = () => {
      if (!selectedGrantItems.courses.length && !selectedGrantItems.subjects.length) return showToast("اختر شيئاً واحداً على الأقل", 'error');
      const isBulk = grantTarget === 'bulk';
      runApiCall('grant_access', { userIds: isBulk ? selectedUsers : [grantTarget.id], grantList: selectedGrantItems }, false);
      setShowGrantModal(false);
  };

  // التحقق مما إذا كان العنصر مملوكاً بالفعل (للتعطيل في المودال)
  const isOwned = (type, id) => {
      if (grantTarget === 'bulk') return false; // في الجماعي لا نعطل شيئاً
      if (!userSubs || !userSubs.courses) return false;

      if (type === 'course') {
          return userSubs.courses.some(c => c.course_id === id);
      }
      if (type === 'subject') {
          // المادة مملوكة إذا كانت في قائمة المواد أو إذا كان الكورس الأب مملوكاً
          const subjectOwned = userSubs.subjects.some(s => s.subject_id === id);
          // نحتاج معرفة الكورس الأب للمادة، يمكن استخراجه من allCourses
          let parentCourseId = null;
          for (let c of allCourses) {
              if (c.subjects?.some(s => s.id === id)) {
                  parentCourseId = c.id;
                  break;
              }
          }
          const parentOwned = parentCourseId ? userSubs.courses.some(c => c.course_id === parentCourseId) : false;
          return subjectOwned || parentOwned;
      }
      return false;
  };

  // --- منطق الفلترة ---
  const toggleTempFilter = (type, id) => {
      const current = tempFilters[type];
      const updated = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
      setTempFilters({ ...tempFilters, [type]: updated });
  };
  const applyFilters = () => {
      setActiveFilters(tempFilters);
      setCurrentPage(1); 
      setShowFilterModal(false);
  };
  
  // العمليات الجماعية
  const toggleSelectAll = (e) => setSelectedUsers(e.target.checked ? students.map(u => u.id) : []);
  const toggleSelectUser = (id) => setSelectedUsers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  
  const handleBulkAction = (actionType) => {
      if (!selectedUsers.length) return;
      if (actionType === 'grant') openGrantModal('bulk');
      else if (actionType === 'delete') {
          showConfirm(`هل أنت متأكد من حذف ${selectedUsers.length} طلاب؟`, () => {
              runApiCall('delete_user_bulk', { userIds: selectedUsers }, true);
          });
      }
  };
  
  const totalPages = Math.ceil(totalStudents / itemsPerPage);
  const hasActiveFilters = activeFilters.courses.length > 0 || activeFilters.subjects.length > 0;

  return (
    <SuperLayout title="إدارة الطلاب">
      <div className={`toast ${toast.show ? 'show' : ''} ${toast.type}`}>{toast.message}</div>

      <div className="controls-container">
          <input 
            className="search-input" 
            placeholder="🔍 بحث (اسم، هاتف، ID) + Enter..." 
            value={searchTerm} 
            onChange={e=>setSearchTerm(e.target.value)} 
            onKeyDown={handleSearchKey}
          />
          
          <button className={`filter-btn ${hasActiveFilters ? 'active' : ''}`} onClick={() => { setTempFilters(activeFilters); setExpandedFilters({}); setShowFilterModal(true); }}>
              🌪️ فلترة
          </button>

          <button onClick={() => { setCurrentPage(1); fetchData(); }} className="btn-refresh">🔄</button>
      </div>

      {selectedUsers.length > 0 && (
          <div className="bulk-glass-bar">
              <div className="bulk-info"><span className="count-badge">{selectedUsers.length}</span> <span>محدد</span></div>
              <div className="bulk-actions">
                  <button onClick={() => handleBulkAction('grant')} className="glass-btn">➕ صلاحية</button>
                  <button onClick={() => handleBulkAction('delete')} className="glass-btn danger">🗑️ حذف الكل</button>
              </div>
          </div>
      )}

      <div className="table-box">
          {loading ? <div className="loading-state">جاري التحميل...</div> : (
            <table className="std-table">
                <thead>
                    <tr>
                        <th style={{width:'40px'}}><input type="checkbox" onChange={toggleSelectAll} checked={students.length > 0 && selectedUsers.length === students.length} /></th>
                        <th style={{width:'60px'}}>ID</th>
                        <th style={{textAlign:'right'}}>الاسم</th>
                        <th style={{textAlign:'center'}}>المستخدم</th>
                        <th style={{textAlign:'center'}}>الهاتف</th>
                        <th style={{textAlign:'center'}}>الجهاز</th>
                        <th style={{textAlign:'center', width:'100px'}}>الحالة</th>
                    </tr>
                </thead>
                <tbody>
                    {students.map(std => (
                        <tr key={std.id} onClick={() => openUserProfile(std)} className="clickable">
                            <td onClick={e => e.stopPropagation()} style={{textAlign:'center'}}><input type="checkbox" checked={selectedUsers.includes(std.id)} onChange={() => toggleSelectUser(std.id)} /></td>
                            <td style={{fontFamily:'monospace', color:'#94a3b8'}}>{std.id}</td>
                            <td style={{fontWeight:'600'}}>
                                {std.first_name}
                                {['admin', 'moderator'].includes(std.role) && <span className="admin-tag">{std.role === 'admin' ? 'مدير' : 'مشرف'}</span>}
                            </td>
                            <td style={{textAlign:'center', direction:'ltr', fontFamily:'monospace', color:'#38bdf8'}}>{std.username}</td>
                            <td style={{textAlign:'center', direction:'ltr', fontFamily:'monospace'}}>{std.phone}</td>
                            <td style={{textAlign:'center'}}>
                                {std.device_id ? <span title={std.device_id} className="device-badge used">📱 مرتبط</span> : <span className="device-badge free">⚪ فارغ</span>}
                            </td>
                            <td style={{textAlign:'center'}}>
                                {std.is_blocked ? 
                                    <span className="status-badge blocked">محظور</span> : 
                                    <span className="status-badge active">نشط</span>
                                }
                            </td>
                        </tr>
                    ))}
                    {students.length === 0 && <tr><td colSpan="7" style={{textAlign:'center', padding:'30px', color:'#94a3b8'}}>لا يوجد نتائج</td></tr>}
                </tbody>
            </table>
          )}
      </div>

      {totalPages > 1 && (
          <div className="pagination">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}>السابق</button>
              <span>{currentPage} / {totalPages} (الإجمالي: {totalStudents})</span>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)}>التالي</button>
          </div>
      )}

      {/* --- Filter Modal --- */}
      {showFilterModal && (
          <div className="modal-overlay" onClick={() => setShowFilterModal(false)}>
              <div className="modal-box filter-modal" onClick={e => e.stopPropagation()}>
                  <div className="modal-head">
                      <h3>🌪️ تصفية الطلاب</h3>
                      <button className="close-icon" onClick={() => setShowFilterModal(false)}>✕</button>
                  </div>
                  <div className="modal-content scrollable">
                      {allCourses.map(course => (
                          <div key={course.id} className="expandable-group">
                              <div className="group-header">
                                  <button className="expand-btn" onClick={() => toggleExpand(course.id, setExpandedFilters)}>
                                      {expandedFilters[course.id] ? '▼' : '◀'}
                                  </button>
                                  <label className="checkbox-row main">
                                      <input type="checkbox" checked={tempFilters.courses.includes(String(course.id))} onChange={() => toggleTempFilter('courses', String(course.id))} />
                                      <span>📦 {course.title}</span>
                                  </label>
                              </div>
                              
                              {/* القائمة المنسدلة للمواد */}
                              {expandedFilters[course.id] && (
                                  <div className="group-body fade-in">
                                      {course.subjects?.length > 0 ? course.subjects.map(subject => (
                                          <label key={subject.id} className="checkbox-row sub">
                                              <input type="checkbox" checked={tempFilters.subjects.includes(String(subject.id))} onChange={() => toggleTempFilter('subjects', String(subject.id))} />
                                              <span>📄 {subject.title}</span>
                                          </label>
                                      )) : <div className="empty-sub">لا توجد مواد</div>}
                                  </div>
                              )}
                          </div>
                      ))}
                  </div>
                  <div className="modal-footer" style={{justifyContent: 'space-between'}}>
                      <button className="cancel-btn danger-text" onClick={() => { setTempFilters({courses:[], subjects:[]}); setActiveFilters({courses:[], subjects:[]}); setCurrentPage(1); setShowFilterModal(false); }}>مسح الفلاتر</button>
                      <button className="confirm-btn" onClick={applyFilters}>عرض ({tempFilters.courses.length + tempFilters.subjects.length}) ✅</button>
                  </div>
              </div>
          </div>
      )}

      {/* --- Profile Modal (Edit & Actions) --- */}
      {viewUser && (
          <div className="modal-overlay" onClick={() => setViewUser(null)}>
              <div className="modal-box profile-modal" onClick={e => e.stopPropagation()}>
                  <div className="modal-head">
                      <div className="user-avatar-placeholder">{viewUser.first_name?.[0]}</div>
                      <div className="head-info">
                          <h3>{viewUser.first_name}</h3>
                          <span className="sub-text">انضم: {formatDate(viewUser.created_at)}</span>
                      </div>
                      <div className="head-actions">
                          {!isEditing ? (
                              <button className="edit-btn-icon" onClick={() => setIsEditing(true)}>✏️ تعديل</button>
                          ) : (
                              <button className="edit-btn-icon cancel" onClick={() => setIsEditing(false)}>إلغاء</button>
                          )}
                          <button className="close-icon" onClick={() => setViewUser(null)}>✕</button>
                      </div>
                  </div>
                  
                  <div className="modal-content">
                      <div className="data-form">
                          <div className="data-row">
                              <div className="data-item">
                                  <label>الاسم الكامل</label>
                                  {isEditing ? (
                                      <input className="input-field" value={editFormData.first_name} onChange={e => setEditFormData({...editFormData, first_name: e.target.value})} />
                                  ) : (
                                      <div className="val-box">{viewUser.first_name}</div>
                                  )}
                              </div>
                              <div className="data-item">
                                  <label>اسم المستخدم (Login)</label>
                                  {isEditing ? (
                                      <input className="input-field ltr" value={editFormData.username} onChange={e => setEditFormData({...editFormData, username: e.target.value})} />
                                  ) : (
                                      <div className="val-box ltr">{viewUser.username}</div>
                                  )}
                              </div>
                          </div>
                          
                          <div className="data-row">
                              <div className="data-item">
                                  <label>رقم الهاتف</label>
                                  {isEditing ? (
                                      <input className="input-field ltr" value={editFormData.phone} onChange={e => setEditFormData({...editFormData, phone: e.target.value})} />
                                  ) : (
                                      <div className="val-box ltr">{viewUser.phone}</div>
                                  )}
                              </div>
                              <div className="data-item">
                                  <label>{isEditing ? 'تغيير كلمة المرور' : 'حالة الجهاز'}</label>
                                  {isEditing ? (
                                      <input className="input-field ltr" type="password" placeholder="اتركها فارغة لعدم التغيير" value={editFormData.password} onChange={e => setEditFormData({...editFormData, password: e.target.value})} />
                                  ) : (
                                      <div className="val-box">
                                          {viewUser.device_id ? <span style={{color:'#facc15'}}>مرتبط بجهاز</span> : <span style={{color:'#4ade80'}}>غير مرتبط</span>}
                                      </div>
                                  )}
                              </div>
                          </div>

                          {isEditing && (
                              <div className="save-actions-row">
                                  <button className="confirm-btn full-width" onClick={handleSaveChanges}>حفظ التغييرات 💾</button>
                              </div>
                          )}
                      </div>

                      <hr className="divider" />

                      <div className="admin-actions-grid">
                          <button className="admin-btn yellow" onClick={handleResetDevice}>🔓 تصفير البصمة</button>
                          <button className={`admin-btn ${viewUser.is_blocked ? 'green' : 'orange'}`} onClick={handleToggleBlock}>
                             {viewUser.is_blocked ? '✅ فك الحظر' : '🚫 حظر الطالب'}
                          </button>
                          <button className="admin-btn red" onClick={handleDeleteUser}>🗑️ حذف الحساب</button>
                      </div>

                      <hr className="divider" />

                      <div className="subs-wrapper">
                          <div className="subs-header"><h4>الاشتراكات الحالية</h4><button className="add-sub-btn" onClick={() => openGrantModal(viewUser)}>➕ منح صلاحية</button></div>
                          {loadingSubs ? <div className="loader-line"></div> : (
                              <div className="subs-grid">
                                  <div className="sub-column">
                                      <h5>📦 الكورسات الكاملة</h5>
                                      {userSubs.courses.length > 0 ? userSubs.courses.map(c => (
                                          <div key={c.course_id} className="sub-chip">
                                              <span>{c.courses?.title}</span>
                                              <button onClick={() => showConfirm('سحب الصلاحية؟', () => runApiCall('revoke_access', { userId: viewUser.id, courseId: c.course_id }))}>✕</button>
                                          </div>
                                      )) : <p className="empty-text">لا يوجد</p>}
                                  </div>
                                  <div className="sub-column">
                                      <h5>📄 المواد الفردية</h5>
                                      {userSubs.subjects.length > 0 ? userSubs.subjects.map(s => (
                                          <div key={s.subject_id} className="sub-chip">
                                              <span>{s.subjects?.title}</span>
                                              <button onClick={() => showConfirm('سحب الصلاحية؟', () => runApiCall('revoke_access', { userId: viewUser.id, subjectId: s.subject_id }))}>✕</button>
                                          </div>
                                      )) : <p className="empty-text">لا يوجد</p>}
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- Grant Modal (Updated with Dropdowns) --- */}
      {showGrantModal && (
          <div className="modal-overlay" onClick={() => setShowGrantModal(false)}>
              <div className="modal-box grant-modal" onClick={e => e.stopPropagation()}>
                  <div className="modal-head"><h3>➕ إضافة صلاحيات {grantTarget === 'bulk' ? 'جماعية' : ''}</h3><button className="close-icon" onClick={() => setShowGrantModal(false)}>✕</button></div>
                  <div className="modal-content scrollable">
                      {allCourses.map(course => {
                          const courseOwned = isOwned('course', course.id);
                          return (
                              <div key={course.id} className={`expandable-group ${courseOwned ? 'owned' : ''}`}>
                                  <div className="group-header">
                                      <button className="expand-btn" onClick={() => toggleExpand(course.id, setExpandedGrants)}>
                                          {expandedGrants[course.id] ? '▼' : '◀'}
                                      </button>
                                      <label className="checkbox-row main">
                                          <input 
                                              type="checkbox" 
                                              checked={selectedGrantItems.courses.includes(course.id)} 
                                              onChange={() => toggleGrantItem('courses', course.id)} 
                                              disabled={courseOwned}
                                          />
                                          <span>📦 {course.title} {courseOwned && <span className="owned-tag">(مملوك)</span>}</span>
                                      </label>
                                  </div>
                                  
                                  {expandedGrants[course.id] && (
                                      <div className="group-body fade-in">
                                          {course.subjects?.length > 0 ? course.subjects.map(subject => {
                                              const subjectOwned = isOwned('subject', subject.id) || selectedGrantItems.courses.includes(course.id);
                                              return (
                                                  <label key={subject.id} className="checkbox-row sub">
                                                      <input 
                                                          type="checkbox" 
                                                          checked={selectedGrantItems.subjects.includes(subject.id)} 
                                                          onChange={() => toggleGrantItem('subjects', subject.id)} 
                                                          disabled={subjectOwned || courseOwned} 
                                                      />
                                                      <span>📄 {subject.title} {isOwned('subject', subject.id) && <span className="owned-tag-sm">✔</span>}</span>
                                                  </label>
                                              );
                                          }) : <div className="empty-sub">لا توجد مواد داخلية</div>}
                                      </div>
                                  )}
                              </div>
                          );
                      })}
                  </div>
                  <div className="modal-footer"><button className="cancel-btn" onClick={() => setShowGrantModal(false)}>إلغاء</button><button className="confirm-btn" onClick={submitGrant}>تأكيد ✅</button></div>
              </div>
          </div>
      )}

      {/* --- Alerts --- */}
      {confirmData.show && <div className="modal-overlay alert-overlay"><div className="alert-box"><h3>تأكيد</h3><p>{confirmData.message}</p><div className="alert-actions"><button className="cancel-btn" onClick={()=>setConfirmData({...confirmData, show:false})}>إلغاء</button><button className="confirm-btn red" onClick={()=>{confirmData.onConfirm(); setConfirmData({...confirmData,show:false})}}>نعم، تأكيد</button></div></div></div>}

      <style jsx>{`
        /* Global & Layout Styles */
        .toast { position: fixed; top: 20px; right: 20px; padding: 15px 25px; border-radius: 8px; color: white; font-weight: bold; transform: translateX(150%); transition: transform 0.3s; z-index: 99999999; box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
        .toast.show { transform: translateX(0); } .toast.success { background: #22c55e; } .toast.error { background: #ef4444; }

        .controls-container { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; align-items: center; }
        .search-input { flex: 2; padding: 12px; border-radius: 8px; border: 1px solid #334155; background: #1e293b; color: white; min-width: 200px; }
        .btn-refresh { background: #334155; color: #38bdf8; border: 1px solid #38bdf8; padding: 12px; border-radius: 8px; cursor: pointer; }
        .filter-btn { background: #1e293b; color: white; border: 1px solid #334155; padding: 12px 25px; border-radius: 8px; cursor: pointer; font-weight: 500; transition: 0.2s; white-space: nowrap; }
        .filter-btn:hover, .filter-btn.active { background: #38bdf8; color: #0f172a; border-color: #38bdf8; }

        .bulk-glass-bar { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); width: 95%; max-width: 850px; background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(12px); border: 1px solid #38bdf8; padding: 12px 25px; border-radius: 50px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6); z-index: 50; animation: slideUp 0.3s; }
        .count-badge { background: #38bdf8; color: #0f172a; padding: 2px 10px; border-radius: 20px; font-weight: 800; margin-left: 8px; }
        .bulk-actions { display: flex; gap: 8px; }
        .glass-btn { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; padding: 8px 16px; border-radius: 20px; cursor: pointer; font-size: 0.9em; transition: 0.2s; }
        .glass-btn:hover { background: rgba(56, 189, 248, 0.2); border-color: #38bdf8; }
        .glass-btn.danger { border-color: #ef4444; color: #fca5a5; } .glass-btn.danger:hover { background: rgba(239, 68, 68, 0.2); }

        .table-box { background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow-x: auto; }
        .std-table { width: 100%; border-collapse: collapse; min-width: 800px; }
        .std-table th { background: #0f172a; padding: 15px; color: #94a3b8; border-bottom: 1px solid #334155; white-space: nowrap; font-size: 0.9em; }
        .std-table td { padding: 15px; border-bottom: 1px solid #334155; color: #e2e8f0; vertical-align: middle; }
        .clickable:hover { background: rgba(56, 189, 248, 0.05); cursor: pointer; }
        
        .admin-tag { background: #f59e0b; color: #000; padding: 2px 6px; border-radius: 4px; font-size: 0.7em; margin-right: 8px; font-weight: bold; }
        .status-badge { padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: bold; }
        .status-badge.active { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
        .status-badge.blocked { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .device-badge { padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; }
        .device-badge.used { background: rgba(56, 189, 248, 0.1); color: #38bdf8; }
        .device-badge.free { color: #64748b; }

        .pagination { display: flex; justify-content: center; gap: 15px; margin-top: 25px; color: #94a3b8; padding-bottom: 50px; align-items: center; }
        .pagination button { padding: 8px 16px; background: #334155; color: white; border: none; border-radius: 6px; cursor: pointer; }
        .pagination button:disabled { opacity: 0.5; }
        .loading-state { padding: 40px; text-align: center; color: #38bdf8; font-weight: bold; }

        /* Modal Styles */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); z-index: 200; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(3px); }
        .modal-box { background: #1e293b; width: 90%; border-radius: 16px; border: 1px solid #475569; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 25px 50px rgba(0,0,0,0.5); animation: popIn 0.3s; }
        .profile-modal { max-width: 650px; max-height: 90vh; }
        .grant-modal, .filter-modal { max-width: 500px; max-height: 80vh; }
        .alert-box { max-width: 400px; padding: 25px; } 
        .alert-box h3 { margin-top:0; color: #38bdf8; }

        .modal-head { background: #0f172a; padding: 20px; display: flex; align-items: center; gap: 15px; border-bottom: 1px solid #334155; }
        .head-info h3 { margin: 0; color: white; } .sub-text { font-size: 0.85em; color: #94a3b8; font-weight: 500; }
        .close-icon { margin-right: auto; background: none; border: none; color: #cbd5e1; font-size: 20px; cursor: pointer; }
        .edit-btn-icon { background: #334155; color: #38bdf8; border: 1px solid #38bdf8; padding: 5px 10px; border-radius: 6px; font-size: 0.85em; cursor: pointer; margin-left: 10px; }
        .edit-btn-icon.cancel { background: transparent; border-color: #64748b; color: #94a3b8; }
        .modal-content { padding: 25px; overflow-y: auto; flex: 1; }
        .modal-footer { padding: 15px 25px; background: #0f172a; display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #334155; }

        /* Expandable List Styles (For Filter & Grant) */
        .expandable-group { background: #0f172a; border-radius: 8px; margin-bottom: 10px; border: 1px solid #334155; overflow: hidden; }
        .expandable-group.owned { opacity: 0.7; border-color: #1e293b; }
        .group-header { display: flex; align-items: center; padding: 8px 12px; background: #1e293b; }
        .expand-btn { background: none; border: none; color: #94a3b8; font-size: 14px; cursor: pointer; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 4px; margin-left: 8px; transition: 0.2s; }
        .expand-btn:hover { background: rgba(255,255,255,0.1); color: white; }
        
        .group-body { background: #0f172a; padding: 10px 10px 10px 40px; border-top: 1px solid #334155; }
        .checkbox-row { display: flex; align-items: center; gap: 10px; cursor: pointer; user-select: none; }
        .checkbox-row.main { font-weight: bold; color: white; flex: 1; }
        .checkbox-row.sub { margin-bottom: 8px; color: #cbd5e1; font-size: 0.9em; padding: 4px 0; }
        .checkbox-row input:disabled + span { color: #64748b; text-decoration: line-through; }
        
        .owned-tag { font-size: 0.7em; color: #10b981; background: rgba(16, 185, 129, 0.1); padding: 2px 6px; border-radius: 4px; margin-right: 8px; }
        .owned-tag-sm { color: #10b981; margin-right: 5px; font-weight: bold; }
        .empty-sub { font-size: 0.8em; color: #64748b; font-style: italic; }
        .fade-in { animation: fadeIn 0.2s ease-in; }

        /* Other Styles */
        .user-avatar-placeholder { width: 50px; height: 50px; background: #38bdf8; color: #0f172a; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 1.5em; font-weight: bold; }
        .data-form { margin-bottom: 20px; }
        .data-row { display: flex; gap: 20px; margin-bottom: 15px; } .data-item { flex: 1; }
        .data-item label { display: block; color: #94a3b8; font-size: 0.9em; margin-bottom: 5px; }
        .val-box { background: #0f172a; padding: 10px; border-radius: 6px; border: 1px solid #334155; color: white; min-height: 42px; display: flex; align-items: center; }
        .val-box.ltr { direction: ltr; font-family: monospace; }
        .input-field { width: 100%; padding: 10px; background: #0f172a; border: 1px solid #38bdf8; color: white; border-radius: 6px; outline: none; }
        .input-field.ltr { direction: ltr; font-family: monospace; }
        .full-width { width: 100%; margin-top: 10px; }
        .admin-actions-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 20px 0; }
        .admin-btn { padding: 12px; border: none; border-radius: 8px; color: white; font-weight: bold; cursor: pointer; transition: 0.2s; font-size: 0.9em; }
        .admin-btn:hover { opacity: 0.9; transform: translateY(-2px); }
        .admin-btn.yellow { background: #eab308; color: #422006; }
        .admin-btn.orange { background: #f97316; }
        .admin-btn.green { background: #22c55e; }
        .admin-btn.red { background: #ef4444; }
        .divider { border: 0; border-top: 1px solid #334155; margin: 20px 0; }
        .subs-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; }
        .add-sub-btn { background: #38bdf8; color: #0f172a; border: none; padding: 5px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.9em; }
        .subs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .sub-chip { background: #0f172a; border: 1px solid #334155; padding: 8px 12px; border-radius: 20px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 0.9em; }
        .sub-chip button { background: none; border: none; color: #ef4444; font-weight: bold; cursor: pointer; }
        .empty-text { color: #64748b; font-size: 0.9em; text-align: center; font-style: italic; }
        .confirm-btn { background: #22c55e; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; }
        .confirm-btn.red { background: #ef4444; }
        .cancel-btn { background: transparent; color: #cbd5e1; border: 1px solid #475569; padding: 10px 20px; border-radius: 6px; cursor: pointer; }
        .danger-text { color: #ef4444; border-color: #ef4444; }

        @keyframes popIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes slideUp { from { transform: translate(-50%, 50px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </SuperLayout>
  );
}
