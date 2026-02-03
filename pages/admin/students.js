import TeacherLayout from '../../components/TeacherLayout';
import { useState, useEffect } from 'react';

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [allCourses, setAllCourses] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0); 
  const [currentUserId, setCurrentUserId] = useState(null); 
  
  // حالة لمعرفة هل المستخدم الحالي هو الأدمن الرئيسي
  const [isMainAdmin, setIsMainAdmin] = useState(false);

  // البحث والفلترة
  const [searchTerm, setSearchTerm] = useState('');
  
  // --- نظام الفلترة (Modal) ---
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [activeFilters, setActiveFilters] = useState({ courses: [], subjects: [] });
  const [tempFilters, setTempFilters] = useState({ courses: [], subjects: [] });

  // التصفح (Pagination)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  const [selectedUsers, setSelectedUsers] = useState([]);

  // حالات النوافذ
  const [viewUser, setViewUser] = useState(null);
  const [userSubs, setUserSubs] = useState({ courses: [], subjects: [] });
  const [loadingSubs, setLoadingSubs] = useState(false);

  // [جديد] متغير لتخزين الكورسات والمواد المتاحة للمنح (التي لا يملكها الطالب)
  const [grantOptions, setGrantOptions] = useState({ courses: [], subjects: [] }); 

  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantTarget, setGrantTarget] = useState(null);
  const [selectedGrantItems, setSelectedGrantItems] = useState({ courses: [], subjects: [] });

  const [confirmData, setConfirmData] = useState({ show: false, message: '', onConfirm: null });
  const [promptData, setPromptData] = useState({ show: false, title: '', value: '', onSubmit: null });
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  // --- دوال المساعدة ---
  const showToast = (msg, type = 'success') => {
      setToast({ show: true, message: msg, type });
      setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };
  const showConfirm = (msg, callback) => setConfirmData({ show: true, message: msg, onConfirm: callback });
  const showPrompt = (title, initialVal, callback) => setPromptData({ show: true, title, value: initialVal || '', onSubmit: callback });
  const formatDate = (dateString) => {
      if (!dateString) return '-';
      return new Date(dateString).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // --- 1. جلب البيانات ---
  const fetchData = async () => {
    setLoading(true);
    try {
        // تحميل قائمة الكورسات للفلتر الرئيسي (كل كورسات المدرس)
        if (allCourses.length === 0) {
            const resCourses = await fetch('/api/dashboard/teacher/content');
            const coursesData = await resCourses.json();
            const coursesList = coursesData.courses || [];
            setAllCourses(coursesList);
        }

        let url = `/api/dashboard/teacher/students?page=${currentPage}&limit=${itemsPerPage}`;
        
        const params = new URLSearchParams();
        if (searchTerm) params.append('search', searchTerm);
        if (activeFilters.courses.length > 0) params.append('courses_filter', activeFilters.courses.join(','));
        if (activeFilters.subjects.length > 0) params.append('subjects_filter', activeFilters.subjects.join(','));
        
        if (params.toString()) url += `&${params.toString()}`;
        
        const res = await fetch(url);
        const data = await res.json();
        
        if (res.ok) {
            setStudents(data.students || []);
            setTotalStudents(data.total || 0);
            setIsMainAdmin(data.isMainAdmin || false);
            setSelectedUsers([]); 
        }
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  useEffect(() => { 
      setCurrentUserId(localStorage.getItem('admin_user_id'));
      window.scrollTo(0, 0);
      fetchData(); 
  }, [currentPage, activeFilters]);

  const handleSearchKey = (e) => {
      if (e.key === 'Enter') {
          setCurrentPage(1);
          fetchData();
      }
  };

  // --- منطق الفلتر ---
  const openFilterModal = () => { setTempFilters(activeFilters); setShowFilterModal(true); };
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
  const clearFilters = () => {
      setTempFilters({ courses: [], subjects: [] });
      setActiveFilters({ courses: [], subjects: [] });
      setCurrentPage(1);
      setShowFilterModal(false);
  };

  // --- 2. ملف الطالب ---
  const openUserProfile = async (user) => {
      setViewUser(user);
      setLoadingSubs(true);
      // تفريغ الخيارات القديمة
      setGrantOptions({ courses: [], subjects: [] });
      try {
          const res = await fetch(`/api/dashboard/teacher/students?get_details_for_user=${user.id}`);
          const data = await res.json();
          setUserSubs(data);
          
          // [تعديل] حفظ الخيارات المتاحة للمنح (المفلترة من الباك اند)
          setGrantOptions({
              courses: data.available_courses || [],
              subjects: data.available_subjects || []
          });

      } catch (e) {}
      setLoadingSubs(false);
  };

  // --- 3. تنفيذ الإجراءات ---
  const runApiCall = async (action, payload, autoCloseProfile = false) => {
      try {
          const res = await fetch('/api/dashboard/teacher/students', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action, ...payload })
          });
          const resData = await res.json();
          if (res.ok) {
              showToast(resData.message, 'success');
              if (autoCloseProfile) setViewUser(null);
              if (viewUser && ['grant_access','revoke_access','change_username','change_phone'].includes(action)) {
                  if (action === 'change_username') setViewUser({...viewUser, username: payload.newData.username});
                  if (action === 'change_phone') setViewUser({...viewUser, phone: payload.newData.phone});
                  openUserProfile(viewUser); // إعادة تحميل بيانات المستخدم لتحديث القوائم
                  fetchData();
              } else {
                  fetchData();
              }
          } else { showToast(resData.error, 'error'); }
      } catch (e) { showToast('خطأ في الاتصال', 'error'); }
  };

  const handlePassChange = () => showPrompt('كلمة المرور الجديدة:', '', (val) => val && runApiCall('change_password', { userId: viewUser.id, newData: { password: val } }));
  const handleUserChange = () => showPrompt('تغيير اسم المستخدم:', viewUser.username, (val) => val && runApiCall('change_username', { userId: viewUser.id, newData: { username: val } }));
  const handlePhoneChange = () => showPrompt('تغيير رقم الهاتف:', viewUser.phone, (val) => val && runApiCall('change_phone', { userId: viewUser.id, newData: { phone: val } }));

  // مودال المنح
  const openGrantModal = (target) => {
      setGrantTarget(target);
      setSelectedGrantItems({ courses: [], subjects: [] });
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

  // العمليات الجماعية
  const toggleSelectAll = (e) => setSelectedUsers(e.target.checked ? students.map(u => u.id) : []);
  const toggleSelectUser = (id) => setSelectedUsers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  
  const handleBulkAction = (actionType) => {
      if (!selectedUsers.length) return;
      if (actionType === 'grant') {
        // في حالة المنح الجماعي، نستخدم كل الكورسات لأننا لا نعرف تقاطع ما يملكونه
        // لذا سنملأ grantOptions بكل الكورسات مؤقتاً
        setGrantOptions({ courses: allCourses, subjects: [] }); // ملاحظة: المواد الفردية صعبة في الجماعي، يفضل الاكتفاء بالكورسات أو تركها فارغة ليختار من الكل
        openGrantModal('bulk');
      }
      else if (actionType === 'reset_device') showConfirm('إلغاء قفل الأجهزة للمحددين؟', () => runApiCall('reset_device', { userIds: selectedUsers }));
      
      else if (actionType === 'delete') {
          const safeUsers = selectedUsers.filter(id => String(id) !== String(currentUserId));
          if (safeUsers.length === 0) return showToast('لا يمكنك حذف حسابك الخاص!', 'error');
          showConfirm(`⚠️ تحذير: هل أنت متأكد من حذف ${safeUsers.length} حساب نهائياً؟`, () => runApiCall('delete_user', { userIds: safeUsers }));
      }
      
      else if (actionType === 'revoke_filtered') {
          if (!activeFilters.courses.length && !activeFilters.subjects.length) return showToast('يجب تفعيل فلتر أولاً لمعرفة ما سيتم سحبه', 'error');
          showConfirm('سحب الكورسات/المواد المفلترة من هؤلاء الطلاب؟', () => {
              activeFilters.courses.forEach(cid => runApiCall('revoke_access', { userIds: selectedUsers, courseId: cid }));
              activeFilters.subjects.forEach(sid => runApiCall('revoke_access', { userIds: selectedUsers, subjectId: sid }));
          });
      }
  };

  // دالة مساعدة للتحقق من إمكانية الحذف
  const canDeleteUser = (user) => {
      if (String(user.id) === String(currentUserId)) return false;
      // المدرس يستطيع حذف الطالب العادي، لكن لا يحذف المشرف
      if (!user.is_admin) return true; 
      return false; // المشرف محمي من الحذف عبر هذه الصفحة (يتم حذفه من صفحة الفريق)
  };
  
  const totalPages = Math.ceil(totalStudents / itemsPerPage);
  const hasActiveFilters = activeFilters.courses.length > 0 || activeFilters.subjects.length > 0;

  return (
    <TeacherLayout title="إدارة الطلاب">
      <div className={`toast ${toast.show ? 'show' : ''} ${toast.type}`}>{toast.message}</div>

      <div className="controls-container">
          <input 
            className="search-input" 
            placeholder="🔍 بحث (اسم، هاتف، ID) + Enter..." 
            value={searchTerm} 
            onChange={e=>setSearchTerm(e.target.value)} 
            onKeyDown={handleSearchKey}
          />
          
          <button className={`filter-btn ${hasActiveFilters ? 'active' : ''}`} onClick={openFilterModal}>
              🌪️ فلترة {hasActiveFilters && `(${activeFilters.courses.length + activeFilters.subjects.length})`}
          </button>

          <button onClick={() => { setCurrentPage(1); fetchData(); }} className="btn-refresh">🔄</button>
      </div>

      {selectedUsers.length > 0 && (
          <div className="bulk-glass-bar">
              <div className="bulk-info"><span className="count-badge">{selectedUsers.length}</span> <span>محدد</span></div>
              <div className="bulk-actions">
                  <button onClick={() => handleBulkAction('reset_device')} className="glass-btn">🔓 فك قفل</button>
                  <button onClick={() => handleBulkAction('grant')} className="glass-btn">➕ صلاحية</button>
                  {hasActiveFilters && <button onClick={() => handleBulkAction('revoke_filtered')} className="glass-btn warning">❌ سحب المفلتر</button>}
                  
                  <button onClick={() => handleBulkAction('delete')} className="glass-btn danger">🗑️ حذف نهائي</button>
              </div>
          </div>
      )}

      <div className="table-box">
          {loading ? <div className="loading-state">جاري التحميل...</div> : (
            <table className="std-table">
                <thead>
                    <tr>
                        <th style={{width:'40px'}}><input type="checkbox" onChange={toggleSelectAll} checked={students.length > 0 && selectedUsers.length === students.length} /></th>
                        <th style={{width:'80px'}}>ID</th>
                        <th style={{textAlign:'right'}}>الاسم</th>
                        <th style={{textAlign:'center'}}>المستخدم</th>
                        <th style={{textAlign:'center'}}>الهاتف</th>
                        <th style={{textAlign:'center'}}>التاريخ</th>
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
                                {std.is_admin && <span className="admin-tag">مشرف</span>}
                            </td>
                            <td style={{textAlign:'center', direction:'ltr', fontFamily:'monospace', color:'#38bdf8'}}>{std.username}</td>
                            <td style={{textAlign:'center', direction:'ltr', fontFamily:'monospace'}}>{std.phone}</td>
                            <td style={{textAlign:'center', fontSize:'0.85em', color:'#cbd5e1'}}>{formatDate(std.created_at)}</td>
                            <td style={{textAlign:'center'}}>
                                <div style={{display:'flex', justifyContent:'center', gap:'5px'}}>
                                    {std.is_blocked ? <span className="status-dot red"></span> : <span className="status-dot green"></span>}
                                    {std.device_linked && <span className="device-icon">📱</span>}
                                </div>
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
                          <div key={course.id} className="filter-group">
                              <label className="checkbox-row main">
                                  <input type="checkbox" checked={tempFilters.courses.includes(String(course.id))} onChange={() => toggleTempFilter('courses', String(course.id))} />
                                  <span>📦 {course.title}</span>
                              </label>
                              <div className="filter-subs">
                                  {course.subjects?.map(subject => (
                                      <label key={subject.id} className="checkbox-row sub">
                                          <input type="checkbox" checked={tempFilters.subjects.includes(String(subject.id))} onChange={() => toggleTempFilter('subjects', String(subject.id))} />
                                          <span>{subject.title}</span>
                                      </label>
                                  ))}
                              </div>
                          </div>
                      ))}
                  </div>
                  <div className="modal-footer" style={{justifyContent: 'space-between'}}>
                      <button className="cancel-btn danger-text" onClick={clearFilters}>مسح الفلاتر</button>
                      <button className="confirm-btn" onClick={applyFilters}>عرض ({tempFilters.courses.length + tempFilters.subjects.length}) ✅</button>
                  </div>
              </div>
          </div>
      )}

      {/* --- Profile Modal --- */}
      {viewUser && (
          <div className="modal-overlay" onClick={() => setViewUser(null)}>
              <div className="modal-box profile-modal" onClick={e => e.stopPropagation()}>
                  <div className="modal-head">
                      <div className="user-avatar-placeholder">{viewUser.first_name?.[0]}</div>
                      <div className="head-info">
                          <h3>{viewUser.first_name} {viewUser.is_admin && <span className="admin-tag-large">مشرف</span>}</h3>
                          <span className="sub-text">ID: {viewUser.id} &nbsp;|&nbsp; انضم: {formatDate(viewUser.created_at)}</span>
                      </div>
                      <button className="close-icon" onClick={() => setViewUser(null)}>✕</button>
                  </div>
                  <div className="modal-content">
                      <div className="data-row">
                          <div className="data-item"><label>اسم المستخدم</label><div className="val-box">{viewUser.username} <button onClick={handleUserChange}>✏️</button></div></div>
                          <div className="data-item"><label>رقم الهاتف</label><div className="val-box ltr">{viewUser.phone} <button onClick={handlePhoneChange}>✏️</button></div></div>
                      </div>
                      <div className="actions-row">
                          <button onClick={() => showConfirm('إلغاء قفل الجهاز؟', () => runApiCall('reset_device', { userId: viewUser.id }))}>🔓 إلغاء قفل الجهاز</button>
                          <button onClick={handlePassChange}>🔑 تغيير الباسورد</button>
                          
                          {canDeleteUser(viewUser) ? (
                              <button className="btn-red" onClick={() => showConfirm('⚠️ تحذير: سيتم حذف الحساب وجميع بياناته نهائياً. هل أنت متأكد؟', () => runApiCall('delete_user', { userId: viewUser.id }, true))}>🗑️ حذف نهائي</button>
                          ) : (
                              <button className="btn-disabled" disabled title="لا يمكن حذف المشرفين">🔒 حذف (محمي)</button>
                          )}
                      </div>
                      <div className="subs-wrapper">
                          <div className="subs-header"><h4>الاشتراكات والصلاحيات</h4><button className="add-sub-btn" onClick={() => openGrantModal(viewUser)}>➕ إضافة</button></div>
                          {loadingSubs ? <div className="loader-line"></div> : (
                              <div className="subs-grid">
                                  <div className="sub-column"><h5>📦 الكورسات الكاملة</h5>{userSubs.courses.map(c => (<div key={c.course_id} className="sub-chip"><span>{c.courses?.title}</span><button onClick={() => showConfirm('سحب؟', () => runApiCall('revoke_access', { userId: viewUser.id, courseId: c.course_id }))}>✕</button></div>))}</div>
                                  <div className="sub-column"><h5>📄 المواد الفردية</h5>{userSubs.subjects.map(s => (<div key={s.subject_id} className="sub-chip"><span>{s.subjects?.title}</span><button onClick={() => showConfirm('سحب؟', () => runApiCall('revoke_access', { userId: viewUser.id, subjectId: s.subject_id }))}>✕</button></div>))}</div>
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
                  <div className="modal-head"><h3>➕ إضافة صلاحيات</h3><button className="close-icon" onClick={() => setShowGrantModal(false)}>✕</button></div>
                  <div className="modal-content scrollable">
                      {/* [تعديل هام] هنا يتم استخدام grantOptions التي تم فلترتها، بدلاً من allCourses */}
                      {(grantTarget === 'bulk' ? allCourses : grantOptions.courses).map(course => (
                          <div key={course.id} className="course-group">
                              <label className="checkbox-row main"><input type="checkbox" checked={selectedGrantItems.courses.includes(course.id)} onChange={() => toggleGrantItem('courses', course.id)} /><span>📦 {course.title} (كامل)</span></label>
                              <div className="filter-subs">
                                    {/* عرض المواد فقط إذا كان الكورس نفسه معروضاً كمتاح للمواد، 
                                        أو إذا كان كورس جديد بالكامل ونحن نعرض مواده للاختيار الجزئي. 
                                        ولكن بما أن grantOptions.subjects تحتوي فقط المواد المتاحة (التي لا يملك الطالب الكورس الكامل لها)،
                                        فإننا نحتاج منطق عرض ذكي هنا.
                                    */}
                                    {/* الحل الأبسط والفعال: نعرض مواد الكورس ونفلترها بناءً على وجودها في grantOptions.subjects */}
                                    {course.subjects?.filter(s => 
                                        grantTarget === 'bulk' || // في حالة الجماعي نعرض كل شيء
                                        grantOptions.subjects.some(gs => gs.id === s.id) // في حالة الفردي نعرض المتاح فقط
                                    ).map(subject => (
                                        <label key={subject.id} className="checkbox-row sub">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedGrantItems.subjects.includes(subject.id)} 
                                                onChange={() => toggleGrantItem('subjects', subject.id)} 
                                                // تعطيل اختيار المادة إذا تم اختيار الكورس الكامل
                                                disabled={selectedGrantItems.courses.includes(course.id)} 
                                            />
                                            <span>{subject.title}</span>
                                        </label>
                                    ))}
                              </div>
                              {/* إذا كان الكورس موجوداً ولكن لا توجد مواد متاحة للعرض تحته (لأنه يملك بعضها)، 
                                  يمكننا إخفاء القائمة الفرعية أو تركها فارغة، الكود أعلاه سيتعامل مع ذلك تلقائياً */}
                          </div>
                      ))}
                      
                      {/* رسالة في حالة عدم وجود خيارات */}
                      {grantTarget !== 'bulk' && grantOptions.courses.length === 0 && grantOptions.subjects.length === 0 && (
                          <div style={{textAlign: 'center', padding: '20px', color: '#94a3b8'}}>
                              هذا الطالب يمتلك بالفعل جميع الكورسات والمواد المتاحة لك.
                          </div>
                      )}
                  </div>
                  <div className="modal-footer"><button className="cancel-btn" onClick={() => setShowGrantModal(false)}>إلغاء</button><button className="confirm-btn" onClick={submitGrant}>تأكيد ✅</button></div>
              </div>
          </div>
      )}

      {/* --- Alerts --- */}
      {confirmData.show && <div className="modal-overlay alert-overlay"><div className="alert-box"><h3>تأكيد</h3><p>{confirmData.message}</p><div className="alert-actions"><button className="cancel-btn" onClick={()=>setConfirmData({...confirmData, show:false})}>إلغاء</button><button className="confirm-btn red" onClick={()=>{confirmData.onConfirm(); setConfirmData({...confirmData,show:false})}}>نعم، احذف</button></div></div></div>}
      {promptData.show && <div className="modal-overlay alert-overlay"><div className="alert-box"><h3>{promptData.title}</h3><input autoFocus type="text" defaultValue={promptData.value} id="promptIn" className="prompt-input"/><div className="alert-actions"><button className="cancel-btn" onClick={()=>setPromptData({...promptData, show:false})}>إلغاء</button><button className="confirm-btn" onClick={()=>{promptData.onSubmit(document.getElementById('promptIn').value); setPromptData({...promptData,show:false})}}>حفظ</button></div></div></div>}

      <style jsx>{`
        /* Styles remain mostly the same, updated for new elements */
        .toast { position: fixed; top: 20px; right: 20px; padding: 15px 25px; border-radius: 8px; color: white; font-weight: bold; transform: translateX(150%); transition: transform 0.3s; z-index: 9999; box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
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
        .glass-btn.warning { border-color: #f59e0b; color: #fcd34d; } .glass-btn.warning:hover { background: rgba(245, 158, 11, 0.2); }

        .table-box { background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow-x: auto; }
        .std-table { width: 100%; border-collapse: collapse; min-width: 800px; }
        .std-table th { background: #0f172a; padding: 15px; color: #94a3b8; border-bottom: 1px solid #334155; white-space: nowrap; font-size: 0.9em; }
        .std-table td { padding: 15px; border-bottom: 1px solid #334155; color: #e2e8f0; vertical-align: middle; }
        .clickable:hover { background: rgba(56, 189, 248, 0.05); cursor: pointer; }
        .status-dot { height: 10px; width: 10px; border-radius: 50%; display: inline-block; }
        .status-dot.green { background: #22c55e; box-shadow: 0 0 5px #22c55e; } .status-dot.red { background: #ef4444; }
        .admin-tag { background: #f59e0b; color: #000; padding: 2px 6px; border-radius: 4px; font-size: 0.7em; margin-right: 8px; font-weight: bold; }
        .admin-tag-large { background: #f59e0b; color: #000; padding: 3px 8px; border-radius: 6px; font-size: 0.6em; margin-right: 8px; font-weight: bold; vertical-align: middle; }

        .pagination { display: flex; justify-content: center; gap: 15px; margin-top: 25px; color: #94a3b8; padding-bottom: 50px; align-items: center; }
        .pagination button { padding: 8px 16px; background: #334155; color: white; border: none; border-radius: 6px; cursor: pointer; }
        .pagination button:disabled { opacity: 0.5; }
        
        .loading-state { padding: 40px; text-align: center; color: #38bdf8; font-weight: bold; }

        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); z-index: 200; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(3px); }
        .modal-box { background: #1e293b; width: 90%; border-radius: 16px; border: 1px solid #475569; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 25px 50px rgba(0,0,0,0.5); animation: popIn 0.3s; }
        .profile-modal { max-width: 650px; max-height: 90vh; }
        .grant-modal { max-width: 700px; max-height: 80vh; }
        .filter-modal { max-width: 500px; max-height: 80vh; }
        .alert-box { max-width: 400px; padding: 25px; } 
        .alert-box h3 { margin-top:0; color: #38bdf8; }

        .modal-head { background: #0f172a; padding: 20px; display: flex; align-items: center; gap: 15px; border-bottom: 1px solid #334155; }
        .head-info h3 { margin: 0; color: white; } .sub-text { font-size: 0.85em; color: #94a3b8; font-weight: 500; }
        .close-icon { margin-right: auto; background: none; border: none; color: #cbd5e1; font-size: 20px; cursor: pointer; }
        
        .modal-content { padding: 25px; overflow-y: auto; flex: 1; }
        .modal-footer { padding: 15px 25px; background: #0f172a; display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #334155; }

        .filter-group, .course-group { margin-bottom: 15px; background: #0f172a; padding: 12px; border-radius: 8px; border: 1px solid #334155; }
        .checkbox-row { display: flex; align-items: center; gap: 10px; padding: 5px; cursor: pointer; }
        .checkbox-row input { width: 18px; height: 18px; accent-color: #38bdf8; }
        .checkbox-row.main { font-weight: bold; color: white; border-bottom: 1px solid #1e293b; padding-bottom: 8px; margin-bottom: 8px; }
        .checkbox-row.sub { margin-right: 20px; font-size: 0.95em; color: #cbd5e1; }
        .filter-subs { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 5px; }

        .user-avatar-placeholder { width: 50px; height: 50px; background: #38bdf8; color: #0f172a; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 1.5em; font-weight: bold; }
        .data-row { display: flex; gap: 20px; margin-bottom: 25px; } .data-item { flex: 1; }
        .val-box { background: #0f172a; padding: 10px; border-radius: 6px; border: 1px solid #334155; color: white; display: flex; justify-content: space-between; }
        .val-box.ltr { direction: ltr; font-family: monospace; }
        .val-box button { background: none; border: none; cursor: pointer; color: #38bdf8; }
        .actions-row { display: flex; gap: 10px; margin-bottom: 30px; }
        .actions-row button { flex: 1; padding: 12px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; background: #334155; color: white; transition: 0.2s; }
        .actions-row button:hover { background: #475569; }
        .btn-red { background: #ef4444 !important; } .btn-green { background: #22c55e !important; }
        .btn-disabled { background: #334155 !important; color: #64748b !important; cursor: not-allowed !important; opacity: 0.7; }
        
        .subs-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px dashed #475569; padding-bottom: 10px; }
        .add-sub-btn { background: #38bdf8; color: #0f172a; border: none; padding: 5px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.9em; }
        .subs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .sub-chip { background: #0f172a; border: 1px solid #334155; padding: 8px 12px; border-radius: 20px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 0.9em; }
        .sub-chip button { background: none; border: none; color: #ef4444; font-weight: bold; cursor: pointer; }

        .confirm-btn { background: #22c55e; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; }
        .confirm-btn.red { background: #ef4444; }
        .cancel-btn { background: transparent; color: #cbd5e1; border: 1px solid #475569; padding: 10px 20px; border-radius: 6px; cursor: pointer; }
        .danger-text { color: #ef4444; border-color: #ef4444; }
        .prompt-input { width: 100%; padding: 12px; background: #0f172a; border: 1px solid #475569; border-radius: 8px; color: white; font-size: 16px; margin-bottom: 20px; }
        
        @keyframes popIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes slideUp { from { transform: translate(-50%, 50px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
      `}</style>
    </TeacherLayout>
  );
}
