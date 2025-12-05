import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useCallback } from 'react';
import Head from 'next/head';

// =========================================================
// 🔒 مكون الصور الآمن (SecureImage)
// يقوم بجلب الصورة عبر الهيدرز المخفية بدلاً من وضع التوكن في الرابط
// =========================================================
const SecureImage = ({ fileId }) => {
    const [imgSrc, setImgSrc] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const fetchImage = async () => {
            try {
                const uid = localStorage.getItem('auth_user_id');
                const did = localStorage.getItem('auth_device_id');
                
                const res = await fetch(`/api/exams/get-image?file_id=${fileId}`, {
                    headers: { 'x-user-id': uid, 'x-device-id': did }
                });
                
                if (!res.ok) throw new Error('Failed to load image');
                
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                
                if (isMounted) {
                    setImgSrc(url);
                    setLoading(false);
                }
            } catch (e) {
                if (isMounted) {
                    setError(true);
                    setLoading(false);
                }
            }
        };

        fetchImage();

        return () => {
            isMounted = false;
            if (imgSrc) URL.revokeObjectURL(imgSrc); // تنظيف الذاكرة
        };
    }, [fileId]);

    if (error) return <div style={{color:'red', fontSize:'12px', padding:'10px', border:'1px dashed red'}}>❌ تعذر تحميل الصورة</div>;
    if (loading) return <div style={{padding:'20px', color:'#aaa'}}>جاري تحميل الصورة...</div>;
    
    return <img src={imgSrc} alt="Question Image" className="question-image" />;
};

// =========================================================
// 📄 الصفحة الرئيسية للامتحان
// =========================================================
export default function ExamPage() {
    const router = useRouter();
    // [✅] نقرأ فقط معرف الامتحان (بيانات غير حساسة)
    const { examId } = router.query;
    
    // (حالات الواجهة)
    const [examDetails, setExamDetails] = useState(null);
    const [questions, setQuestions] = useState(null);
    const [answers, setAnswers] = useState({});
    const [timer, setTimer] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [studentName, setStudentName] = useState(""); 
    
    // (حالات تقنية)
    const attemptIdRef = useRef(null);
    const answersRef = useRef(answers); 
    const isSubmittingRef = useRef(false); 
    
    // تحديث Ref الإجابات
    useEffect(() => { answersRef.current = answers; }, [answers]);

    // ---------------------------------------------------------
    // 1. التحقق من الهوية وجلب تفاصيل الامتحان (Headers Only)
    // ---------------------------------------------------------
    useEffect(() => {
        if (!router.isReady || !examId) return;

        // أ) جلب التوكن من الذاكرة
        const uid = localStorage.getItem('auth_user_id');
        const did = localStorage.getItem('auth_device_id');

        if (!uid || !did) {
             // طرد المستخدم إذا لم يسجل دخول
             router.replace('/login');
             return;
        }
        
        // ب) طلب التفاصيل بالهيدرز
        fetch(`/api/exams/get-details?examId=${examId}`, {
            headers: { 
                'x-user-id': uid,
                'x-device-id': did 
            }
        })
        .then(res => {
            if (res.status === 403) throw new Error("⛔ غير مصرح لك (تأكد من الاشتراك أو عدم تكرار الامتحان).");
            if (!res.ok) throw new Error("فشل تحميل الامتحان.");
            return res.json();
        })
        .then(data => {
            if (data.error) throw new Error(data.error);
            setExamDetails(data.exam);
            setTimer(data.exam.duration_minutes * 60);
            setIsLoading(false);
        })
        .catch(err => {
            setError(err.message);
            setIsLoading(false);
        });
    }, [router.isReady, examId]);


    // (العداد التنازلي)
    useEffect(() => {
        if (questions && timer > 0) {
            const timerId = setTimeout(() => setTimer(timer - 1), 1000);
            return () => clearTimeout(timerId);
        } else if (questions && timer === 0) {
            console.log("Time's up!");
            handleSubmit(true); 
        }
    }, [timer, questions]); 


    // ---------------------------------------------------------
    // 2. دالة بدء الامتحان (Headers Only)
    // ---------------------------------------------------------
    const startExam = async () => {
        setIsLoading(true);
        setError(null);

        if (examDetails.requires_student_name && (!studentName || studentName.trim() === '')) {
            setError("يجب إدخال اسمك أولاً.");
            setIsLoading(false);
            return;
        }
        
        const uid = localStorage.getItem('auth_user_id');
        const did = localStorage.getItem('auth_device_id');

        try {
            const res = await fetch(`/api/exams/start-attempt`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-user-id': uid,   // ✅ الهوية في الهيدر
                    'x-device-id': did
                },
                body: JSON.stringify({ 
                    examId, 
                    // لا نرسل userId في البودي، السيرفر يأخذه من الهيدر
                    studentName: studentName.trim() 
                })
            });
            
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            
            attemptIdRef.current = data.attemptId;
            setQuestions(data.questions); 
            setIsLoading(false);
        } catch (err) {
            setError(err.message);
            setIsLoading(false);
        }
    };
    
    // ---------------------------------------------------------
    // 3. دالة الخروج الاضطراري (استبدال sendBeacon بـ fetch keepalive)
    // ---------------------------------------------------------
    const handleExitSubmit = useCallback(() => {
        if (isSubmittingRef.current || !attemptIdRef.current) return;

        console.log("Exit detected. Submitting via keepalive fetch...");
        isSubmittingRef.current = true;
        
        const uid = localStorage.getItem('auth_user_id');
        const did = localStorage.getItem('auth_device_id');

        const data = {
            attemptId: attemptIdRef.current,
            answers: answersRef.current
        };
        
        // ✅ استخدام fetch مع keepalive لدعم الهيدرز عند إغلاق الصفحة
        fetch('/api/exams/submit-attempt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': uid,
                'x-device-id': did
            },
            body: JSON.stringify(data),
            keepalive: true // هذا هو البديل الحديث لـ sendBeacon
        });
        
    }, []); 
    
    // (تأكيد الخروج للتليجرام)
    const handleBackButtonConfirm = useCallback(() => {
        if (window.Telegram && window.Telegram.WebApp) {
            window.Telegram.WebApp.showConfirm(
                "هل أنت متأكد من الخروج؟ سيتم تسليم إجاباتك الحالية.", 
                (isConfirmed) => {
                    if (isConfirmed) {
                        handleExitSubmit();
                        window.Telegram.WebApp.close();
                    }
                }
            );
        }
    }, [handleExitSubmit]); 


    // (تفعيل مراقبات الخروج)
    useEffect(() => {
        if (questions && timer > 0) {
            if (window.Telegram && window.Telegram.WebApp) {
                const twaBackButton = window.Telegram.WebApp.BackButton;
                twaBackButton.show();
                twaBackButton.onClick(handleBackButtonConfirm); 
            }
            window.addEventListener('beforeunload', handleExitSubmit);
            router.events.on('routeChangeStart', handleExitSubmit);

            return () => {
                if (window.Telegram && window.Telegram.WebApp) {
                    window.Telegram.WebApp.BackButton.offClick(handleBackButtonConfirm);
                    window.Telegram.WebApp.BackButton.hide();
                }
                window.removeEventListener('beforeunload', handleExitSubmit);
                router.events.off('routeChangeStart', handleExitSubmit);
            };
        }
    }, [questions, timer, router.events, handleExitSubmit, handleBackButtonConfirm]); 


    // ---------------------------------------------------------
    // 4. تسليم الإجابات (Headers Only)
    // ---------------------------------------------------------
    const handleSubmit = async (isAutoSubmit = false) => {
        if (!isAutoSubmit) {
            const allAnswered = questions ? Object.keys(answers).length === questions.length : false;
            if (!allAnswered) {
                alert("يجب الإجابة على جميع الأسئلة أولاً.");
                return;
            }
        }
        
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        
        // تنظيف الأحداث
        if (window.Telegram && window.Telegram.WebApp) {
            window.Telegram.WebApp.BackButton.offClick(handleBackButtonConfirm);
            window.Telegram.WebApp.BackButton.hide();
        }
        window.removeEventListener('beforeunload', handleExitSubmit);
        router.events.off('routeChangeStart', handleExitSubmit);
        
        setIsLoading(true);
        setTimer(null);

        const uid = localStorage.getItem('auth_user_id');
        const did = localStorage.getItem('auth_device_id');

        try {
            await fetch(`/api/exams/submit-attempt`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-user-id': uid,
                    'x-device-id': did
                },
                body: JSON.stringify({ 
                    attemptId: attemptIdRef.current, 
                    answers
                })
            });
            
            // ✅ التوجيه لصفحة النتائج (رابط نظيف)
            router.replace(`/results/${attemptIdRef.current}`);

        } catch (err) {
            setError("حدث خطأ أثناء إرسال الإجابات.");
            setIsLoading(false);
            isSubmittingRef.current = false; 
        }
    };

    const handleAnswerChange = (questionId, optionId) => {
        setAnswers(prev => ({ ...prev, [questionId]: optionId }));
    };

    // --- العرض (UI) ---
    
    if (isLoading) {
         return (
            <div className="app-container loader-container">
                <Head><title>جاري التحميل...</title></Head>
                <h1>جاري التحميل...</h1>
                <div className="loading-bar"></div>
            </div>
         );
    }
    
    if (error) {
        return (
            <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
                <Head><title>خطأ</title></Head>
                <h1>خطأ: {error}</h1>
                <button className="back-button" onClick={() => router.back()}>&larr; رجوع</button>
            </div>
        );
    }

    // (قبل البدء)
    if (!questions) {
        return (
            <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
                <Head><title>{examDetails.title}</title></Head>
                <div className="exam-details-box">
                    <h1>{examDetails.title}</h1>
                    <p>المدة: {examDetails.duration_minutes} دقيقة</p>
                    <p>المحاولات المسموحة: محاولة واحدة فقط</p>

                    {examDetails.requires_student_name && (
                        <input 
                            type="text" 
                            className="exam-name-input"
                            placeholder="اكتب اسمك (مطلوب)" 
                            value={studentName}
                            onChange={(e) => setStudentName(e.target.value)}
                        />
                    )}

                    <p style={{ color: '#f39c12', fontWeight: 'bold', marginTop: '15px', fontSize: '0.95em', lineHeight: '1.4' }}>
                        ⚠️ تنبيه: بمجرد بدء الامتحان، الخروج سيؤدي إلى التسليم فوراً.
                    </p>
                </div>
                <button className="button-link" onClick={startExam} style={{width: '90%', maxWidth: '400px', marginTop: '20px'}}>
                    🚀 بدء الامتحان
                </button>
            </div>
        );
    }
    
    // (أثناء الامتحان)
    const allAnswered = questions ? Object.keys(answers).length === questions.length : false;

    return (
        <div className="app-container">
            <Head><title>جاري الامتحان...</title></Head>
            
            <div className="timer-bar">
                الوقت المتبقي: {Math.floor(timer / 60)}:{('0' + (timer % 60)).slice(-2)}
            </div>
            
            {questions.map((q, index) => (
                <div key={q.id} className="question-box">
                    {q.image_file_id && (
                        <div className="question-image-container">
                            {/* ✅ استخدام المكون الآمن لعرض الصورة */}
                            <SecureImage fileId={q.image_file_id} />
                        </div>
                    )}
                    
                    <h4>{index + 1}. {q.question_text}</h4>
                    <div className="options-list">
                        {q.options.map(opt => (
                            <label key={opt.id} className="option-label">
                                <input type="radio" name={q.id} value={opt.id} onChange={() => handleAnswerChange(q.id, opt.id)} checked={answers[q.id] === opt.id} />
                                {opt.option_text}
                            </label>
                        ))}
                    </div>
                </div>
            ))}

            <button 
                className="button-link" 
                onClick={() => handleSubmit(false)}
                disabled={!allAnswered}
                style={!allAnswered ? { backgroundColor: '#555', cursor: 'not-allowed', opacity: 0.7 } : {}}
            >
                🏁 إنهاء وتسليم الإجابات
            </button>
        </div>
    );
}
