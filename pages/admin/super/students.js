import SuperLayout from '../../../components/SuperLayout';
import { useState, useEffect } from 'react';

// أيقونة سهم احترافية (Chevron)
const ChevronIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

// أيقونة الطلاب للعنوان
const StudentsIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);

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
      setExpandedGrants({});
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
      if (grantTarget === 'bulk') return false; 
      if (!userSubs || !userSubs.courses) return false;

      if (type === 'course') {
          return userSubs.courses.some(c => c.course_id === id);
      }
      if (type === 'subject') {
          const subjectOwned = userSubs.subjects.some(s => s.subject_id === id);
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

      <div className="page-header">
        <div className="page-title">
          <div className="title-icon"><StudentsIcon /></div>
          <div>
            <h1>إدارة الطلاب</h1>
            <p>إدارة بيانات الطلاب، الاشتراكات، الفلترة، والصلاحيات.</p>
          </div>
        </div>
      </div>

      <div className="controls-container">
          <div className="search-wrapper">
             <span className="search-icon">🔍</span>
             <input 
                className="search-input" 
                placeholder="بحث بالاسم، رقم الهاتف، أو الـ ID ثم اضغط Enter..." 
                value={searchTerm} 
                onChange={e=>setSearchTerm(e.target.value)} 
                onKeyDown={handleSearchKey}
             />
          </div>
          
          <button className={`filter-btn ${hasActiveFilters ? 'active' : ''}`} onClick={() => { setTempFilters(activeFilters); setExpandedFilters({}); setShowFilterModal(true); }}>
              🌪️ فلترة
          </button>

          <button onClick={() => { setCurrentPage(1); fetchData(); }} className="btn-refresh" title="تحديث البيانات">🔄</button>
      </div>

      {selectedUsers.length > 0 && (
          <div className="bulk-glass-bar">
              <div className="bulk-info"><span className="count-badge">{selectedUsers.length}</span> <span>محدد</span></div>
              <div className="bulk-actions">
                  <button onClick={() => handleBulkAction('grant')} className="glass-btn">➕ منح صلاحية</button>
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
                        <th style={{textAlign:'center'}}>اسم المستخدم</th>
                        <th style={{textAlign:'center'}}>الهاتف</th>
                        <th style={{textAlign:'center'}}>الجهاز</th>
                        <th style={{textAlign:'center', width:'100px'}}>الحالة</th>
                    </tr>
                </thead>
                <tbody>
                    {students.map(std => (
                        <tr key={std.id} onClick={() => openUserProfile(std)} className="clickable">
                            <td onClick={e => e.stopPropagation()} style={{textAlign:'center'}}><input type="checkbox" checked={selectedUsers.includes(std.id)} onChange={() => toggleSelectUser(std.id)} /></td>
                            <td style={{fontFamily:'monospace', color:'var(--text-muted)'}}>{std.id}</td>
                            <td style={{fontWeight:'700', color:'var(--text-primary)'}}>
                                {std.first_name}
                                {['admin', 'moderator'].includes(std.role) && <span className="admin-tag">{std.role === 'admin' ? 'مدير' : 'مشرف'}</span>}
                            </td>
                            <td style={{textAlign:'center', direction:'ltr', fontFamily:'monospace', color:'var(--gold)'}}>@{std.username}</td>
                            <td style={{textAlign:'center', direction:'ltr', fontFamily:'monospace', color:'var(--text-secondary)'}}>{std.phone}</td>
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
                    {students.length === 0 && <tr><td colSpan="7" style={{textAlign:'center', padding:'40px', color:'var(--text-muted)'}}>لا يوجد نتائج</td></tr>}
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
                  <div className="modal-content scrollable custom-scrollbar">
                      {allCourses.map(course => (
                          <div key={course.id} className={`expandable-group ${expandedFilters[course.id] ? 'open' : ''}`}>
                              <div className="group-header">
                                  <button 
                                      className={`expand-btn ${expandedFilters[course.id] ? 'rotated' : ''}`} 
                                      onClick={() => toggleExpand(course.id, setExpandedFilters)}
                                  >
                                      <ChevronIcon />
                                  </button>
                                  
                                  <label className="checkbox-row main">
                                      <input 
                                          type="checkbox" 
                                          checked={tempFilters.courses.includes(String(course.id))} 
                                          onChange={() => toggleTempFilter('courses', String(course.id))} 
                                      />
                                      <span className="label-text">📦 {course.title}</span>
                                  </label>
                              </div>
                              
                              <div className={`group-body ${expandedFilters[course.id] ? 'show' : ''}`}>
                                  {course.subjects?.length > 0 ? course.subjects.map(subject => (
                                      <label key={subject.id} className="checkbox-row sub">
                                          <div className="tree-line"></div>
                                          <input 
                                              type="checkbox" 
                                              checked={tempFilters.subjects.includes(String(subject.id))} 
                                              onChange={() => toggleTempFilter('subjects', String(subject.id))} 
                                          />
                                          <span className="label-text">{subject.title}</span>
                                      </label>
                                  )) : <div className="empty-sub">لا توجد مواد</div>}
                              </div>
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

      {/* --- Profile Modal --- */}
      {viewUser && (
          <div className="modal-overlay" onClick={() => setViewUser(null)}>
              <div className="modal-box profile-modal" onClick={e => e.stopPropagation()}>
                  <div className="modal-head profile-head">
                      <div className="user-avatar-placeholder">{viewUser.first_name?.[0]}</div>
                      <div className="head-info">
                          <h3>{viewUser.first_name}</h3>
                          <span className="sub-text">تاريخ الانضمام: {formatDate(viewUser.created_at)}</span>
                      </div>
                      <div className="head-actions">
                          {!isEditing ? (
                              <button className="edit-btn-icon" onClick={() => setIsEditing(true)}>✏️ تعديل البيانات</button>
                          ) : (
                              <button className="edit-btn-icon cancel" onClick={() => setIsEditing(false)}>إلغاء التعديل</button>
                          )}
                          <button className="close-icon" onClick={() => setViewUser(null)}>✕</button>
                      </div>
                  </div>
                  
                  <div className="modal-content custom-scrollbar">
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
                                  <label>اسم المستخدم (للدخول)</label>
                                  {isEditing ? (
                                      <input className="input-field ltr" value={editFormData.username} onChange={e => setEditFormData({...editFormData, username: e.target.value})} />
                                  ) : (
                                      <div className="val-box ltr highlight-box">@{viewUser.username}</div>
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
                                          {viewUser.device_id ? <span style={{color:'#facc15', fontWeight:'bold'}}>📱 مرتبط بجهاز</span> : <span style={{color:'#4ade80', fontWeight:'bold'}}>⚪ غير مرتبط</span>}
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
                          <div className="subs-header">
                            <h4>الاشتراكات الحالية</h4>
                            <button className="add-sub-btn" onClick={() => openGrantModal(viewUser)}>➕ إضافة صلاحية</button>
                          </div>
                          {loadingSubs ? <div className="loader-line"></div> : (
                              <div className="subs-grid">
                                  <div className="sub-column">
                                      <h5>📦 الكورسات الكاملة</h5>
                                      {userSubs.courses.length > 0 ? userSubs.courses.map(c => (
                                          <div key={c.course_id} className="sub-chip">
                                              <span>{c.courses?.title}</span>
                                              <button onClick={() => showConfirm('تأكيد سحب الصلاحية؟', () => runApiCall('revoke_access', { userId: viewUser.id, courseId: c.course_id }))}>✕</button>
                                          </div>
                                      )) : <p className="empty-text">لا يوجد اشتراكات بكورسات</p>}
                                  </div>
                                  <div className="sub-column">
                                      <h5>📄 المواد الفردية</h5>
                                      {userSubs.subjects.length > 0 ? userSubs.subjects.map(s => (
                                          <div key={s.subject_id} className="sub-chip">
                                              <span>{s.subjects?.title}</span>
                                              <button onClick={() => showConfirm('تأكيد سحب الصلاحية؟', () => runApiCall('revoke_access', { userId: viewUser.id, subjectId: s.subject_id }))}>✕</button>
                                          </div>
                                      )) : <p className="empty-text">لا يوجد اشتراكات بمواد</p>}
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- Grant Modal --- */}
      {showGrantModal && (
          <div className="modal-overlay" onClick={() => setShowGrantModal(false)}>
              <div className="modal-box grant-modal" onClick={e => e.stopPropagation()}>
                  <div className="modal-head">
                    <h3>➕ منح صلاحيات {grantTarget === 'bulk' ? 'جماعية' : ''}</h3>
                    <button className="close-icon" onClick={() => setShowGrantModal(false)}>✕</button>
                  </div>
                  <div className="modal-content scrollable custom-scrollbar">
                      {allCourses.map(course => {
                          const courseOwned = isOwned('course', course.id);
                          const isOpen = expandedGrants[course.id];
                          
                          return (
                              <div key={course.id} className={`expandable-group ${isOpen ? 'open' : ''} ${courseOwned ? 'owned' : ''}`}>
                                  <div className="group-header">
                                      <button 
                                          className={`expand-btn ${isOpen ? 'rotated' : ''}`} 
                                          onClick={() => toggleExpand(course.id, setExpandedGrants)}
                                      >
                                          <ChevronIcon />
                                      </button>
                                      
                                      <label className="checkbox-row main">
                                          <input 
                                              type="checkbox" 
                                              checked={selectedGrantItems.courses.includes(course.id)} 
                                              onChange={() => toggleGrantItem('courses', course.id)} 
                                              disabled={courseOwned}
                                          />
                                          <span className="label-text">
                                              📦 {course.title} 
                                              {courseOwned && <span className="owned-badge">مملوك</span>}
                                          </span>
                                      </label>
                                  </div>
                                  
                                  <div className={`group-body ${isOpen ? 'show' : ''}`}>
                                      {course.subjects?.length > 0 ? course.subjects.map(subject => {
                                          const subjectOwned = isOwned('subject', subject.id) || selectedGrantItems.courses.includes(course.id);
                                          return (
                                              <label key={subject.id} className="checkbox-row sub">
                                                  <div className="tree-line"></div>
                                                  <input 
                                                      type="checkbox" 
                                                      checked={selectedGrantItems.subjects.includes(subject.id)} 
                                                      onChange={() => toggleGrantItem('subjects', subject.id)} 
                                                      disabled={subjectOwned || courseOwned} 
                                                  />
                                                  <span className="label-text">
                                                      {subject.title}
                                                      {isOwned('subject', subject.id) && <span className="check-icon">✔</span>}
                                                  </span>
                                              </label>
                                          );
                                      }) : <div className="empty-sub">لا توجد مواد داخلية</div>}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
                  <div className="modal-footer"><button className="cancel-btn" onClick={() => setShowGrantModal(false)}>إلغاء</button><button className="confirm-btn" onClick={submitGrant}>تأكيد المنح ✅</button></div>
              </div>
          </div>
      )}

      {/* --- Alerts --- */}
      {confirmData.show && (
          <div className="modal-overlay alert-overlay">
              <div className="modal-box alert-box">
                  <h3>⚠️ تأكيد الإجراء</h3>
                  <p>{confirmData.message}</p>
                  <div className="alert-actions">
                      <button className="cancel-btn" onClick={()=>setConfirmData({...confirmData, show:false})}>إلغاء</button>
                      <button className="confirm-btn red" onClick={()=>{confirmData.onConfirm(); setConfirmData({...confirmData,show:false})}}>نعم، متأكد</button>
                  </div>
              </div>
          </div>
      )}

      <style jsx>{`
        /* ================= Theme-Aware & Responsive Styling ================= */
        
        .toast { 
          position: fixed; top: 20px; right: 20px; padding: 15px 25px; border-radius: 8px; font-weight: bold; 
          transform: translateX(150%); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); z-index: 99999999; 
          box-shadow: var(--shadow); background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border); 
        }
        .toast.show { transform: translateX(0); } 
        .toast.success { border-right: 4px solid #22c55e; } 
        .toast.error { border-right: 4px solid #ef4444; }

        /* Page Header */
        .page-header { margin-bottom: 25px; border-bottom: 1px solid var(--border); padding-bottom: 20px; }
        .page-title { display: flex; align-items: center; gap: 15px; }
        .title-icon { color: var(--gold); display: flex; align-items: center; justify-content: center; background: var(--gold-dimmer); padding: 10px; border-radius: 12px; border: 1px solid var(--border-accent); }
        .page-title h1 { margin: 0 0 5px 0; color: var(--text-primary); font-size: 1.8rem; font-weight: 800; }
        .page-title p { margin: 0; color: var(--text-muted); font-size: 0.95rem; }

        /* Controls */
        .controls-container { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; align-items: center; }
        .search-wrapper { position: relative; flex: 2; min-width: 250px; }
        .search-icon { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); font-size: 1.1rem; opacity: 0.7; }
        .search-input { width: 100%; padding: 12px 12px 12px 40px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg-surface); color: var(--text-primary); font-size: 0.95rem; transition: 0.2s; outline: none; }
        .search-input:focus { border-color: var(--gold); box-shadow: 0 0 0 2px var(--gold-dim); }
        
        .btn-refresh { background: var(--bg-elevated); color: var(--gold); border: 1px solid var(--border-accent); padding: 12px; border-radius: 12px; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; }
        .btn-refresh:hover { background: var(--gold-dimmer); transform: rotate(15deg); }
        
        .filter-btn { background: var(--bg-elevated); color: var(--text-primary); border: 1px solid var(--border); padding: 12px 25px; border-radius: 12px; cursor: pointer; font-weight: 600; transition: 0.2s; white-space: nowrap; display: flex; align-items: center; gap: 8px; }
        .filter-btn:hover, .filter-btn.active { background: var(--gold); color: #111009; border-color: var(--gold-light); }

        /* Bulk Actions Bar */
        .bulk-glass-bar { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); width: 95%; max-width: 850px; background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(12px); border: 1px solid var(--gold); padding: 12px 25px; border-radius: 50px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.7); z-index: 50; animation: slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .bulk-info { display: flex; align-items: center; color: white; font-weight: 600; }
        .count-badge { background: var(--gold); color: #111009; padding: 2px 10px; border-radius: 20px; font-weight: 800; margin-left: 8px; font-size: 1.1rem; }
        .bulk-actions { display: flex; gap: 10px; }
        .glass-btn { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; padding: 8px 18px; border-radius: 20px; cursor: pointer; font-size: 0.9em; font-weight: bold; transition: 0.2s; }
        .glass-btn:hover { background: var(--gold-dim); border-color: var(--gold); color: var(--gold); }
        .glass-btn.danger { border-color: #ef4444; color: #fca5a5; } 
        .glass-btn.danger:hover { background: rgba(239, 68, 68, 0.2); border-color: #ef4444; color: #fecaca; }

        /* Main Table - Mobile Optimized */
        .table-box { background: var(--bg-surface); border-radius: 16px; border: 1px solid var(--border); overflow-x: auto; box-shadow: var(--shadow); -webkit-overflow-scrolling: touch; }
        .std-table { width: 100%; border-collapse: collapse; min-width: 850px; }
        .std-table th { background: var(--bg-elevated); padding: 16px 20px; color: var(--text-muted); border-bottom: 1px solid var(--border); white-space: nowrap; font-size: 0.9em; text-transform: uppercase; font-weight: 700; }
        .std-table td { padding: 16px 20px; border-bottom: 1px solid var(--border); color: var(--text-secondary); vertical-align: middle; }
        .std-table tr:last-child td { border-bottom: none; }
        .clickable:hover td { background: var(--bg-hover); cursor: pointer; }
        
        .admin-tag { background: var(--gold-dimmer); color: var(--gold); border: 1px solid var(--border-accent); padding: 2px 8px; border-radius: 6px; font-size: 0.75em; margin-right: 10px; font-weight: bold; }
        
        .status-badge { padding: 5px 12px; border-radius: 12px; font-size: 0.8rem; font-weight: bold; display: inline-block; }
        .status-badge.active { background: rgba(34, 197, 94, 0.1); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.2); }
        .status-badge.blocked { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
        
        .device-badge { padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 600; display: inline-block; border: 1px solid transparent; }
        .device-badge.used { background: rgba(56, 189, 248, 0.1); color: #38bdf8; border-color: rgba(56, 189, 248, 0.2); }
        .device-badge.free { color: var(--text-muted); background: var(--bg-elevated); border-color: var(--border); }

        input[type="checkbox"] { accent-color: var(--gold); width: 18px; height: 18px; cursor: pointer; }

        .pagination { display: flex; justify-content: center; flex-wrap: wrap; gap: 15px; margin-top: 25px; color: var(--text-muted); padding-bottom: 50px; align-items: center; font-weight: 500; }
        .pagination button { padding: 8px 18px; background: var(--bg-surface); border: 1px solid var(--border); color: var(--text-primary); border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s; }
        .pagination button:hover:not(:disabled) { background: var(--gold-dim); border-color: var(--gold); color: var(--gold); }
        .pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
        
        .loading-state { padding: 50px; text-align: center; color: var(--gold); font-weight: bold; font-size: 1.1rem; }

        /* General Modals - Mobile Optimized */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 200; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(5px); }
        .modal-box { background: var(--bg-surface); width: 90%; border-radius: 16px; border: 1px solid var(--border-accent); overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 30px 60px rgba(0,0,0,0.6); animation: popIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .profile-modal { max-width: 650px; max-height: 90vh; }
        .grant-modal, .filter-modal { max-width: 550px; max-height: 85vh; }
        .alert-box { max-width: 420px; padding: 30px; text-align: center; } 
        .alert-box h3 { margin: 0 0 15px 0; color: var(--gold); font-size: 1.4rem; }
        .alert-box p { color: var(--text-secondary); margin-bottom: 25px; font-size: 1rem; line-height: 1.5; }
        .alert-actions { display: flex; justify-content: center; gap: 12px; }

        .modal-head { background: var(--bg-elevated); padding: 20px 25px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); }
        .modal-head h3 { margin: 0; color: var(--gold); font-size: 1.25rem; }
        
        .profile-head { justify-content: flex-start; gap: 15px; }
        .head-info { flex: 1; }
        .head-info h3 { margin: 0; color: var(--text-primary); font-size: 1.3rem; }
        .sub-text { font-size: 0.85em; color: var(--text-muted); font-weight: 500; display: block; margin-top: 4px; }
        .head-actions { display: flex; align-items: center; gap: 12px; }
        
        .close-icon { background: none; border: none; color: var(--text-muted); font-size: 22px; cursor: pointer; padding: 6px; border-radius: 50%; transition: 0.2s; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; }
        .close-icon:hover { background: rgba(255,255,255,0.1); color: var(--text-primary); }
        
        .edit-btn-icon { background: var(--bg-surface); color: var(--gold); border: 1px solid var(--border-accent); padding: 8px 14px; border-radius: 8px; font-size: 0.85em; font-weight: bold; cursor: pointer; transition: 0.2s; }
        .edit-btn-icon:hover { background: var(--gold-dim); }
        .edit-btn-icon.cancel { background: transparent; border-color: var(--border); color: var(--text-muted); }
        .edit-btn-icon.cancel:hover { background: var(--bg-hover); color: var(--text-primary); }
        
        .modal-content { padding: 25px; overflow-y: auto; flex: 1; }
        .modal-footer { padding: 18px 25px; background: var(--bg-elevated); display: flex; justify-content: flex-end; gap: 12px; border-top: 1px solid var(--border); }

        /* Modern Expandable List Styles */
        .expandable-group { background: var(--bg-elevated); border-radius: 12px; margin-bottom: 10px; border: 1px solid var(--border); overflow: hidden; transition: 0.2s; }
        .expandable-group:hover { border-color: var(--border-accent); }
        .expandable-group.open { border-color: var(--gold); background: var(--bg-surface); box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .expandable-group.owned { opacity: 0.5; border-color: var(--border); pointer-events: none; }
        .expandable-group.owned .expand-btn { pointer-events: auto; }

        .group-header { display: flex; align-items: center; padding: 12px; background: transparent; cursor: pointer; }
        
        .expand-btn { background: rgba(255, 255, 255, 0.05); border: none; color: var(--text-muted); width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; border-radius: 8px; margin-left: 12px; transition: all 0.3s ease; cursor: pointer; }
        .expand-btn:hover { background: var(--gold-dimmer); color: var(--gold); }
        .expand-btn.rotated { transform: rotate(180deg); background: var(--gold-dim); color: var(--gold); }

        .group-body { max-height: 0; opacity: 0; overflow: hidden; background: var(--bg-hover); transition: all 0.3s ease; }
        .group-body.show { max-height: 800px; opacity: 1; padding: 5px 0 15px 0; border-top: 1px dashed var(--border); overflow-y: auto; }

        .checkbox-row { display: flex; align-items: center; cursor: pointer; position: relative; user-select: none; }
        .checkbox-row.main { flex: 1; gap: 12px; min-height: 44px; }
        .checkbox-row.sub { padding: 12px 15px 12px 0; margin-right: 28px; border-radius: 8px; transition: 0.2s; color: var(--text-secondary); min-height: 44px; }
        .checkbox-row.sub:hover { background: rgba(255, 255, 255, 0.04); color: var(--text-primary); }

        /* Tree Line Effect */
        .tree-line { position: absolute; right: -18px; top: -15px; bottom: 50%; width: 2px; background: var(--border); border-bottom-left-radius: 6px; }
        .checkbox-row.sub::before { content: ''; position: absolute; right: -18px; top: 50%; width: 14px; height: 2px; background: var(--border); }

        .label-text { font-size: 0.95rem; font-weight: 600; display: flex; align-items: center; }
        
        input:disabled + span { color: var(--text-muted); text-decoration: line-through; }
        
        .owned-badge { font-size: 0.7em; background: rgba(16, 185, 129, 0.1); color: #34d399; padding: 2px 8px; border-radius: 6px; margin-right: 10px; border: 1px solid rgba(16, 185, 129, 0.2); }
        .check-icon { color: #34d399; font-weight: bold; margin-right: 8px; }
        .empty-sub { padding: 15px; text-align: center; color: var(--text-muted); font-size: 0.85em; font-style: italic; }

        /* Profile Data Form */
        .user-avatar-placeholder { width: 56px; height: 56px; background: var(--gold-dim); color: var(--gold); border: 2px solid var(--border-accent); border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 1.6em; font-weight: bold; }
        .data-form { margin-bottom: 25px; }
        .data-row { display: flex; gap: 20px; margin-bottom: 18px; } 
        .data-item { flex: 1; }
        .data-item label { display: block; color: var(--text-muted); font-size: 0.85em; font-weight: 600; margin-bottom: 8px; }
        
        .val-box { background: var(--bg-elevated); padding: 12px 15px; border-radius: 10px; border: 1px solid var(--border); color: var(--text-primary); min-height: 46px; display: flex; align-items: center; font-weight: 500; font-size: 0.95rem; }
        .val-box.ltr { direction: ltr; font-family: monospace; }
        .highlight-box { color: var(--gold); border-color: var(--border-accent); background: var(--gold-dimmer); font-weight: bold; }
        
        .input-field { width: 100%; padding: 12px 15px; background: var(--bg-elevated); border: 1px solid var(--border); color: var(--text-primary); border-radius: 10px; outline: none; font-size: 0.95rem; transition: 0.2s; }
        .input-field:focus { border-color: var(--gold); box-shadow: 0 0 0 2px var(--gold-dim); }
        .input-field.ltr { direction: ltr; font-family: monospace; }
        
        .full-width { width: 100%; margin-top: 15px; }
        
        /* Profile Admin Actions */
        .admin-actions-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 25px 0; }
        .admin-btn { padding: 12px; border: none; border-radius: 10px; color: white; font-weight: bold; cursor: pointer; transition: 0.2s; font-size: 0.9em; display: flex; justify-content: center; align-items: center; gap: 6px; min-height: 44px; }
        .admin-btn:hover { transform: translateY(-2px); filter: brightness(1.1); box-shadow: 0 5px 15px rgba(0,0,0,0.2); }
        .admin-btn.yellow { background: #eab308; color: #422006; }
        .admin-btn.orange { background: #f97316; }
        .admin-btn.green { background: #22c55e; color: #064e3b; }
        .admin-btn.red { background: #ef4444; }
        
        .divider { border: 0; border-top: 1px dashed var(--border); margin: 25px 0; }
        
        /* Subscriptions Grid */
        .subs-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px; }
        .subs-header h4 { margin: 0; color: var(--text-primary); font-size: 1.1rem; }
        .add-sub-btn { background: var(--gold); color: #111009; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 0.9em; transition: 0.2s; }
        .add-sub-btn:hover { background: var(--gold-light); transform: translateY(-1px); box-shadow: 0 4px 10px var(--gold-dim); }
        
        .subs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .sub-column h5 { color: var(--text-muted); margin: 0 0 12px 0; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px; }
        .sub-chip { background: var(--bg-elevated); border: 1px solid var(--border); padding: 10px 14px; border-radius: 10px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 0.95em; color: var(--text-primary); font-weight: 500; transition: 0.2s; }
        .sub-chip:hover { border-color: var(--border-accent); }
        .sub-chip button { background: rgba(239, 68, 68, 0.1); border: 1px solid transparent; color: #ef4444; font-weight: bold; cursor: pointer; border-radius: 6px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
        .sub-chip button:hover { background: rgba(239, 68, 68, 0.2); border-color: #ef4444; }
        .empty-text { color: var(--text-muted); font-size: 0.9em; text-align: center; font-style: italic; background: var(--bg-hover); padding: 15px; border-radius: 10px; border: 1px dashed var(--border); }
        
        /* General Buttons */
        .confirm-btn { background: var(--gold); color: #111009; border: none; padding: 12px 22px; border-radius: 10px; cursor: pointer; font-weight: bold; font-size: 0.95rem; transition: 0.2s; min-height: 44px; display: flex; align-items: center; justify-content: center;}
        .confirm-btn:hover { background: var(--gold-light); transform: translateY(-2px); box-shadow: 0 5px 15px var(--gold-dim); }
        .confirm-btn.red { background: #ef4444; color: white; }
        .confirm-btn.red:hover { background: #dc2626; box-shadow: 0 5px 15px rgba(239, 68, 68, 0.3); }
        .cancel-btn { background: transparent; color: var(--text-secondary); border: 1px solid var(--border); padding: 12px 22px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 0.95rem; transition: 0.2s; min-height: 44px; display: flex; align-items: center; justify-content: center;}
        .cancel-btn:hover { background: var(--bg-hover); color: var(--text-primary); border-color: var(--text-muted); }
        .danger-text { color: #ef4444; border-color: rgba(239, 68, 68, 0.3); }
        .danger-text:hover { background: rgba(239, 68, 68, 0.1); border-color: #ef4444; color: #fca5a5; }

        @keyframes popIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes slideUp { from { transform: translate(-50%, 50px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        
        /* ================= Mobile Media Queries ================= */
        @media (max-width: 768px) {
            .page-title { flex-direction: column; text-align: center; }
            .page-title h1 { font-size: 1.5rem; }
            
            .controls-container { flex-direction: column; align-items: stretch; gap: 10px; }
            .search-wrapper { width: 100%; min-width: auto; }
            .filter-btn, .btn-refresh { width: 100%; justify-content: center; }
            
            .bulk-glass-bar { flex-direction: column; gap: 12px; border-radius: 20px; padding: 15px; bottom: 20px; width: 92%; }
            .bulk-actions { flex-wrap: wrap; justify-content: center; width: 100%; }
            .glass-btn { flex: 1; text-align: center; min-width: 120px; }
            
            .std-table th, .std-table td { padding: 12px 10px; font-size: 0.85rem; }
            
            .modal-box { width: 95%; max-height: 90dvh; }
            .modal-head.profile-head { flex-direction: column; text-align: center; padding: 15px; }
            .head-actions { width: 100%; justify-content: center; margin-top: 15px; flex-wrap: wrap; }
            
            .modal-content { padding: 15px; }
            .data-row { flex-direction: column; gap: 12px; margin-bottom: 12px; }
            
            .admin-actions-grid { grid-template-columns: 1fr; gap: 10px; }
            
            .subs-grid { grid-template-columns: 1fr; gap: 15px; }
            .subs-header { flex-direction: column; align-items: stretch; }
            .add-sub-btn { width: 100%; text-align: center; }
            
            .modal-footer { padding: 15px; flex-wrap: wrap; justify-content: stretch; flex-direction: column-reverse; gap: 10px; }
            .modal-footer button { width: 100%; flex: none; }
            
            /* Toast Fix */
            .toast { top: 10px; left: 10px; right: 10px; text-align: center; transform: translateY(-150%); }
            .toast.show { transform: translateY(0); }
        }
      `}</style>
    </SuperLayout>
  );
}
