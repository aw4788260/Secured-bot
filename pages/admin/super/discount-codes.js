import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import SuperLayout from '../../../components/SuperLayout';

// ─── SVG ICONS ─────────────────────────────────────────────────────────
const IconTicket = ({ size = 24, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5.88V3c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v2.88c.59.35 1 .98 1 1.62s-.41 1.27-1 1.62V12c0 .55.45 1 1 1h10c.55 0 1-.45 1-1v-2.88c-.59-.35-1-.98-1-1.62s.41-1.27 1-1.62z"></path><line x1="20" y1="14" x2="20" y2="21"></line><line x1="16" y1="18" x2="24" y2="18"></line><line x1="8" y1="5" x2="8" y2="10"></line></svg>);
const IconSettings = ({ size = 20, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>);
const IconFlash = ({ size = 20, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>);
const IconTrash = ({ size = 16, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>);
const IconCheck = ({ size = 16, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>);
const IconBlock = ({ size = 16, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>);
const IconTeacher = ({ size = 16, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>);
const IconCourse = ({ size = 16, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>);
const IconSubject = ({ size = 16, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>);
const IconMoney = ({ size = 16, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>);
const IconTime = ({ size = 16, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>);
const IconCopy = ({ size = 16, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>);
const IconSearch = ({ size = 18, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>);
const IconX = ({ size = 16, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>);
const IconWarning = ({ size = 24, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>);
const IconChevronDown = ({ size = 16, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>);
const IconPercent = ({ size = 16, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="5" x2="5" y2="19"></line><circle cx="6.5" cy="6.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle></svg>);

// ─── CUSTOM DROPDOWN COMPONENT ──────────────────────────────────────
const CustomDropdown = ({ options, value, onChange, placeholder, icon: Icon }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(opt => opt.value === value);

    return (
        <div className="custom-dropdown-container" ref={dropdownRef}>
            <button 
                type="button"
                className={`custom-dropdown-trigger ${isOpen ? 'open' : ''}`}
                onClick={(e) => { e.preventDefault(); setIsOpen(!isOpen); }}
            >
                <div className="flex-center gap-2">
                    {Icon && <Icon size={16} className="dropdown-icon" />}
                    <span className="dropdown-text">{selectedOption ? selectedOption.label : placeholder}</span>
                </div>
                <IconChevronDown size={14} className={`chevron-icon ${isOpen ? 'rotated' : ''}`} />
            </button>

            {isOpen && (
                <ul className="custom-dropdown-menu">
                    {options.map((opt) => (
                        <li 
                            key={opt.value}
                            className={value === opt.value ? 'active' : ''}
                            onClick={() => {
                                onChange(opt.value);
                                setIsOpen(false);
                            }}
                        >
                            <div className="flex-center gap-2">
                                {opt.icon && <opt.icon size={14} />}
                                {opt.label}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};
// ───────────────────────────────────────────────────────────────────────

export default function DiscountCodes() {
  const [isClient, setIsClient] = useState(false);
  const [teachers, setTeachers] = useState([]);
  const [courses, setCourses] = useState([]); 
  const [codes, setCodes] = useState([]);
  const [totalCodes, setTotalCodes] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  
  // الفورم الأساسي للتوليد
  const [linkType, setLinkType] = useState('teacher'); 
  const [teacherId, setTeacherId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [discountType, setDiscountType] = useState('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [quantity, setQuantity] = useState(10);
  
  // حالات تاريخ الانتهاء
  const [hasExpiration, setHasExpiration] = useState(false);
  const [expirationDate, setExpirationDate] = useState('');
  
  // التنبيهات الذكية (Toasts)
  const [toast, setToast] = useState({ show: false, text: '', type: 'success' });
  
  const showToast = (text, type = 'success') => {
      setToast({ show: true, text, type });
      setTimeout(() => setToast({ show: false, text: '', type: 'success' }), 3000);
  };

  // الأكواد المولدة حديثاً
  const [newlyGeneratedCodes, setNewlyGeneratedCodes] = useState([]);
  const [copiedBulk, setCopiedBulk] = useState(false);

  // مربع لصق الأكواد للإدارة السريعة
  const [pastedCodes, setPastedCodes] = useState('');

  // التصفح (Pagination)
  const [page, setPage] = useState(1);
  const limit = 50;

  // الفلاتر - تمت إضافة البحث بكود
  const [filters, setFilters] = useState({ teacherId: 'all', type: 'all', value: '', status: 'all', code: '' });

  // العمليات الجماعية (Table)
  const [selectedCodes, setSelectedCodes] = useState([]);

  // النوافذ المنبثقة (Modals)
  const [confirmModal, setConfirmModal] = useState({ 
      show: false, title: '', message: '', action: null, type: 'danger' 
  });

  const [advancedModal, setAdvancedModal] = useState({
      show: false, sourceTxt: '', payload: {}, actionType: '', 
      newTeacher: '', newType: 'percentage', newValue: '',
      newHasExpiration: false, newExpirationDate: ''
  });

  // نافذة اختيار (المدرس / الكورس / المادة)
  const [targetSelectionModal, setTargetSelectionModal] = useState({ show: false, type: '' });

  // دالة التحقق من الانتهاء
  const isExpired = (dateString) => {
      if (!dateString) return false;
      return new Date() > new Date(dateString);
  };

  // استخراج أسماء العناصر المحددة لعرضها في الواجهة
  const selectedTeacherName = teachers.find(t => t.id == teacherId)?.name || '';
  const selectedCourseName = courses.find(c => c.id == courseId)?.title || '';
  let selectedSubjectName = '';
  if (subjectId) {
      courses.forEach(c => {
          const s = c.subjects?.find(sub => sub.id == subjectId);
          if (s) selectedSubjectName = s.title;
      });
  }

  // خيارات القوائم المنسدلة (Dropdown Options)
  const discountTypeOptions = [
    { value: 'percentage', label: 'نسبة مئوية (%)', icon: IconPercent },
    { value: 'fixed', label: 'مبلغ ثابت (جنيه)', icon: IconMoney }
  ];

  const filterStatusOptions = [
    { value: 'all', label: 'الكل' },
    { value: 'active', label: 'متاح للاستخدام', icon: IconCheck },
    { value: 'used', label: 'مستخدم / معطل', icon: IconBlock },
    { value: 'expired', label: 'منتهي الصلاحية', icon: IconTime }
  ];

  const filterTypeOptions = [
    { value: 'all', label: 'الكل' },
    { value: 'percentage', label: 'نسبة مئوية (%)', icon: IconPercent },
    { value: 'fixed', label: 'مبلغ ثابت', icon: IconMoney }
  ];


  // -------------------------------------------------------------
  // جلب البيانات
  // -------------------------------------------------------------
  const fetchData = async (overridePage = page, overrideFilters = filters) => {
    setTableLoading(true);
    try {
      const resContent = await fetch('/api/dashboard/super/content?type=all');
      if (resContent.ok) {
        const contentData = await resContent.json();
        setCourses(contentData.courses || []);
      }

      const queryParams = new URLSearchParams({
        page: overridePage, limit,
        teacherId: overrideFilters.teacherId, 
        type: overrideFilters.type,
        value: overrideFilters.value, 
        status: overrideFilters.status,
        code: overrideFilters.code 
      }).toString();

      const res = await fetch(`/api/dashboard/super/generate-discount-codes?${queryParams}`);
      if (res.ok) {
        const data = await res.json();
        setTeachers(data.teachers || []);
        
        let fetchedCodes = data.codes || [];
        
        // فلترة محلية للحالات 
        if (overrideFilters.status === 'expired') {
            fetchedCodes = fetchedCodes.filter(c => c.expires_at && isExpired(c.expires_at) && !c.is_used);
        } else if (overrideFilters.status === 'active') {
            fetchedCodes = fetchedCodes.filter(c => !c.is_used && (!c.expires_at || !isExpired(c.expires_at)));
        } else if (overrideFilters.status === 'used') {
            fetchedCodes = fetchedCodes.filter(c => c.is_used);
        }
        
        // فلترة محلية إضافية لكود الخصم لضمان عملها فوراً
        if (overrideFilters.code) {
            const searchStr = overrideFilters.code.toLowerCase().trim();
            fetchedCodes = fetchedCodes.filter(c => c.code.toLowerCase().includes(searchStr));
        }

        setCodes(fetchedCodes);
        setTotalCodes(data.total || fetchedCodes.length);
        setSelectedCodes([]); 
      }
    } catch (e) {
      console.error(e);
      showToast('خطأ في جلب البيانات', 'error');
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => { 
      setIsClient(true); 
      fetchData(page, filters); 
  }, [page]); 

  const handleApplyFilters = () => { 
      if (page !== 1) setPage(1); 
      else fetchData(1, filters); 
  };

  const handleClearFilters = () => {
    const emptyFilters = { teacherId: 'all', type: 'all', value: '', status: 'all', code: '' };
    setFilters(emptyFilters);
    if (page !== 1) setPage(1);
    else fetchData(1, emptyFilters);
  };

  // -------------------------------------------------------------
  // توليد الأكواد
  // -------------------------------------------------------------
  const handleGenerate = async (e) => {
    e.preventDefault();
    setNewlyGeneratedCodes([]);
    setCopiedBulk(false);

    if (linkType === 'teacher' && !teacherId) return showToast('يرجى اختيار المدرس', 'error');
    if (linkType === 'course' && !courseId) return showToast('يرجى اختيار الكورس', 'error');
    if (linkType === 'subject' && !subjectId) return showToast('يرجى اختيار المادة', 'error');
    if (!discountValue || !quantity) return showToast('يرجى تعبئة جميع الحقول المطلوبة', 'error');
    if (hasExpiration && !expirationDate) return showToast('يرجى تحديد تاريخ الانتهاء', 'error');

    setLoading(true);
    try {
      const finalExpiry = hasExpiration && expirationDate ? new Date(expirationDate + 'T23:59:59').toISOString() : null;

      const res = await fetch('/api/dashboard/super/generate-discount-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          link_type: linkType,
          teacher_id: linkType === 'teacher' ? parseInt(teacherId) : null,
          course_id: linkType === 'course' ? parseInt(courseId) : null,
          subject_id: linkType === 'subject' ? parseInt(subjectId) : null,
          discount_type: discountType,
          discount_value: parseFloat(discountValue),
          quantity: parseInt(quantity),
          expires_at: finalExpiry
        })
      });

      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'success');
        if (data.generated_codes) setNewlyGeneratedCodes(data.generated_codes); 
        setDiscountValue(''); setQuantity(10);
        setHasExpiration(false); setExpirationDate('');
        handleClearFilters(); 
      } else {
        showToast(data.message || 'خطأ غير متوقع', 'error');
      }
    } catch (error) {
      showToast('خطأ في الاتصال بالخادم', 'error');
    } finally { setLoading(false); }
  };

  // -------------------------------------------------------------
  // إدارة العمليات الجماعية
  // -------------------------------------------------------------
  const executeBulkApi = async (apiPayload) => {
    try {
      const res = await fetch('/api/dashboard/super/generate-discount-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload)
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'success');
        setPastedCodes(''); 
        setAdvancedModal({ ...advancedModal, show: false });
        fetchData();
      } else {
        showToast(data.message, 'error');
      }
    } catch (e) {
      showToast('خطأ بالاتصال بالخادم', 'error');
    }
  };

  const handleTextBulkAction = (actionType) => {
      const codeArray = pastedCodes.split('\n').map(c => c.trim()).filter(Boolean);
      if (codeArray.length === 0) return showToast('يرجى لصق الكوبونات في المربع أولاً', 'error');
      processBulkRequest(actionType, { codes: codeArray }, ` (${codeArray.length} كود)`);
  };

  const handleTableBulkAction = (actionType) => {
      if (selectedCodes.length === 0) return;
      processBulkRequest(actionType, { ids: selectedCodes }, ` (${selectedCodes.length} كود)`);
  };

  const processBulkRequest = (actionType, payloadObj, sourceTxt) => {
      if (actionType === 'delete') {
          setConfirmModal({
              show: true, type: 'danger', title: 'حذف نهائي',
              message: `هل أنت متأكد من حذف الأكواد المحددة${sourceTxt} نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`,
              action: () => executeBulkApi({ action: 'delete', ...payloadObj })
          });
      } else if (actionType === 'activate') {
          setConfirmModal({
              show: true, type: 'success', title: 'تفعيل الأكواد',
              message: `هل تريد تفعيل وإتاحة الأكواد المحددة${sourceTxt} للمستخدمين؟`,
              action: () => executeBulkApi({ action: 'update_status', is_used: false, ...payloadObj })
          });
      } else if (actionType === 'deactivate') {
          setConfirmModal({
              show: true, type: 'warning', title: 'تعطيل الأكواد',
              message: `هل تريد تعطيل (حرق) الأكواد المحددة${sourceTxt} ومنع استخدامها؟`,
              action: () => executeBulkApi({ action: 'update_status', is_used: true, ...payloadObj })
          });
      } else if (['change_teacher', 'change_value', 'change_expiry'].includes(actionType)) {
          setAdvancedModal({
              show: true, payload: payloadObj, actionType, sourceTxt,
              newTeacher: '', newType: 'percentage', newValue: '', newHasExpiration: false, newExpirationDate: ''
          });
      }
  };

  const submitAdvancedModal = () => {
      const { actionType, payload, newTeacher, newType, newValue, newHasExpiration, newExpirationDate } = advancedModal;
      let apiPayload = { action: 'update_advanced', ...payload };

      if (actionType === 'change_teacher') {
          if (!newTeacher) return showToast('الرجاء اختيار المدرس الجديد', 'error');
          apiPayload.teacher_id = newTeacher;
      } else if (actionType === 'change_value') {
          if (!newValue) return showToast('الرجاء كتابة القيمة الجديدة', 'error');
          apiPayload.discount_type = newType;
          apiPayload.discount_value = newValue;
      } else if (actionType === 'change_expiry') {
          if (newHasExpiration && !newExpirationDate) return showToast('الرجاء تحديد التاريخ', 'error');
          apiPayload.expires_at = newHasExpiration ? new Date(newExpirationDate + 'T23:59:59').toISOString() : null;
      }
      executeBulkApi(apiPayload);
  };

  const handleTableBulkCopy = () => {
      if (selectedCodes.length === 0) return;
      const codesToCopy = codes
          .filter(c => selectedCodes.includes(c.id))
          .map(c => c.code)
          .join('\n');
      
      navigator.clipboard.writeText(codesToCopy).then(() => {
          showToast(`تم نسخ ${selectedCodes.length} كود بنجاح!`, 'success');
      }).catch(() => {
          showToast('فشل النسخ', 'error');
      });
  };

  const copySingleCode = (codeStr) => {
    navigator.clipboard.writeText(codeStr);
    showToast(`تم نسخ الكود: ${codeStr}`, 'success');
  };

  const copyBulkCodes = () => {
    if (!newlyGeneratedCodes.length) return;
    const textToCopy = newlyGeneratedCodes.map(item => item.code).join('\n');
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedBulk(true); 
      showToast('تم نسخ جميع الأكواد بنجاح!', 'success');
      setTimeout(() => setCopiedBulk(false), 2000); 
    });
  };

  const renderDiscountValue = (type, val) => type === 'percentage' ? `${val} %` : `${val} ج.م`;
  const totalPages = Math.ceil(totalCodes / limit);

  // خيارات قائمة المدرسين للفلترة والتعديل
  const teacherOptions = [
      { value: 'all', label: 'كل المدرسين', icon: IconTeacher },
      ...teachers.map(t => ({ value: t.id.toString(), label: t.name, icon: IconTeacher }))
  ];

  return (
    <SuperLayout>
      <Head><title>إدارة الكوبونات | الإدارة العليا</title></Head>

      <div className={`smart-toast ${toast.show ? 'show' : ''} ${toast.type}`}>
          <div className="toast-icon">
              {toast.type === 'success' ? <IconCheck size={20}/> : <IconWarning size={20}/>}
          </div>
          <div className="toast-msg">{toast.text}</div>
      </div>

      {isClient ? (
        <div className="page-wrapper">
          <div className="page-header">
              <h2 className="flex-center gap-2">
                <IconTicket size={30} style={{color: 'var(--gold)'}} />
                مركز إدارة الكوبونات
              </h2>
              <p>توليد، تتبع، وتعديل أكواد الخصم الخاصة بالمنصة بسهولة واحترافية.</p>
          </div>

          <div className="top-grid">
              {/* 1. إعدادات التوليد */}
              <div className="card-container border-glass">
                <h3 className="card-title flex-center gap-2">
                    <IconSettings style={{color: 'var(--gold)'}} /> إنشاء كوبونات جديدة
                </h3>
                <form onSubmit={handleGenerate} className="generate-form">
                  
                  {/* تحديد نوع الارتباط */}
                  <div className="form-group full-width">
                    <label>الهدف من الكوبون (نطاق الخصم):</label>
                    <div className="radio-group">
                        <label className="radio-label color-teacher">
                            <input type="radio" name="linkType" checked={linkType === 'teacher'} onChange={() => setLinkType('teacher')} /> مخصص لمدرس (كافة محتواه)
                        </label>
                        <label className="radio-label color-course">
                            <input type="radio" name="linkType" checked={linkType === 'course'} onChange={() => setLinkType('course')} /> مخصص لكورس محدد
                        </label>
                        <label className="radio-label color-subject">
                            <input type="radio" name="linkType" checked={linkType === 'subject'} onChange={() => setLinkType('subject')} /> مخصص لمادة محددة
                        </label>
                    </div>

                    {/* زر اختيار الهدف */}
                    {linkType === 'teacher' && (
                        <div className="selection-trigger" onClick={() => setTargetSelectionModal({ show: true, type: 'teacher' })}>
                            {selectedTeacherName ? <span className="color-teacher flex-center justify-center gap-2"><IconTeacher/> {selectedTeacherName}</span> : <span className="flex-center justify-center gap-2"><IconSearch/> اضغط لاختيار المدرس...</span>}
                        </div>
                    )}

                    {linkType === 'course' && (
                        <div className="selection-trigger" onClick={() => setTargetSelectionModal({ show: true, type: 'course' })}>
                            {selectedCourseName ? <span className="color-course flex-center justify-center gap-2"><IconCourse/> {selectedCourseName}</span> : <span className="flex-center justify-center gap-2"><IconSearch/> اضغط لاختيار الكورس...</span>}
                        </div>
                    )}

                    {linkType === 'subject' && (
                        <div className="selection-trigger" onClick={() => setTargetSelectionModal({ show: true, type: 'subject' })}>
                            {selectedSubjectName ? <span className="color-subject flex-center justify-center gap-2"><IconSubject/> {selectedSubjectName}</span> : <span className="flex-center justify-center gap-2"><IconSearch/> اضغط لاختيار المادة...</span>}
                        </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label>نوع الخصم:</label>
                    <CustomDropdown 
                        options={discountTypeOptions} 
                        value={discountType} 
                        onChange={setDiscountType}
                        placeholder="اختر النوع..."
                    />
                  </div>
                  <div className="form-group">
                    <label>القيمة:</label>
                    <input type="number" min="1" step="any" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className="form-input" placeholder={discountType === 'percentage' ? 'مثال: 20' : 'مثال: 100'} required />
                  </div>
                  <div className="form-group">
                    <label>الكمية المطلوبة:</label>
                    <input type="number" min="1" max="1000" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="form-input" required />
                  </div>

                  {/* تحديد تاريخ الانتهاء */}
                  <div className="form-group full-width">
                    <label className="checkbox-expiration">
                        <input type="checkbox" className="custom-check" checked={hasExpiration} onChange={(e) => setHasExpiration(e.target.checked)} />
                        <span>تحديد تاريخ انتهاء صلاحية الكوبونات؟ (إذا لم تحدد ستكون دائمة)</span>
                    </label>
                    {hasExpiration && (
                        <input 
                            type="date" 
                            className="form-input mt-3" 
                            value={expirationDate} 
                            onChange={(e) => setExpirationDate(e.target.value)} 
                            required={hasExpiration} 
                            min={new Date().toISOString().split('T')[0]} 
                        />
                    )}
                  </div>

                  <div className="form-submit">
                    <button type="submit" disabled={loading} className={`submit-btn flex-center justify-center gap-2 ${loading ? 'loading' : ''}`}>
                      {loading ? <IconTime /> : <IconFlash />} {loading ? 'جاري التوليد...' : 'توليد الأكواد الآن'}
                    </button>
                  </div>
                </form>
              </div>

              {/* 2. الإدارة السريعة بالنص */}
              <div className="card-container highlight-box border-glass">
                  <h3 className="card-title text-blue flex-center gap-2">
                      <IconFlash /> إدارة سريعة بالنص (Bulk Text)
                  </h3>
                  <p className="hint-txt">الصق الكوبونات هنا (كل كوبون في سطر) لتطبيق الإجراء فوراً.</p>
                  <textarea 
                      className="paste-textarea" 
                      placeholder="MED-XYZ123&#10;MED-ABC987"
                      value={pastedCodes}
                      onChange={e => setPastedCodes(e.target.value)}
                  />
                  <div className="bulk-grid-btns mt-3">
                      <button className="btn outline-green" onClick={() => handleTextBulkAction('activate')}><IconCheck /> تفعيل</button>
                      <button className="btn outline-orange" onClick={() => handleTextBulkAction('deactivate')}><IconBlock /> تعطيل</button>
                      <button className="btn outline-red" onClick={() => handleTextBulkAction('delete')}><IconTrash /> حذف</button>
                      <button className="btn outline-blue" onClick={() => handleTextBulkAction('change_teacher')}><IconTeacher /> مدرس</button>
                      <button className="btn outline-purple" onClick={() => handleTextBulkAction('change_value')}><IconMoney /> القيمة</button>
                      <button className="btn outline-blue full-span" onClick={() => handleTextBulkAction('change_expiry')}><IconTime /> تغيير الصلاحية</button>
                  </div>
              </div>
          </div>

          {/* 3. الأكواد المولدة حديثاً */}
          {newlyGeneratedCodes.length > 0 && (
            <div className="new-codes-container">
              <div className="new-codes-header">
                <h3 className="flex-center gap-2"><IconCheck style={{color:'var(--gold)'}}/> تم التوليد بنجاح! ({newlyGeneratedCodes.length} كود)</h3>
                <button onClick={copyBulkCodes} className={`copy-btn ${copiedBulk ? 'copied' : ''}`}>
                  <IconCopy /> {copiedBulk ? 'تم النسخ!' : 'نسخ القائمة بالكامل'}
                </button>
              </div>
              <textarea readOnly className="new-codes-textarea" value={newlyGeneratedCodes.map(item => item.code).join('\n')} rows={Math.min(10, newlyGeneratedCodes.length)} />
            </div>
          )}

          {/* 4. شريط الفلترة والأدوات للجدول */}
          <div className="filters-container mt-4 border-glass">
              <div className="filters-grid">
                  <div className="filter-item">
                      <label>بحث بكود مخصص</label>
                      <input type="text" className="form-input" placeholder="ادخل الكود هنا..." value={filters.code} onChange={e=>setFilters({...filters, code: e.target.value})} />
                  </div>
                  <div className="filter-item z-index-4">
                      <label>المدرس المرتبط</label>
                      <CustomDropdown 
                          options={teacherOptions} 
                          value={filters.teacherId} 
                          onChange={(val) => setFilters({...filters, teacherId: val})}
                      />
                  </div>
                  <div className="filter-item z-index-3">
                      <label>نوع الخصم</label>
                      <CustomDropdown 
                          options={filterTypeOptions} 
                          value={filters.type} 
                          onChange={(val) => setFilters({...filters, type: val})}
                      />
                  </div>
                  <div className="filter-item">
                      <label>القيمة (رقم)</label>
                      <input type="number" className="form-input" placeholder="بحث بالقيمة..." value={filters.value} onChange={e=>setFilters({...filters, value: e.target.value})} />
                  </div>
                  <div className="filter-item z-index-2">
                      <label>الحالة</label>
                      <CustomDropdown 
                          options={filterStatusOptions} 
                          value={filters.status} 
                          onChange={(val) => setFilters({...filters, status: val})}
                      />
                  </div>
              </div>
              <div className="filters-actions">
                  <button onClick={handleApplyFilters} className="btn-apply flex-center gap-2"><IconSearch /> بحث وتطبيق</button>
                  <button onClick={handleClearFilters} className="btn-clear flex-center gap-2"><IconX /> مسح</button>
              </div>
          </div>

          {/* 5. الجدول والعمليات الجماعية */}
          <div className="card-container table-card border-glass">
            <div className="table-header-flex">
               <h3 className="card-title m-0">قاعدة بيانات الكوبونات ({totalCodes})</h3>
               {selectedCodes.length > 0 && (
                   <div className="bulk-actions-bar">
                       <span className="selected-count">{selectedCodes.length} كود محدد</span>
                       <button className="btn outline-blue flex-center gap-1" onClick={handleTableBulkCopy}><IconCopy /> نسخ</button>
                       <button className="btn green flex-center gap-1" onClick={() => handleTableBulkAction('activate')}><IconCheck /> تفعيل</button>
                       <button className="btn orange flex-center gap-1" onClick={() => handleTableBulkAction('deactivate')}><IconBlock /> تعطيل</button>
                       <button className="btn blue flex-center gap-1" onClick={() => handleTableBulkAction('change_teacher')}><IconTeacher /> نقل</button>
                       <button className="btn purple flex-center gap-1" onClick={() => handleTableBulkAction('change_value')}><IconMoney /> القيمة</button>
                       <button className="btn blue flex-center gap-1" onClick={() => handleTableBulkAction('change_expiry')}><IconTime /> الصلاحية</button>
                       <button className="btn red flex-center gap-1" onClick={() => handleTableBulkAction('delete')}><IconTrash /> حذف</button>
                   </div>
               )}
            </div>

            <div className="table-responsive">
              <table className="codes-table">
                <thead>
                  <tr>
                    <th style={{width: '40px'}}><input type="checkbox" onChange={(e) => setSelectedCodes(e.target.checked ? codes.map(c => c.id) : [])} checked={codes.length > 0 && selectedCodes.length === codes.length} /></th>
                    <th>الكود</th>
                    <th>الارتباط والهدف</th>
                    <th>الخصم</th>
                    <th>تاريخ الإنشاء</th>
                    <th>تاريخ الانتهاء</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {tableLoading ? (
                    <tr><td colSpan="7" className="empty-table loading-txt">جاري تحميل البيانات...</td></tr>
                  ) : codes.length === 0 ? (
                    <tr>
                        <td colSpan="7" className="empty-table">
                            <div className="flex-center justify-center" style={{marginBottom:'10px', opacity: 0.5}}><IconSearch size={40} /></div>
                            لا توجد نتائج تطابق بحثك.
                        </td>
                    </tr>
                  ) : (
                    codes.map(code => (
                      <tr key={code.id} className={selectedCodes.includes(code.id) ? 'selected-row' : ''}>
                        <td><input type="checkbox" checked={selectedCodes.includes(code.id)} onChange={() => setSelectedCodes(prev => prev.includes(code.id) ? prev.filter(x => x !== code.id) : [...prev, code.id])} /></td>
                        <td>
                            <div className="code-cell">
                                <span className="code-text">{code.code}</span>
                                <button className="icon-btn flex-center" onClick={() => copySingleCode(code.code)} title="نسخ الكود"><IconCopy size={14}/></button>
                            </div>
                        </td>
                        
                        <td className="teacher-name">
                            <div className="flex-center gap-2">
                                {code.link_type === 'teacher' && <span className="color-teacher flex-center gap-1"><IconTeacher size={14}/> {code.teachers?.name}</span>}
                                {code.link_type === 'course' && <span className="color-course flex-center gap-1"><IconCourse size={14}/> {code.courses?.title}</span>}
                                {code.link_type === 'subject' && <span className="color-subject flex-center gap-1"><IconSubject size={14}/> {code.subjects?.title}</span>}
                                {!code.link_type && (code.teachers?.name || 'غير محدد')}
                            </div>
                        </td>
                        
                        <td className="discount-value">{renderDiscountValue(code.discount_type, code.discount_value)}</td>
                        <td className="date-text">{new Date(code.created_at).toLocaleDateString('ar-EG')}</td>
                        
                        <td className="date-text" style={{fontWeight: 'bold', color: code.expires_at ? (isExpired(code.expires_at) ? '#ef4444' : 'var(--text-primary)') : '#22c55e'}}>
                            {code.expires_at ? new Date(code.expires_at).toLocaleDateString('ar-EG') : 'مفتوح (دائم)'}
                        </td>

                        <td>
                          {code.is_used ? (
                            <span className="status-badge used flex-center gap-1"><IconBlock size={12}/> مستخدم/معطل</span>
                          ) : isExpired(code.expires_at) ? (
                            <span className="status-badge expired flex-center gap-1"><IconTime size={12}/> منتهي</span>
                          ) : (
                            <span className="status-badge active flex-center gap-1"><IconCheck size={12}/> متاح</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="pagination">
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>السابق</button>
                    <span>صفحة {page} من {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>التالي</button>
                </div>
            )}
          </div>
        </div>
      ) : (
        <div className="loading-screen">
            <div className="loader-spinner"></div>
            جاري تهيئة مركز الكوبونات...
        </div>
      )}

      {/* ✅ نافذة التأكيد (Confirm Modal) */}
      {confirmModal.show && (
          <div className="modal-overlay blur-bg" onClick={() => setConfirmModal({...confirmModal, show: false})}>
              <div className="modal-box confirm-box" onClick={e => e.stopPropagation()}>
                  <div className={`modal-icon-header ${confirmModal.type}`}>
                      {confirmModal.type === 'danger' ? <IconTrash size={32} /> : confirmModal.type === 'warning' ? <IconWarning size={32} /> : <IconCheck size={32} />}
                  </div>
                  <h3 className="modal-title">{confirmModal.title}</h3>
                  <p className="modal-desc">{confirmModal.message}</p>
                  
                  <div className="modal-actions centered">
                      <button className="btn-cancel" onClick={() => setConfirmModal({...confirmModal, show: false})}>تراجع</button>
                      <button className={`btn-save ${confirmModal.type}`} onClick={() => { confirmModal.action(); setConfirmModal({...confirmModal, show: false}); }}>
                          تأكيد التنفيذ
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* ✅ نافذة اختيار الهدف (Target Selection Modal) */}
      {targetSelectionModal.show && (
          <div className="modal-overlay blur-bg" onClick={() => setTargetSelectionModal({ show: false, type: '' })}>
              <div className="modal-box target-selection-box" onClick={e => e.stopPropagation()}>
                  <div className="modal-header-glass">
                      <h3 className="modal-title flex-center gap-2">
                          {targetSelectionModal.type === 'teacher' ? <><IconTeacher/> اختر المدرس</> :
                           targetSelectionModal.type === 'course' ? <><IconCourse/> اختر الكورس</> : <><IconSubject/> اختر المادة</>}
                      </h3>
                      <button className="close-x" onClick={() => setTargetSelectionModal({ show: false, type: '' })}><IconX size={24}/></button>
                  </div>
                  
                  <div className="target-list">
                      {targetSelectionModal.type === 'teacher' && teachers.map(t => (
                          <div key={t.id} className={`target-item ${teacherId == t.id ? 'active' : ''}`} onClick={() => { setTeacherId(t.id); setTargetSelectionModal({show: false, type: ''}); }}>
                              <span>{t.name}</span>
                          </div>
                      ))}

                      {targetSelectionModal.type === 'course' && courses.map(c => (
                          <div key={c.id} className={`target-item ${courseId == c.id ? 'active' : ''}`} onClick={() => { setCourseId(c.id); setTargetSelectionModal({show: false, type: ''}); }}>
                              <span>{c.title}</span>
                          </div>
                      ))}

                      {targetSelectionModal.type === 'subject' && courses.map(c => (
                          <div key={c.id} className="subject-group">
                              <div className="subject-group-title">كورس: {c.title}</div>
                              {c.subjects?.map(s => (
                                  <div key={s.id} className={`target-item subject ${subjectId == s.id ? 'active' : ''}`} onClick={() => { setSubjectId(s.id); setTargetSelectionModal({show: false, type: ''}); }}>
                                      <span>{s.title}</span>
                                  </div>
                              ))}
                          </div>
                      ))}
                      
                      {targetSelectionModal.type === 'teacher' && teachers.length === 0 && <p className="empty-msg">لا يوجد مدرسين مسجلين.</p>}
                      {['course', 'subject'].includes(targetSelectionModal.type) && courses.length === 0 && <p className="empty-msg">لا توجد كورسات مسجلة حالياً.</p>}
                  </div>
              </div>
          </div>
      )}

      {/* ✅ نافذة التعديل المتقدم (Advanced Modal) */}
      {advancedModal.show && (
          <div className="modal-overlay blur-bg" onClick={() => setAdvancedModal({...advancedModal, show: false})}>
              <div className="modal-box" onClick={e => e.stopPropagation()}>
                  <div className="modal-header-glass">
                      <h3 className="modal-title m-0 flex-center gap-2">
                          {advancedModal.actionType === 'change_teacher' ? <><IconTeacher/> نقل الكوبونات (لمدرس)</> : 
                           advancedModal.actionType === 'change_value' ? <><IconMoney/> تعديل القيمة</> : <><IconTime/> تعديل الصلاحية</>}
                      </h3>
                      <button className="close-x" onClick={() => setAdvancedModal({...advancedModal, show: false})}><IconX size={24}/></button>
                  </div>
                  
                  <p className="modal-desc mt-3 alert-info">
                      سيتم التطبيق على الأكواد {advancedModal.sourceTxt}
                  </p>

                  {advancedModal.actionType === 'change_teacher' && (
                      <div className="form-group mt-4">
                          <label>اختر المدرس الجديد (يحذف ارتباط الكورس/المادة إن وجد):</label>
                          <CustomDropdown 
                              options={teacherOptions.filter(opt => opt.value !== 'all')} 
                              value={advancedModal.newTeacher} 
                              onChange={(val) => setAdvancedModal({...advancedModal, newTeacher: val})}
                              placeholder="-- يرجى الاختيار --"
                          />
                      </div>
                  )}

                  {advancedModal.actionType === 'change_value' && (
                      <>
                          <div className="form-group mt-4">
                              <label>نوع الخصم الجديد:</label>
                              <CustomDropdown 
                                  options={discountTypeOptions} 
                                  value={advancedModal.newType} 
                                  onChange={(val) => setAdvancedModal({...advancedModal, newType: val})}
                              />
                          </div>
                          <div className="form-group mt-3">
                              <label>القيمة الجديدة:</label>
                              <input type="number" min="1" className="form-input" value={advancedModal.newValue} onChange={e => setAdvancedModal({...advancedModal, newValue: e.target.value})} placeholder="أدخل القيمة..." />
                          </div>
                      </>
                  )}

                  {advancedModal.actionType === 'change_expiry' && (
                      <div className="form-group mt-4">
                        <label className="checkbox-expiration">
                            <input type="checkbox" className="custom-check" checked={advancedModal.newHasExpiration} onChange={(e) => setAdvancedModal({...advancedModal, newHasExpiration: e.target.checked})} />
                            <span>تحديد تاريخ انتهاء؟ (إلغاء التحديد يجعله دائماً)</span>
                        </label>
                        {advancedModal.newHasExpiration && (
                            <input type="date" className="form-input mt-3" value={advancedModal.newExpirationDate} onChange={(e) => setAdvancedModal({...advancedModal, newExpirationDate: e.target.value})} min={new Date().toISOString().split('T')[0]} />
                        )}
                      </div>
                  )}

                  <div className="modal-actions mt-4">
                      <button className="btn-cancel" onClick={() => setAdvancedModal({...advancedModal, show: false})}>إلغاء</button>
                      <button className="btn-save primary" onClick={submitAdvancedModal}>حفظ التعديلات</button>
                  </div>
              </div>
          </div>
      )}

      <style jsx>{`
        /* ==================== Utilities ==================== */
        .flex-center { display: flex; align-items: center; }
        .justify-center { justify-content: center; }
        .gap-1 { gap: 5px; }
        .gap-2 { gap: 10px; }
        .full-width { grid-column: 1 / -1; }
        .full-span { grid-column: span 1.5; }
        .mt-3 { margin-top: 15px; } .mt-4 { margin-top: 25px; } .m-0 { margin: 0; }
        
        .z-index-4 { z-index: 4; }
        .z-index-3 { z-index: 3; }
        .z-index-2 { z-index: 2; }

        /* ==================== Colors / Theme Logic ==================== */
        .color-teacher { color: #3b82f6; }
        .color-course { color: #22c55e; }
        .color-subject { color: #eab308; }
        
        .layout-root.light .color-teacher { color: #2563eb; }
        .layout-root.light .color-course { color: #16a34a; }
        .layout-root.light .color-subject { color: #ca8a04; }

        .page-wrapper { padding: 25px; direction: rtl; font-family: 'Tajawal', system-ui, sans-serif; padding-bottom: 60px; color: var(--text-primary); }
        .page-header { margin-bottom: 25px; border-bottom: 1px solid var(--border); padding-bottom: 15px; }
        .page-header h2 { margin: 0; color: var(--text-primary); font-size: 1.8rem; }
        .page-header p { margin: 5px 0 0 0; color: var(--text-secondary); }
        
        .loading-screen { min-height: 60vh; display: flex; flex-direction: column; gap: 15px; justify-content: center; align-items: center; color: var(--gold); font-size: 1.2rem; }
        .loader-spinner { width: 40px; height: 40px; border: 4px solid var(--border); border-top: 4px solid var(--gold); border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        /* ==================== Smart Toast ==================== */
        .smart-toast { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%) translateY(100px); background: var(--bg-elevated); color: var(--text-primary); padding: 12px 25px; border-radius: 50px; font-weight: bold; box-shadow: var(--shadow); z-index: 20000; display: flex; align-items: center; gap: 10px; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); opacity: 0; border: 1px solid var(--border); }
        .smart-toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }
        .smart-toast.success { border-bottom: 3px solid #22c55e; }
        .smart-toast.error { border-bottom: 3px solid #ef4444; }

        /* ==================== Custom Dropdown ==================== */
        .custom-dropdown-container { position: relative; width: 100%; }
        .custom-dropdown-trigger { 
          width: 100%; display: flex; align-items: center; justify-content: space-between;
          background: var(--bg-base); color: var(--text-primary); 
          padding: 12px 15px; border: 1px solid var(--border); border-radius: 8px; 
          font-size: 0.95rem; cursor: pointer; transition: all 0.2s; font-family: inherit;
        }
        .custom-dropdown-trigger:hover, .custom-dropdown-trigger.open { border-color: var(--gold); }
        .dropdown-icon { color: var(--text-secondary); }
        .custom-dropdown-trigger.open .dropdown-icon { color: var(--gold); }
        .dropdown-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .chevron-icon { color: var(--text-secondary); transition: transform 0.3s ease; flex-shrink: 0; }
        .chevron-icon.rotated { transform: rotate(180deg); color: var(--gold); }
        
        .custom-dropdown-menu { 
          position: absolute; top: calc(100% + 6px); right: 0; width: 100%; 
          background: var(--bg-surface); border: 1px solid var(--border-accent); 
          border-radius: 8px; box-shadow: var(--shadow); z-index: 100; 
          list-style: none; padding: 6px 0; margin: 0; max-height: 250px; overflow-y: auto;
          animation: dropIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .custom-dropdown-menu::-webkit-scrollbar { width: 6px; }
        .custom-dropdown-menu::-webkit-scrollbar-track { background: var(--bg-base); }
        .custom-dropdown-menu::-webkit-scrollbar-thumb { background: var(--border-accent); border-radius: 4px; }
        .custom-dropdown-menu li { 
          padding: 10px 15px; cursor: pointer; color: var(--text-secondary); 
          font-size: 0.95rem; transition: all 0.2s;
        }
        .custom-dropdown-menu li:hover { background: var(--bg-hover); color: var(--text-primary); }
        .custom-dropdown-menu li.active { background: var(--gold-dim); color: var(--gold); font-weight: bold; border-right: 3px solid var(--gold); }

        @keyframes dropIn { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        /* ==================== Grid & Cards ==================== */
        .top-grid { display: grid; grid-template-columns: 2fr 1.2fr; gap: 20px; margin-bottom: 25px;}
        @media (max-width: 1024px) { .top-grid { grid-template-columns: 1fr; } }

        .border-glass { border: 1px solid var(--border); box-shadow: var(--shadow); }
        .card-container { background: var(--bg-surface); padding: 25px; border-radius: 16px; transition: 0.3s; }
        
        .highlight-box { background: var(--bg-hover); border-color: var(--gold); box-shadow: 0 0 20px var(--gold-dimmer); }
        
        .card-title { margin: 0 0 20px 0; color: var(--text-primary); border-bottom: 1px dashed var(--border); padding-bottom: 12px; font-size: 1.25rem;}
        .card-title.text-blue { color: var(--gold); border-color: var(--gold-dim); }
        
        .paste-textarea { width: 100%; height: 160px; background: var(--bg-base); border: 1px solid var(--border); border-radius: 12px; color: var(--gold); padding: 15px; font-family: monospace; resize: vertical; outline: none; line-height: 1.8; letter-spacing: 1px; transition: 0.3s; }
        .paste-textarea:focus { border-color: var(--gold); background: var(--bg-elevated); }
        .hint-txt { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 12px; }

        /* ==================== Buttons ==================== */
        .bulk-grid-btns { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
        
        .btn { padding: 10px 15px; border-radius: 8px; border: none; font-weight: bold; cursor: pointer; transition: 0.2s; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; gap: 5px; }
        .btn:hover { transform: translateY(-2px); filter: brightness(1.1); box-shadow: 0 4px 10px rgba(0,0,0,0.15); }
        
        .btn.green { background: #22c55e; color: #fff;} 
        .btn.orange { background: #f97316; color: white;} 
        .btn.red { background: #ef4444; color: white;} 
        .btn.blue { background: #3b82f6; color: white;} 
        .btn.purple { background: #a855f7; color: white;}

        .btn.outline-green { background: rgba(34,197,94,0.1); border: 1px solid #22c55e; color: #16a34a; }
        .btn.outline-orange { background: rgba(249,115,22,0.1); border: 1px solid #f97316; color: #ea580c; }
        .btn.outline-red { background: rgba(239,68,68,0.1); border: 1px solid #ef4444; color: #dc2626; }
        .btn.outline-blue { background: rgba(59,130,246,0.1); border: 1px solid #3b82f6; color: #2563eb; }
        .btn.outline-purple { background: rgba(168,85,247,0.1); border: 1px solid #a855f7; color: #9333ea; }
        
        .layout-root.dark .btn.outline-green { color: #4ade80; }
        .layout-root.dark .btn.outline-orange { color: #fb923c; }
        .layout-root.dark .btn.outline-red { color: #fca5a5; }
        .layout-root.dark .btn.outline-blue { color: #60a5fa; }
        .layout-root.dark .btn.outline-purple { color: #c084fc; }

        /* ==================== Form ==================== */
        .generate-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
        .form-group label { display: block; margin-bottom: 8px; font-weight: bold; color: var(--text-secondary); font-size: 0.9rem; }
        .form-input { width: 100%; padding: 12px 15px; border-radius: 8px; border: 1px solid var(--border); background-color: var(--bg-base); color: var(--text-primary); outline: none; transition: 0.2s; font-family: inherit;}
        .form-input:focus { border-color: var(--gold); }
        .form-submit { grid-column: 1 / -1; margin-top: 10px; }
        .submit-btn { width: 100%; padding: 15px; background: var(--gold); color: #111009; border: none; border-radius: 12px; font-weight: bold; font-size: 1.1rem; cursor: pointer; transition: 0.3s; }
        .submit-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px var(--gold-dim); }
        .submit-btn.loading { background: var(--bg-elevated); color: var(--text-muted); cursor: not-allowed; }

        .radio-group { display: flex; gap: 15px; margin-bottom: 15px; flex-wrap: wrap; }
        .radio-label { display: flex; align-items: center; gap: 6px; font-weight: bold; cursor: pointer; }
        
        .checkbox-expiration { display: flex; align-items: center; gap: 10px; cursor: pointer; background: var(--bg-elevated); padding: 10px 15px; border-radius: 8px; border: 1px solid var(--border); color: var(--text-primary); font-weight: bold; transition: 0.2s; }
        .checkbox-expiration:hover { border-color: var(--gold); }
        .custom-check { width: 18px; height: 18px; accent-color: var(--gold); cursor: pointer; }

        .selection-trigger { width: 100%; padding: 15px; border-radius: 8px; border: 1px dashed var(--border-accent); background: var(--bg-elevated); color: var(--text-muted); cursor: pointer; text-align: center; font-weight: bold; transition: 0.3s; font-size: 1rem; }
        .selection-trigger:hover { background: var(--gold-dimmer); border-style: solid; color: var(--gold); }
        
        .target-selection-box { max-width: 550px !important; max-height: 85vh; display: flex; flex-direction: column; }
        .target-list { overflow-y: auto; margin-top: 15px; display: flex; flex-direction: column; gap: 8px; padding-right: 5px; }
        .target-list::-webkit-scrollbar { width: 6px; }
        .target-list::-webkit-scrollbar-track { background: var(--bg-base); border-radius: 10px; }
        .target-list::-webkit-scrollbar-thumb { background: var(--border-accent); border-radius: 10px; }
        .target-item { padding: 12px 15px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 8px; cursor: pointer; transition: 0.2s; color: var(--text-primary); font-weight: bold; display: flex; align-items: center;}
        .target-item:hover { border-color: var(--gold); background: var(--gold-dimmer); }
        .target-item.active { background: var(--gold); color: #111009; border-color: var(--gold); }
        .subject-group { margin-bottom: 12px; background: var(--bg-base); padding: 15px; border-radius: 12px; border: 1px solid var(--border);}
        .subject-group-title { font-size: 0.95rem; color: var(--gold); margin-bottom: 12px; font-weight: bold; border-bottom: 1px dashed var(--border); padding-bottom: 8px;}
        .target-item.subject { margin-bottom: 8px; background: var(--bg-surface); }
        .empty-msg { text-align: center; color: var(--text-muted); margin-top: 20px; font-weight: bold;}

        /* ==================== New Codes Box ==================== */
        .new-codes-container { background: var(--gold-dimmer); padding: 25px; border-radius: 16px; border: 1px solid var(--border-accent); margin-bottom: 30px; animation: slideDown 0.4s ease-out; }
        .new-codes-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .new-codes-header h3 { margin: 0; color: var(--gold); }
        .copy-btn { background: var(--gold); color: #111009; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s; display: flex; align-items: center; gap: 8px;}
        .copy-btn.copied { background: #22c55e; color: white; }
        .new-codes-textarea { width: 100%; padding: 20px; background: var(--bg-base); color: var(--text-primary); border: 1px dashed var(--border); border-radius: 12px; font-family: monospace; font-size: 1.2rem; resize: vertical; outline: none; text-align: center; letter-spacing: 2px; }

        @keyframes slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }

        /* ==================== Filters ==================== */
        .filters-container { background: var(--bg-elevated); padding: 20px; border-radius: 16px; margin-bottom: 25px; display: flex; flex-direction: column; gap: 15px; }
        .filters-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; }
        .filter-item label { display: block; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 5px; font-weight: bold;}
        
        .filters-actions { display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border); padding-top: 15px; }
        .btn-apply { background: var(--gold); color: #111009; border: none; padding: 10px 25px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s; }
        .btn-apply:hover { filter: brightness(1.1); }
        .btn-clear { background: transparent; color: var(--text-secondary); border: 1px solid var(--border); padding: 10px 25px; border-radius: 8px; cursor: pointer; transition: 0.2s; font-weight: bold;}
        .btn-clear:hover { background: var(--bg-hover); color: var(--text-primary); }

        /* ==================== Table & Bulk Bar ==================== */
        .table-card { padding: 0; overflow: hidden; margin-top: 10px;}
        .table-header-flex { display: flex; justify-content: space-between; align-items: center; padding: 20px 25px; border-bottom: 1px solid var(--border); background: var(--bg-elevated); flex-wrap: wrap; gap: 15px; }
        
        .bulk-actions-bar { display: flex; gap: 10px; align-items: center; background: var(--bg-base); padding: 8px 15px; border-radius: 12px; border: 1px solid var(--border); flex-wrap: wrap; animation: fadeIn 0.3s; }
        .selected-count { color: var(--gold); font-weight: bold; font-size: 0.95rem; margin-left: 10px; background: var(--gold-dimmer); padding: 4px 10px; border-radius: 20px;}

        .table-responsive { overflow-x: auto; }
        .codes-table { width: 100%; border-collapse: collapse; text-align: right; }
        .codes-table th { padding: 15px 20px; background: var(--bg-elevated); color: var(--text-secondary); font-size: 0.9rem; border-bottom: 1px solid var(--border); white-space: nowrap; font-weight: bold; text-transform: uppercase; }
        .codes-table td { padding: 15px 20px; border-bottom: 1px solid var(--border); vertical-align: middle; }
        .codes-table tr:hover { background: var(--bg-hover); }
        .selected-row { background: var(--gold-dimmer) !important; }
        .empty-table { text-align: center; padding: 50px !important; color: var(--text-muted); font-size: 1.1rem; font-weight: bold;}
        .loading-txt { color: var(--gold); }

        .code-cell { display: flex; align-items: center; gap: 10px; }
        .code-text { font-family: monospace; font-size: 1.15rem; color: var(--gold); font-weight: bold; background: var(--bg-base); padding: 4px 8px; border-radius: 6px; border: 1px solid var(--border);}
        .icon-btn { background: transparent; border: 1px solid var(--border); padding: 6px; border-radius: 6px; cursor: pointer; transition: 0.2s; color: var(--text-secondary);}
        .icon-btn:hover { background: var(--gold); border-color: var(--gold); color: #111009; }

        .teacher-name { color: var(--text-primary); font-weight: bold; font-size: 0.9rem;}
        .discount-value { color: #10b981; font-weight: 900; font-size: 1.1rem; }
        .date-text { color: var(--text-secondary); font-size: 0.85rem; }

        .status-badge { padding: 6px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; width: fit-content;}
        .status-badge.used { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
        .status-badge.active { background: rgba(34, 197, 94, 0.1); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.2); }
        .status-badge.expired { background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2); }

        /* Pagination */
        .pagination { display: flex; justify-content: center; align-items: center; gap: 15px; padding: 25px; background: var(--bg-elevated); color: var(--text-secondary); font-weight: bold;}
        .pagination button { background: var(--bg-surface); border: 1px solid var(--border); color: var(--text-primary); padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: inherit; transition: 0.2s;}
        .pagination button:hover:not(:disabled) { background: var(--gold); color: #111009; border-color: var(--gold); }
        .pagination button:disabled { opacity: 0.4; cursor: not-allowed; }

        /* ==================== Modals (Premium Design) ==================== */
        .blur-bg { backdrop-filter: blur(5px); }
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 10000; animation: fadeIn 0.2s ease-out;}
        .modal-box { background: var(--bg-surface); padding: 30px; border-radius: 20px; border: 1px solid var(--border-accent); width: 90%; max-width: 420px; box-shadow: var(--shadow); animation: scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); position: relative; overflow: hidden; }
        
        .modal-header-glass { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 15px; }
        .close-x { background: transparent; border: none; color: var(--text-muted); cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; padding: 0;}
        .close-x:hover { color: #ef4444; }

        .modal-title { color: var(--text-primary); margin: 0; font-size: 1.3rem; }
        .modal-desc { color: var(--text-secondary); font-size: 0.95rem; margin-top: 10px; line-height: 1.5; }
        
        .alert-info { color: var(--gold); background: var(--gold-dimmer); padding: 10px; border-radius: 8px; border: 1px dashed var(--border-accent); }

        .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 30px; }
        .modal-actions.centered { justify-content: center; }
        
        .btn-cancel { background: var(--bg-base); color: var(--text-secondary); border: 1px solid var(--border); padding: 12px 25px; border-radius: 10px; cursor: pointer; font-weight: bold; transition: 0.2s; }
        .btn-cancel:hover { background: var(--bg-hover); color: var(--text-primary); }
        
        .btn-save { padding: 12px 25px; border-radius: 10px; font-weight: bold; cursor: pointer; border: none; transition: 0.2s; color: white; }
        .btn-save:hover { transform: translateY(-2px); filter: brightness(1.1); }
        .btn-save.primary { background: var(--gold); color: #111009; }
        .btn-save.danger { background: #ef4444; }
        .btn-save.warning { background: #f97316; }
        .btn-save.success { background: #22c55e; }

        .confirm-box { text-align: center; }
        .modal-icon-header { width: 70px; height: 70px; border-radius: 50%; display: flex; justify-content: center; align-items: center; margin: 0 auto 20px auto; }
        .modal-icon-header.danger { background: rgba(239, 68, 68, 0.1); border: 2px solid #ef4444; color: #ef4444;}
        .modal-icon-header.warning { background: rgba(249, 115, 22, 0.1); border: 2px solid #f97316; color: #f97316;}
        .modal-icon-header.success { background: rgba(34, 197, 94, 0.1); border: 2px solid #22c55e; color: #22c55e;}

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleUp { from { opacity: 0; transform: scale(0.9) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </SuperLayout>
  );
}
