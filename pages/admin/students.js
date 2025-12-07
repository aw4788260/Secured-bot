import AdminLayout from '../../components/AdminLayout';
import { useState, useEffect } from 'react';

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [filterOptions, setFilterOptions] = useState([]); // قائمة الكورسات والمواد للفلتر
  const [loading, setLoading] = useState(true);
  
  // البحث والفلترة
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState(''); // الصيغة: "type_id"

  // التصفح (Pagination)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  // التحديد الجماعي
  const [selectedUsers, setSelectedUsers] = useState([]);

  // ملف الطالب (Modal)
  const [viewUser, setViewUser] = useState(null);
  const [userSubs, setUserSubs] = useState({ courses: [], subjects: [] });
  const [loadingSubs, setLoadingSubs] = useState(false);

  // --- 1. جلب البيانات الأولية ---
  const fetchData = async () => {
    setLoading(true);
    try {
        // جلب خيارات الفلتر (كورسات ومواد)
        if (filterOptions.length === 0) {
            const resCourses = await fetch('/api/public/get-courses');
            const coursesData = await resCourses.json();
            
            let options = [];
            coursesData.forEach(c => {
                options.push({ type: 'course', id: c.id, label: `📦 كورس: ${c.title}` });
                if (c.subjects) {
                    c.subjects.forEach(s => {
                        options.push({ type: 'subject', id: s.id, label: `📄 مادة: ${s.title}` });
                    });
                }
            });
            setFilterOptions(options);
        }

        // إعداد رابط الجلب مع الفلتر
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

  // --- 3. تنفيذ الإجراءات ---
  const executeAction = async (action, payload, autoClose = false) => {
      if (!confirm('هل أنت متأكد من تنفيذ هذا الإجراء؟')) return;
      try {
          const res = await fetch('/api/admin/students', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action, ...payload })
          });
          const resData = await res.json();
          if (res.ok) {
              alert(resData.message);
              if (autoClose) closeUserProfile();
              // إذا كان الإجراء "سحب/منح" داخل المودال، نعيد تحميل بيانات المودال فقط
              if ((action === 'grant_access' || action === 'revoke_access') && viewUser) {
                  openUserProfile(viewUser); 
              } else {
                  fetchData();
              }
          } else { alert('خطأ: ' + resData.error); }
      } catch (e) { alert('خطأ اتصال'); }
  };

  // --- دوال المودال ---
  const handlePassChange = () => {
      const p = prompt('أدخل كلمة المرور الجديدة (سيتم تشفيرها):');
      if (p) executeAction('change_password', { userId: viewUser.id, newData: { password: p } });
  };
  const handleUserChange = () => {
      const u = prompt('اسم المستخدم الجديد:', viewUser.username);
      if (u) executeAction('change_username', { userId: viewUser.id, newData: { username: u } });
  };
  const handleGrant = () => {
      // نافذة بسيطة لاختيار ما نريد إضافته
      const input = prompt('لإضافة كورس أدخل: c_ID (مثال c_5)\nلإضافة مادة أدخل: s_ID (مثال s_10)');
      if (!input) return;
      
      const [type, id] = input.split('_');
      if (type === 'c') executeAction('grant_access', { userId: viewUser.id, courseId: id });
      else if (type === 's') executeAction('grant_access', { userId: viewUser.id, subjectId: id });
      else alert('صيغة خاطئة');
  };

  // --- 4. العمليات الجماعية ---
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
      
      if (actionType === 'grant_bulk') {
          const input = prompt('أدخل ID العنصر لمنحه للجميع:\nللكورس: c_ID\nللمادة: s_ID');
          if (!input) return;
          const [type, id] = input.split('_');
          if (type === 'c') executeAction('grant_access', { userIds: selectedUsers, courseId: id });
          else if (type === 's') executeAction('grant_access', { userIds: selectedUsers, subjectId: id });
      }
      else if (actionType === 'revoke_bulk') {
          // خاصية ممتازة: سحب الصلاحية التي تم الفلترة بناء عليها
          if (!selectedFilter) return alert('يجب فلترة الطلاب أولاً لمعرفة ماذا تسحب منهم.');
          const [type, id] = selectedFilter.split('_');
          executeAction('revoke_access', { 
              userIds: selectedUsers, 
              [type === 'course' ? 'courseId' : 'subjectId']: id 
          });
      }
      else if (actionType === 'reset_device') executeAction('reset_device', { userIds: selectedUsers });
      else if (actionType === 'block') executeAction('toggle_block', { userIds: selectedUsers, newData: { is_blocked: true } });
  };

  // --- 5. العرض ---
  const filteredStudents = students.filter(s => 
    s.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.phone?.includes(searchTerm)
  );

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const currentTableData = filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <AdminLayout title="إدارة الطلاب">
      {/* التحكمات */}
      <div className="controls-container">
          <input className="search-input" placeholder="🔍 بحث..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
          
          <select className="filter-select" onChange={e => setSelectedFilter(e.target.value)} value={selectedFilter}>
              <option value="">📂 عرض الكل</option>
              {filterOptions.map(opt => (
                  <option key={`${opt.type}_${opt.id}`} value={`${opt.type}_${opt.id}`}>{opt.label}</option>
              ))}
          </select>

          <button onClick={fetchData} className="btn-refresh">🔄 تحديث</button>
      </div>

      {/* شريط العمليات الجماعية */}
      {selectedUsers.length > 0 && (
          <div className="bulk-bar">
              <span>{selectedUsers.length} طالب محدد</span>
              <div className="bulk-btns">
                  <button onClick={() => handleBulkAction('reset_device')}>🔄 تصفير الأجهزة</button>
                  <button onClick={() => handleBulkAction('grant_bulk')}>➕ منح صلاحية</button>
                  {selectedFilter && <button onClick={() => handleBulkAction('revoke_bulk')} className="btn-danger">❌ سحب (المحدد بالفلتر)</button>}
                  <button onClick={() => handleBulkAction('block')} className="btn-danger">⛔ حظر</button>
              </div>
          </div>
      )}

      {/* الجدول */}
      <div className="table-box">
          <table className="std-table">
              <thead>
                  <tr>
                      <th style={{width:'40px'}}><input type="checkbox" onChange={toggleSelectAll} checked={selectedUsers.length === currentTableData.length && currentTableData.length > 0} /></th>
                      <th>الاسم</th>
                      <th>User</th>
                      <th>الهاتف</th>
                      <th>الحالة</th>
                  </tr>
              </thead>
              <tbody>
                  {currentTableData.map(std => (
                      <tr key={std.id} onClick={() => openUserProfile(std)} className="clickable">
                          <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedUsers.includes(std.id)} onChange={() => toggleSelectUser(std.id)} /></td>
                          <td>{std.first_name}</td>
                          <td>{std.username}</td>
                          <td dir="ltr">{std.phone}</td>
                          <td>
                              {std.is_blocked ? <span className="badge red">⛔</span> : <span className="badge green">✅</span>}
                              {std.device_linked && <span className="badge blue">📱</span>}
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

      {/* --- Profile Modal --- */}
      {viewUser && (
          <div className="modal-overlay" onClick={closeUserProfile}>
              <div className="modal-box" onClick={e => e.stopPropagation()}>
                  <div className="modal-head">
                      <h3>👤 {viewUser.first_name}</h3>
                      <button onClick={closeUserProfile}>✕</button>
                  </div>
                  <div className="modal-content">
                      <div className="info-grid">
                          <div><strong>ID:</strong> {viewUser.id}</div>
                          <div><strong>User:</strong> {viewUser.username} <span onClick={handleUserChange} style={{cursor:'pointer'}}>✏️</span></div>
                          <div><strong>Phone:</strong> {viewUser.phone}</div>
                          <div><strong>Date:</strong> {new Date(viewUser.created_at).toLocaleDateString()}</div>
                      </div>
                      
                      <div className="actions-grid">
                          <button onClick={() => executeAction('reset_device', { userId: viewUser.id })}>🔄 تصفير الجهاز</button>
                          <button onClick={handlePassChange}>🔑 تغيير الباسورد</button>
                          <button className={viewUser.is_blocked ? 'btn-green' : 'btn-red'} 
                                  onClick={() => executeAction('toggle_block', { userId: viewUser.id, newData: { is_blocked: !viewUser.is_blocked } }, true)}>
                              {viewUser.is_blocked ? 'فك الحظر' : 'حظر'}
                          </button>
                      </div>

                      <div className="subs-container">
                          <h4>الصلاحيات والاشتراكات <button className="mini-add" onClick={handleGrant}>+</button></h4>
                          {loadingSubs ? <p>جاري التحميل...</p> : (
                              <div className="subs-lists">
                                  <div>
                                      <h5>📦 كورسات كاملة:</h5>
                                      {userSubs.courses.map(c => (
                                          <div key={c.course_id} className="sub-item">
                                              {c.courses?.title}
                                              <span onClick={() => executeAction('revoke_access', { userId: viewUser.id, courseId: c.course_id })}>❌</span>
                                          </div>
                                      ))}
                                  </div>
                                  <div>
                                      <h5>📄 مواد محددة:</h5>
                                      {userSubs.subjects.map(s => (
                                          <div key={s.subject_id} className="sub-item">
                                              {s.subjects?.title}
                                              <span onClick={() => executeAction('revoke_access', { userId: viewUser.id, subjectId: s.subject_id })}>❌</span>
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

      <style jsx>{`
        .controls-container { display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap; }
        .search-input, .filter-select { padding: 10px; border-radius: 6px; border: 1px solid #334155; background: #1e293b; color: white; flex: 1; min-width: 200px; }
        .btn-refresh { background: #334155; color: #38bdf8; border: 1px solid #38bdf8; padding: 0 20px; border-radius: 6px; cursor: pointer; }
        
        .bulk-bar { background: #38bdf8; color: #0f172a; padding: 10px 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .bulk-btns button { margin-left: 8px; padding: 5px 10px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; background: white; color: #0f172a; }
        .bulk-btns .btn-danger { background: #ef4444; color: white; }

        .table-box { background: #1e293b; border-radius: 8px; border: 1px solid #334155; overflow-x: auto; }
        .std-table { width: 100%; border-collapse: collapse; min-width: 600px; }
        .std-table th { background: #0f172a; padding: 12px; text-align: right; color: #94a3b8; border-bottom: 1px solid #334155; }
        .std-table td { padding: 12px; border-bottom: 1px solid #334155; color: #e2e8f0; }
        .clickable:hover { background: rgba(255,255,255,0.03); cursor: pointer; }
        .badge { margin-left: 5px; font-size: 0.9em; }

        .pagination { display: flex; justify-content: center; gap: 15px; margin-top: 20px; color: #94a3b8; }
        .pagination button { padding: 5px 15px; background: #334155; color: white; border: none; borderRadius: 4px; cursor: pointer; }
        .pagination button:disabled { opacity: 0.5; }

        /* Modal Styles */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); z-index: 200; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(2px); }
        .modal-box { background: #1e293b; width: 90%; max-width: 600px; border-radius: 12px; border: 1px solid #334155; overflow: hidden; }
        .modal-head { background: #0f172a; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; }
        .modal-head h3 { margin: 0; color: #38bdf8; }
        .modal-head button { background: none; border: none; color: #ef4444; font-size: 20px; cursor: pointer; }
        .modal-content { padding: 20px; }
        
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; color: #cbd5e1; }
        .actions-grid { display: flex; gap: 10px; margin-bottom: 20px; }
        .actions-grid button { flex: 1; padding: 10px; border: none; borderRadius: 6px; cursor: pointer; background: #334155; color: white; font-weight: bold; }
        .actions-grid .btn-red { background: #ef4444; } .actions-grid .btn-green { background: #22c55e; }

        .subs-container h4 { border-bottom: 1px solid #334155; padding-bottom: 5px; margin-bottom: 10px; display: flex; justify-content: space-between; }
        .mini-add { background: #38bdf8; border: none; width: 24px; height: 24px; borderRadius: 50%; cursor: pointer; color: black; font-weight: bold; }
        .subs-lists { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .subs-lists h5 { color: #94a3b8; margin: 0 0 10px 0; }
        .sub-item { background: #0f172a; padding: 8px; margin-bottom: 5px; borderRadius: 4px; display: flex; justify-content: space-between; font-size: 0.9em; }
        .sub-item span { color: #ef4444; cursor: pointer; font-weight: bold; }
      `}</style>
    </AdminLayout>
  );
}
