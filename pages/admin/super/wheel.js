import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import SuperLayout from '../../../components/SuperLayout';

// ─── SVG ICONS ─────────────────────────────────────────────────────────
const IconWheel = ({ size = 24, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2v20"></path><path d="M2 12h20"></path><path d="M4.93 4.93l14.14 14.14"></path><path d="M19.07 4.93L4.93 19.07"></path><circle cx="12" cy="12" r="3" fill="currentColor"></circle></svg>);
const IconSettings = ({ size = 20, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>);
const IconTicket = ({ size = 20, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5.88V3c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v2.88c.59.35 1 .98 1 1.62s-.41 1.27-1 1.62V12c0 .55.45 1 1 1h10c.55 0 1-.45 1-1v-2.88c-.59-.35-1-.98-1-1.62s.41-1.27 1-1.62z"></path></svg>);
const IconUsers = ({ size = 20, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>);
const IconTeacher = ({ size = 16, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>);
const IconCourse = ({ size = 16, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>);
const IconSubject = ({ size = 16, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>);
const IconGift = ({ size = 16, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>);
const IconFrown = ({ size = 16, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M16 16s-1.5-2-4-2-4 2-4 2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>);
const IconCheck = ({ size = 16, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>);
const IconX = ({ size = 16, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>);
const IconTrash = ({ size = 16, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>);
const IconEdit = ({ size = 16, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>);
const IconPower = ({ size = 18, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>);
const IconRefresh = ({ size = 18, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"></polyline><polyline points="23 20 23 14 17 14"></polyline><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path></svg>);
const IconRocket = ({ size = 18, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path></svg>);
const IconPlus = ({ size = 18, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>);
const IconWarning = ({ size = 24, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>);
const IconChevronDown = ({ size = 16, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>);
const IconPercent = ({ size = 16, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="5" x2="5" y2="19"></line><circle cx="6.5" cy="6.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle></svg>);
const IconMoney = ({ size = 16, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>);
const IconSave = ({ size = 18, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>);
const IconSearch = ({ size = 18, className = "" }) => (<svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>);

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
                    {selectedOption?.icon && !Icon && <selectedOption.icon size={16} className="dropdown-icon" />}
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

export default function WheelManager() {
  const [loading, setLoading] = useState(true);
  const [prizes, setPrizes] = useState([]);
  const [winners, setWinners] = useState([]); 
  const [isWheelEnabled, setIsWheelEnabled] = useState(true); 
  const [teachers, setTeachers] = useState([]);
  const [courses, setCourses] = useState([]); 
  const [stats, setStats] = useState({ poolCount: 0, spinsCount: 0 });

  const [showModal, setShowModal] = useState(false);
  const [confirmData, setConfirmData] = useState({ show: false, msg: '', action: null });
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });

  // نافذة اختيار الهدف (Target Selection)
  const [targetSelectionModal, setTargetSelectionModal] = useState({ show: false, type: '' });

  const [formData, setFormData] = useState({
    id: null, title: '', type: 'coupon', discount_type: 'percentage',
    discount_value: 0, validity_days: 7, total_stock: 10, 
    link_type: 'teacher', teacher_id: '', course_id: '', subject_id: '', is_active: true
  });

  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg, type }), 3000);
  };

  const showConfirm = (msg, action) => {
    setConfirmData({ show: true, msg, action });
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const tRes = await fetch('/api/dashboard/super/teachers');
      if (tRes.ok) setTeachers(await tRes.json() || []);

      const cRes = await fetch('/api/dashboard/super/content?type=all');
      if (cRes.ok) {
          const cData = await cRes.json();
          setCourses(cData.courses || []);
      }

      const wRes = await fetch('/api/dashboard/super/wheel');
      if (wRes.ok) {
        const data = await wRes.json();
        setPrizes(data.prizes || []);
        setWinners(data.winners || []); 
        setIsWheelEnabled(data.isWheelEnabled); 
        setStats({ poolCount: data.poolCount, spinsCount: data.spinsCount });
      }
    } catch (err) {
      showToast('خطأ في جلب البيانات', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const executeAction = async (action, payload = {}) => {
    setConfirmData({ show: false, msg: '', action: null });
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/super/wheel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'success');
        setShowModal(false);
        fetchData();
      } else {
        showToast(data.error || data.message, 'error');
      }
    } catch (e) {
      showToast('خطأ في الاتصال', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleWheel = () => {
      const nextState = !isWheelEnabled;
      showConfirm(
          `هل أنت متأكد من أنك تريد ${nextState ? 'تفعيل' : 'تعطيل وإلغاء تفعيل'} عجلة الحظ للطلاب؟`,
          () => executeAction('toggle_wheel_status', { enabled: nextState })
      );
  };

  const openForm = (prize = null) => {
    if (prize) {
      setFormData({
          ...prize,
          link_type: prize.link_type || 'teacher',
      });
    } else {
      setFormData({
        id: null, title: '', type: 'coupon', discount_type: 'percentage',
        discount_value: 0, validity_days: 7, total_stock: 10, 
        link_type: 'teacher', teacher_id: '', course_id: '', subject_id: '', is_active: true
      });
    }
    setShowModal(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (formData.type === 'coupon') {
        if (formData.link_type === 'teacher' && !formData.teacher_id) return showToast('يجب اختيار المدرس!', 'error');
        if (formData.link_type === 'course' && !formData.course_id) return showToast('يجب اختيار الكورس!', 'error');
        if (formData.link_type === 'subject' && !formData.subject_id) return showToast('يجب اختيار المادة!', 'error');
    }
    executeAction('save_prize', formData);
  };

  // استخراج الأسماء لعرضها في زر الاختيار
  const selectedTeacherName = teachers.find(t => t.id == formData.teacher_id)?.name || '';
  const selectedCourseName = courses.find(c => c.id == formData.course_id)?.title || '';
  let selectedSubjectName = '';
  if (formData.subject_id) {
      courses.forEach(c => {
          const s = c.subjects?.find(sub => sub.id == formData.subject_id);
          if (s) selectedSubjectName = s.title;
      });
  }

  // خيارات القوائم المنسدلة الاحترافية
  const prizeTypeOptions = [
      { value: 'coupon', label: 'كوبون خصم (يُولد تلقائياً)', icon: IconTicket },
      { value: 'material', label: 'جائزة مادية (تسليم يدوي)', icon: IconGift },
      { value: 'nothing', label: 'حظ أوفر (بدون جائزة)', icon: IconFrown }
  ];

  const discountTypeOptions = [
      { value: 'percentage', label: 'نسبة مئوية (%)', icon: IconPercent },
      { value: 'fixed', label: 'مبلغ ثابت (ج.م)', icon: IconMoney }
  ];

  return (
    <SuperLayout title="إدارة عجلة الحظ المتقدمة">
      <div className={`toast ${toast.show ? 'show' : ''} ${toast.type}`}>
          <div className="flex-center gap-2">
              {toast.type === 'success' ? <IconCheck size={18}/> : <IconWarning size={18}/>}
              {toast.msg}
          </div>
      </div>

      <div className="page-header">
        <div>
          <h1 className="flex-center gap-2">
              <IconWheel size={32} style={{ color: 'var(--gold)' }} />
              إدارة عجلة الحظ ونظام الجوائز
          </h1>
          <p>تجهيز الكتالوج، متابعة الفائزين، والتحكم في حالة الحملة</p>
        </div>
        <div className="header-actions">
          <button className={`btn flex-center gap-2 ${isWheelEnabled ? 'danger-btn' : 'success'}`} onClick={handleToggleWheel}>
            {isWheelEnabled ? <><IconPower size={18}/> إلغاء تفعيل العجلة بالكامل</> : <><IconPower size={18}/> تشغيل وتفعيل العجلة</>}
          </button>
          <button className="btn warning flex-center gap-2" onClick={() => showConfirm('هل أنت متأكد من مسح سجل المشاركات؟ سيتمكن الطلاب من اللعب مرة أخرى.', () => executeAction('reset_spins'))}>
              <IconRefresh size={18}/> تصفير السجل
          </button>
          <button className="btn primary flex-center gap-2" onClick={() => showConfirm('هل أنت متأكد من تفعيل الحملة؟ سيتم خلط التذاكر بناءً على الجوائز الحالية المتاحة بالمخزون.', () => executeAction('activate_campaign'))}>
            <IconRocket size={18}/> تفعيل الحملة وخلط الصندوق
          </button>
        </div>
      </div>

      <div className="stats-grid">
         <div className="stat-card">
            <h3 className="flex-center justify-center gap-2"><IconSettings size={18}/> حالة نظام العجلة</h3>
            <div className={`val ${isWheelEnabled ? 'green-text' : 'red-text'}`}>
                {isWheelEnabled ? 'نشط ومفعل' : 'معطل ومغلق'}
            </div>
         </div>
         <div className="stat-card">
            <h3 className="flex-center justify-center gap-2"><IconTicket size={18}/> تذاكر جاهزة بالصندوق</h3>
            <div className="val blue">{stats.poolCount}</div>
            <p>متبقية للسحب الفوري</p>
         </div>
         <div className="stat-card">
            <h3 className="flex-center justify-center gap-2"><IconUsers size={18}/> إجمالي الطلاب الفائزين</h3>
            <div className="val green">{stats.spinsCount}</div>
            <p>قاموا بتدوير العجلة</p>
         </div>
      </div>

      <div className="panel" style={{ marginBottom: '30px' }}>
        <div className="panel-header">
           <h2 className="flex-center gap-2"><IconGift style={{color:'var(--gold)'}}/> كتالوج وإعدادات الجوائز المتاحة</h2>
           <button className="btn primary flex-center gap-2" onClick={() => openForm()}><IconPlus size={16}/> إضافة جائزة جديدة</button>
        </div>
        <div className="table-responsive">
          <table className="codes-table">
            <thead>
              <tr>
                <th>الجائزة</th>
                <th>النوع والخصم</th>
                <th>المخزون الحالي</th>
                <th>الارتباط (الهدف)</th>
                <th>حالة القطعة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {prizes.map(p => (
                <tr key={p.id}>
                  <td style={{fontWeight:'bold', color:'var(--text-primary)'}}>{p.title}</td>
                  <td>
                      <div className="flex-center gap-2" style={{color: p.type === 'coupon' ? '#4ade80' : p.type === 'material' ? '#facc15' : '#f87171'}}>
                          {p.type === 'coupon' ? <IconTicket size={16}/> : p.type === 'material' ? <IconGift size={16}/> : <IconFrown size={16}/>}
                          {p.type === 'coupon' ? 'كوبون خصم' : p.type === 'material' ? 'جائزة مادية' : 'حظ أوفر'}
                      </div>
                      {p.type === 'coupon' && <div className="sub-txt mt-1">{p.discount_value} {p.discount_type === 'percentage' ? '%' : 'ج.م'}</div>}
                  </td>
                  <td><span className="stock-badge">{p.total_stock}</span></td>
                  
                  <td className="sub-txt">
                      {p.type === 'coupon' ? (
                          <div className="flex-center gap-1">
                              {p.link_type === 'teacher' && <span className="color-teacher flex-center gap-1"><IconTeacher size={14}/> مدرس: {p.teachers?.name || 'غير محدد'}</span>}
                              {p.link_type === 'course' && <span className="color-course flex-center gap-1"><IconCourse size={14}/> كورس: {p.courses?.title || 'غير محدد'}</span>}
                              {p.link_type === 'subject' && <span className="color-subject flex-center gap-1"><IconSubject size={14}/> مادة: {p.subjects?.title || 'غير محدد'}</span>}
                              {!p.link_type && (p.teachers?.name || '-')}
                          </div>
                      ) : '-'}
                  </td>
                  
                  <td>
                      {p.is_active ? 
                          <span className="status-badge active flex-center gap-1"><IconCheck size={12}/> مفعلة</span> : 
                          <span className="status-badge expired flex-center gap-1"><IconX size={12}/> معطلة</span>
                      }
                  </td>
                  <td>
                    <div className="actions-cell">
                       <button className="icon-btn edit flex-center justify-center" onClick={() => openForm(p)} title="تعديل"><IconEdit size={16}/></button>
                       <button className="icon-btn delete flex-center justify-center" onClick={() => showConfirm('تأكيد حذف الجائزة نهائياً؟', () => executeAction('delete_prize', { id: p.id }))} title="حذف"><IconTrash size={16}/></button>
                    </div>
                  </td>
                </tr>
              ))}
              {prizes.length === 0 && !loading && (
                  <tr>
                      <td colSpan="6" className="empty-table">لا توجد جوائز في الكتالوج حتى الآن.</td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
           <h2 className="flex-center gap-2"><IconUsers style={{color:'var(--gold)'}}/> سجل الطلاب الفائزين (المشاركات)</h2>
        </div>
        <div className="table-responsive">
          <table className="codes-table">
            <thead>
              <tr>
                <th># معرف الفوز</th>
                <th>اسم الطالب الفائز</th>
                <th>رقم الهاتف</th>
                <th>الجائزة التي ربحها</th>
                <th>كود الخصم الممنوح</th>
                <th>تاريخ وساعة الفوز</th>
              </tr>
            </thead>
            <tbody>
              {winners.map(w => (
                <tr key={w.id}>
                  <td style={{ fontFamily: 'monospace' }}>#{w.id}</td>
                  <td style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{w.student_name}</td>
                  <td dir="ltr" style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{w.student_phone}</td>
                  <td>
                     {w.wheel_prizes ? (
                        <span className={`type-tag flex-center gap-1 ${w.wheel_prizes.type}`}>
                          {w.wheel_prizes.type === 'coupon' ? <IconTicket size={14}/> : w.wheel_prizes.type === 'material' ? <IconGift size={14}/> : <IconFrown size={14}/>}
                          {w.wheel_prizes.title}
                        </span>
                     ) : <span className="red-text flex-center gap-1"><IconTrash size={14}/> جائزة ممسوحة</span>}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#10b981' }}>
                     {w.coupon_code || '_'}
                  </td>
                  <td className="sub-txt">{new Date(w.created_at).toLocaleString('ar-EG')}</td>
                </tr>
              ))}
              {winners.length === 0 && !loading && (
                <tr>
                  <td colSpan="6" className="empty-table">
                    لا توجد عمليات فوز مسجلة حتى الآن.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ✅ المودال الأساسي لإضافة وتعديل الجائزة */}
      {showModal && (
        <div className="modal-overlay blur-bg" onClick={() => setShowModal(false)}>
           <div className="modal-box" onClick={e => e.stopPropagation()}>
              <div className="modal-head">
                 <h3 className="flex-center gap-2">
                     {formData.id ? <><IconEdit size={20} style={{color:'var(--gold)'}}/> تعديل الجائزة</> : <><IconPlus size={20} style={{color:'var(--gold)'}}/> إضافة جائزة جديدة</>}
                 </h3>
                 <button onClick={() => setShowModal(false)} className="close-btn"><IconX size={20}/></button>
              </div>
              <form onSubmit={handleSave} className="modal-body">
                 <div className="form-group">
                    <label>الاسم (الذي يظهر للطلاب على العجلة)</label>
                    <input className="input" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="مثال: خصم 50% / حظ أوفر المرة القادمة" />
                 </div>
                 <div className="grid-2">
                    <div className="form-group z-index-2">
                        <label>نوع الجائزة</label>
                        <CustomDropdown 
                            options={prizeTypeOptions} 
                            value={formData.type} 
                            onChange={(val) => setFormData({...formData, type: val})}
                        />
                    </div>
                    <div className="form-group">
                        <label>المخزون الكلي المتاح لسحب الجائزة</label>
                        <input className="input" type="number" required min="0" value={formData.total_stock} onChange={e => setFormData({...formData, total_stock: e.target.value})} />
                    </div>
                 </div>

                 {formData.type === 'coupon' && (
                     <div className="coupon-box">
                         <h4 className="flex-center gap-2"><IconSettings size={18}/> إعدادات توليد الكوبون التلقائي</h4>
                         
                         <div className="form-group">
                             <label>الهدف من الكوبون (نطاق الخصم):</label>
                             <div className="radio-group">
                                <label className="radio-label color-teacher">
                                    <input type="radio" name="wLinkType" checked={formData.link_type === 'teacher'} onChange={() => setFormData({...formData, link_type: 'teacher', course_id: '', subject_id: ''})} /> مدرس
                                </label>
                                <label className="radio-label color-course">
                                    <input type="radio" name="wLinkType" checked={formData.link_type === 'course'} onChange={() => setFormData({...formData, link_type: 'course', teacher_id: '', subject_id: ''})} /> كورس
                                </label>
                                <label className="radio-label color-subject">
                                    <input type="radio" name="wLinkType" checked={formData.link_type === 'subject'} onChange={() => setFormData({...formData, link_type: 'subject', teacher_id: '', course_id: ''})} /> مادة
                                </label>
                             </div>
                             
                             {/* ✅ أزرار الاختيار الاحترافية */}
                             {formData.link_type === 'teacher' && (
                                 <div className="selection-trigger" onClick={() => setTargetSelectionModal({ show: true, type: 'teacher' })}>
                                     {selectedTeacherName ? <span className="color-teacher flex-center justify-center gap-2"><IconTeacher size={16}/> {selectedTeacherName}</span> : <span className="flex-center justify-center gap-2"><IconSearch size={16}/> اضغط لاختيار المدرس...</span>}
                                 </div>
                             )}

                             {formData.link_type === 'course' && (
                                 <div className="selection-trigger" onClick={() => setTargetSelectionModal({ show: true, type: 'course' })}>
                                     {selectedCourseName ? <span className="color-course flex-center justify-center gap-2"><IconCourse size={16}/> {selectedCourseName}</span> : <span className="flex-center justify-center gap-2"><IconSearch size={16}/> اضغط لاختيار الكورس...</span>}
                                 </div>
                             )}

                             {formData.link_type === 'subject' && (
                                 <div className="selection-trigger" onClick={() => setTargetSelectionModal({ show: true, type: 'subject' })}>
                                     {selectedSubjectName ? <span className="color-subject flex-center justify-center gap-2"><IconSubject size={16}/> {selectedSubjectName}</span> : <span className="flex-center justify-center gap-2"><IconSearch size={16}/> اضغط لاختيار المادة...</span>}
                                 </div>
                             )}
                         </div>

                         <div className="grid-2 mt-2">
                             <div className="form-group z-index-1">
                                 <label>نوع قيمة الخصم</label>
                                 <CustomDropdown 
                                    options={discountTypeOptions} 
                                    value={formData.discount_type} 
                                    onChange={(val) => setFormData({...formData, discount_type: val})}
                                 />
                             </div>
                             <div className="form-group">
                                 <label>القيمة المخصومة</label>
                                 <input className="input" type="number" min="1" required value={formData.discount_value} onChange={e => setFormData({...formData, discount_value: e.target.value})} />
                             </div>
                             <div className="form-group" style={{gridColumn: '1 / -1'}}>
                                 <label>صلاحية الكوبون بعد الفوز (أيام)</label>
                                 <input className="input" type="number" min="1" required value={formData.validity_days} onChange={e => setFormData({...formData, validity_days: e.target.value})} />
                             </div>
                         </div>
                     </div>
                 )}

                 <div className="form-group mt-2">
                     <label className="checkbox-expiration">
                         <input type="checkbox" className="custom-check" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} />
                         <span>تفعيل الجائزة ضمن السحب المباشر للعجلة</span>
                     </label>
                 </div>
                 
                 <div className="modal-footer">
                    <button type="button" className="btn cancel" onClick={() => setShowModal(false)}>إلغاء</button>
                    <button type="submit" className="btn primary flex-center gap-2"><IconSave size={18}/> حفظ التغييرات</button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* ✅ نافذة اختيار الهدف الاحترافية (Target Selection Modal) */}
      {targetSelectionModal.show && (
          <div className="modal-overlay blur-bg" style={{ zIndex: 1100 }} onClick={() => setTargetSelectionModal({ show: false, type: '' })}>
              <div className="modal-box target-selection-box" onClick={e => e.stopPropagation()}>
                  <div className="modal-head" style={{borderBottom: '1px solid var(--border)', paddingBottom: '15px', background: 'transparent'}}>
                      <h3 style={{margin: 0, fontSize: '1.2rem'}} className="flex-center gap-2">
                          {targetSelectionModal.type === 'teacher' ? <><IconTeacher size={22} style={{color:'var(--gold)'}}/> اختر المدرس</> :
                           targetSelectionModal.type === 'course' ? <><IconCourse size={22} style={{color:'var(--gold)'}}/> اختر الكورس</> : <><IconSubject size={22} style={{color:'var(--gold)'}}/> اختر المادة</>}
                      </h3>
                      <button className="close-btn" onClick={() => setTargetSelectionModal({ show: false, type: '' })}><IconX size={24}/></button>
                  </div>
                  
                  <div className="target-list">
                      {targetSelectionModal.type === 'teacher' && teachers.map(t => (
                          <div key={t.id} className={`target-item ${formData.teacher_id == t.id ? 'active' : ''}`} onClick={() => { setFormData({...formData, teacher_id: t.id}); setTargetSelectionModal({show: false, type: ''}); }}>
                              <span>{t.name}</span>
                          </div>
                      ))}

                      {targetSelectionModal.type === 'course' && courses.map(c => (
                          <div key={c.id} className={`target-item ${formData.course_id == c.id ? 'active' : ''}`} onClick={() => { setFormData({...formData, course_id: c.id}); setTargetSelectionModal({show: false, type: ''}); }}>
                              <span>{c.title}</span>
                          </div>
                      ))}

                      {targetSelectionModal.type === 'subject' && courses.map(c => (
                          <div key={c.id} className="subject-group">
                              <div className="subject-group-title">كورس: {c.title}</div>
                              {c.subjects?.map(s => (
                                  <div key={s.id} className={`target-item subject ${formData.subject_id == s.id ? 'active' : ''}`} onClick={() => { setFormData({...formData, subject_id: s.id}); setTargetSelectionModal({show: false, type: ''}); }}>
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

      {/* نافذة التأكيد */}
      {confirmData.show && (
          <div className="modal-overlay blur-bg" style={{ zIndex: 1200 }}>
              <div className="modal-box confirm-box">
                  <div className="modal-icon-header warning">
                      <IconWarning size={32} />
                  </div>
                  <h3 className="modal-title" style={{marginBottom: '15px'}}>تأكيد الإجراء الأمني</h3>
                  <p className="modal-desc">{confirmData.msg}</p>
                  <div className="modal-footer centered" style={{marginTop: '25px'}}>
                      <button className="btn cancel" onClick={() => setConfirmData({show:false})}>تراجع</button>
                      <button className="btn success" onClick={confirmData.action}>نعم، نفذ الآن</button>
                  </div>
              </div>
          </div>
      )}

      <style jsx>{`
        /* ==================== Utilities ==================== */
        .flex-center { display: flex; align-items: center; }
        .justify-center { justify-content: center; }
        .gap-1 { gap: 6px; }
        .gap-2 { gap: 10px; }
        .mt-1 { margin-top: 5px; }
        .mt-2 { margin-top: 15px; } 
        .m-0 { margin: 0; }
        
        .z-index-2 { z-index: 2; }
        .z-index-1 { z-index: 1; }

        /* ==================== Colors / Theme Logic ==================== */
        .color-teacher { color: #3b82f6; }
        .color-course { color: #22c55e; }
        .color-subject { color: #eab308; }
        
        .layout-root.light .color-teacher { color: #2563eb; }
        .layout-root.light .color-course { color: #16a34a; }
        .layout-root.light .color-subject { color: #ca8a04; }

        .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; border-bottom: 1px solid var(--border); padding-bottom: 20px; flex-wrap: wrap; gap: 15px; color: var(--text-primary); }
        .page-header h1 { margin: 0 0 5px 0; color: var(--text-primary); font-size: 1.8rem; }
        .page-header p { margin: 0; color: var(--text-secondary); }
        
        .header-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        
        .btn { padding: 10px 20px; border-radius: 8px; border: none; font-weight: bold; cursor: pointer; transition: 0.2s; font-size: 0.95rem; }
        .btn:hover { transform: translateY(-2px); filter: brightness(1.1); box-shadow: 0 4px 10px rgba(0,0,0,0.15); }
        .btn.primary { background: var(--gold); color: #111009; }
        .btn.success { background: #22c55e; color: #fff; }
        .btn.warning { background: transparent; border: 1px solid #f59e0b; color: #f59e0b; }
        .btn.warning:hover { background: rgba(245, 158, 11, 0.1); }
        .btn.cancel { background: var(--bg-base); border: 1px solid var(--border); color: var(--text-secondary); }
        .btn.cancel:hover { background: var(--bg-hover); color: var(--text-primary); }
        .danger-btn { background: #ef4444; color: white; } 
        .danger-btn:hover { background: #dc2626; }

        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: var(--bg-surface); padding: 20px; border-radius: 12px; border: 1px solid var(--border); text-align: center; box-shadow: var(--shadow); }
        .stat-card h3 { margin: 0 0 10px 0; color: var(--text-secondary); font-size: 1rem; }
        .stat-card .val { font-size: 2.2rem; font-weight: bold; color: var(--text-primary); margin: 5px 0;}
        .stat-card p { color: var(--text-muted); font-size: 0.85rem; margin: 0; }
        .stat-card .val.blue { color: #3b82f6; } .stat-card .val.green { color: #10b981; }
        .green-text { color: #10b981 !important; font-weight: bold; font-size: 1.1rem; } 
        .red-text { color: #ef4444 !important; font-weight: bold; font-size: 1.1rem; }
        
        .panel { background: var(--bg-surface); border-radius: 12px; border: 1px solid var(--border); overflow: hidden; box-shadow: var(--shadow); }
        .panel-header { display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid var(--border); background: var(--bg-elevated); }
        .panel-header h2 { margin: 0; font-size: 1.2rem; color: var(--text-primary); }
        
        /* ==================== Tables ==================== */
        .table-responsive { overflow-x: auto; }
        .codes-table { width: 100%; border-collapse: collapse; text-align: right; }
        .codes-table th { padding: 15px 20px; background: var(--bg-elevated); color: var(--text-secondary); font-size: 0.9rem; border-bottom: 1px solid var(--border); white-space: nowrap; font-weight: bold; text-transform: uppercase; }
        .codes-table td { padding: 15px 20px; border-bottom: 1px solid var(--border); vertical-align: middle; color: var(--text-primary); }
        .codes-table tr:hover { background: var(--bg-hover); }
        .empty-table { text-align: center; padding: 50px !important; color: var(--text-muted); font-size: 1.1rem; font-weight: bold;}
        
        .sub-txt { font-size: 0.85em; color: var(--text-secondary); }
        .stock-badge { background: var(--gold-dimmer); color: var(--gold); padding: 4px 12px; border-radius: 20px; font-weight: bold; border: 1px solid var(--border-accent); }
        
        .type-tag { padding: 4px 10px; border-radius: 6px; font-size: 0.85rem; font-weight: bold; background: var(--bg-hover); color: var(--text-primary); display: inline-flex;}
        .type-tag.coupon { color: #10b981; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); }
        .type-tag.material { color: #eab308; background: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.2); }
        .type-tag.nothing { color: #ef4444; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); }
        
        .actions-cell { display: flex; gap: 8px; }
        .icon-btn { background: transparent; border: 1px solid var(--border); width: 32px; height: 32px; border-radius: 8px; cursor: pointer; transition: 0.2s; color: var(--text-secondary); }
        .icon-btn.edit:hover { background: rgba(234, 179, 8, 0.1); color: #eab308; border-color: #eab308;} 
        .icon-btn.delete:hover { background: rgba(239, 68, 68, 0.1); color: #ef4444; border-color: #ef4444;}
        
        .status-badge { padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; width: fit-content;}
        .status-badge.used { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
        .status-badge.active { background: rgba(34, 197, 94, 0.1); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.2); }
        .status-badge.expired { background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2); }

        /* ==================== Modals (Premium Design) ==================== */
        .blur-bg { backdrop-filter: blur(5px); }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 1000; display: flex; justify-content: center; align-items: center; animation: fadeIn 0.2s ease-out; }
        .modal-box { background: var(--bg-surface); width: 95%; max-width: 600px; border-radius: 16px; border: 1px solid var(--border-accent); overflow: hidden; max-height: 90vh; display: flex; flex-direction: column; box-shadow: var(--shadow); animation: scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .confirm-box { max-width: 400px; padding: 25px; text-align: center; display: block; }
        
        .modal-head { display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid var(--border); background: var(--bg-elevated); flex-shrink: 0; }
        .modal-head h3 { margin: 0; color: var(--text-primary); font-size: 1.25rem; }
        .close-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; padding: 0;}
        .close-btn:hover { color: #ef4444; }
        
        .modal-title { color: var(--text-primary); margin: 0; font-size: 1.3rem; }
        .modal-desc { color: var(--text-secondary); font-size: 0.95rem; line-height: 1.5; margin: 0; }
        .modal-icon-header { width: 70px; height: 70px; border-radius: 50%; display: flex; justify-content: center; align-items: center; margin: 0 auto 20px auto; }
        .modal-icon-header.warning { background: rgba(249, 115, 22, 0.1); border: 2px solid #f97316; color: #f97316;}

        .modal-body { padding: 20px; overflow-y: auto; }
        .modal-body::-webkit-scrollbar { width: 6px; }
        .modal-body::-webkit-scrollbar-track { background: var(--bg-base); }
        .modal-body::-webkit-scrollbar-thumb { background: var(--border-accent); border-radius: 4px; }

        /* ==================== Custom Dropdown ==================== */
        .custom-dropdown-container { position: relative; width: 100%; }
        .custom-dropdown-trigger { 
          width: 100%; display: flex; align-items: center; justify-content: space-between;
          background: var(--bg-base); color: var(--text-primary); 
          padding: 12px 15px; border: 1px solid var(--border); border-radius: 8px; 
          font-size: 0.95rem; cursor: pointer; transition: all 0.2s; font-family: inherit; height: 46px;
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
          list-style: none; padding: 6px 0; margin: 0; max-height: 200px; overflow-y: auto;
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

        /* ==================== Form Fields ==================== */
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; color: var(--text-secondary); margin-bottom: 8px; font-size: 0.9rem; font-weight: bold; }
        .input { width: 100%; padding: 12px 15px; background: var(--bg-base); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); outline: none; transition: 0.2s; font-family: inherit; height: 46px; }
        .input:focus { border-color: var(--gold); }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        
        .radio-group { display: flex; gap: 15px; margin-bottom: 10px; flex-wrap: wrap; }
        .radio-label { display: flex; align-items: center; gap: 6px; font-weight: bold; cursor: pointer; }
        
        .checkbox-expiration { display: flex; align-items: center; gap: 10px; cursor: pointer; background: var(--bg-elevated); padding: 12px 15px; border-radius: 8px; border: 1px solid var(--border); color: var(--text-primary); font-weight: bold; transition: 0.2s; width: 100%; }
        .checkbox-expiration:hover { border-color: var(--gold); }
        .custom-check { width: 20px; height: 20px; accent-color: var(--gold); cursor: pointer; flex-shrink: 0; }

        .coupon-box { background: var(--bg-hover); border: 1px dashed var(--border-accent); padding: 20px; border-radius: 12px; margin-top: 15px; }
        .coupon-box h4 { margin: 0 0 15px 0; color: var(--gold); }
        
        .modal-footer { padding-top: 20px; margin-top: 10px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 10px; flex-shrink: 0; }
        .modal-footer.centered { justify-content: center; border: none; padding-top: 0; }

        /* ✅ التنسيقات الخاصة بنافذة اختيار الهدف */
        .selection-trigger { width: 100%; padding: 15px; border-radius: 8px; border: 1px dashed var(--border-accent); background: var(--bg-elevated); color: var(--text-muted); cursor: pointer; text-align: center; font-weight: bold; transition: 0.3s; font-size: 1rem; }
        .selection-trigger:hover { background: var(--gold-dimmer); border-style: solid; color: var(--gold); }
        
        .target-selection-box { max-width: 550px !important; padding: 20px; background: var(--bg-surface); border: 1px solid var(--border-accent); }
        .target-list { overflow-y: auto; margin-top: 15px; display: flex; flex-direction: column; gap: 8px; padding-right: 5px; max-height: 50vh; }
        .target-list::-webkit-scrollbar { width: 6px; }
        .target-list::-webkit-scrollbar-track { background: var(--bg-base); border-radius: 10px; }
        .target-list::-webkit-scrollbar-thumb { background: var(--border-accent); border-radius: 10px; }
        
        .target-item { padding: 12px 15px; background: var(--bg-base); border: 1px solid var(--border); border-radius: 8px; cursor: pointer; transition: 0.2s; color: var(--text-primary); font-weight: bold; display: flex; align-items: center;}
        .target-item:hover { border-color: var(--gold); background: var(--gold-dimmer); }
        .target-item.active { background: var(--gold); color: #111009; border-color: var(--gold); }
        
        .subject-group { margin-bottom: 12px; background: var(--bg-elevated); padding: 15px; border-radius: 12px; border: 1px solid var(--border);}
        .subject-group-title { font-size: 0.95rem; color: var(--gold); margin-bottom: 12px; font-weight: bold; border-bottom: 1px dashed var(--border); padding-bottom: 8px;}
        .target-item.subject { margin-bottom: 8px; background: var(--bg-surface); }
        .empty-msg { text-align: center; color: var(--text-muted); margin-top: 20px; font-weight: bold; padding: 20px;}

        /* ==================== Toasts ==================== */
        .toast { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%) translateY(100px); background: var(--bg-elevated); color: var(--text-primary); padding: 12px 25px; border-radius: 50px; font-weight: bold; box-shadow: var(--shadow); z-index: 20000; transition: 0.4s; opacity: 0; border: 1px solid var(--border); }
        .toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }
        .toast.success { border-bottom: 3px solid #22c55e; }
        .toast.error { border-bottom: 3px solid #ef4444; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleUp { from { opacity: 0; transform: scale(0.9) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </SuperLayout>
  );
}
