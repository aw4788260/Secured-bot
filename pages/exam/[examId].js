// pages/exam/[examId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';

export default function ExamPage() {
    const router = useRouter();
    // (جلب البيانات من الرابط)
    const { examId, userId, firstName } = router.query;
    
    // (حالات لواجهة المستخدم)
    const [examDetails, setExamDetails] = useState(null); // تفاصيل الامتحان (قبل البدء)
    const [questions, setQuestions] = useState(null); // الأسئلة (بعد البدء)
    const [answers, setAnswers] = useState({}); // إجابات الطالب
    const [timer, setTimer] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [studentName, setStudentName] = useState(decodeURIComponent(firstName || "")); // (الاسم من الرابط كقيمة أولية)

    // (حالات تقنية)
    const attemptIdRef = useRef(null); // لتخزين ID المحاولة
    const timerIntervalRef = useRef(null); // للتحكم بالعداد

    // (التحقق من المستخدم - نفس الكود الموجود في watch/[videoId].js)
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const urlUserId = urlParams.get('userId');

        if (urlUserId && urlUserId.trim() !== '') {
            // (مستخدم APK أو رابط عادي، مسموح له)
            // (جلب تفاصيل الامتحان)
            if (!examId) return;
            fetch(`/api/exams/get-details?examId=${examId}&userId=${urlUserId}`)
                .then(res => res.json())
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
        } else if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
            window.Telegram.WebApp.ready();
            const miniAppUser = window.Telegram.WebApp.initDataUnsafe?.user;
            
            if (!miniAppUser || !miniAppUser.id) {
                setError("لا يمكن التعرف على هويتك من تليجرام.");
                setIsLoading(false);
                return;
            }
            
            // (جلب تفاصيل الامتحان لمستخدم تليجرام)
            if (!examId) return;
            fetch(`/api/exams/get-details?examId=${examId}&userId=${miniAppUser.id}`)
                .then(res => res.json())
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
        } else {
            setError("وصول غير مصرح به. الرجاء الفتح من التطبيق أو تليجرام.");
            setIsLoading(false);
        }

        // (إيقاف العداد عند مغادرة الصفحة)
        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        };
    }, [examId, userId]); // (يعتمد على examId و userId)


    // (دالة بدء الامتحان)
    const startExam = async () => {
        setIsLoading(true);
        setError(null);

        // (التحقق من حقل الاسم إذا كان مطلوباً)
        if (examDetails.requires_student_name && (!studentName || studentName.trim() === '')) {
            setError("يجب إدخال اسمك أولاً.");
            setIsLoading(false);
            return;
        }

        try {
            // (هذا الـ API يجب إنشاؤه في الخطوة 5)
            const res = await fetch(`/api/exams/start-attempt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ examId, userId, studentName: studentName.trim() })
            });

            const data = await res.json();
            
            if (data.error) {
                throw new Error(data.error); // (مثل: "لقد استنفدت محاولاتك")
            }

            attemptIdRef.current = data.attemptId;
            setQuestions(data.questions); // (الأسئلة (العشوائية) القادمة من السيرفر)
            setIsLoading(false);

            // (بدء العداد)
            timerIntervalRef.current = setInterval(() => {
                setTimer(prev => {
                    if (prev <= 1) {
                        clearInterval(timerIntervalRef.current);
                        handleSubmit(true); // (إرسال تلقائي)
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

        } catch (err) {
            setError(err.message);
            setIsLoading(false);
        }
    };

    // (دالة إرسال الإجابات)
    const handleSubmit = async (isAutoSubmit = false) => {
        if (!isAutoSubmit && !allAnswered) {
             alert("يجب الإجابة على جميع الأسئلة أولاً.");
             return;
        }
        
        setIsLoading(true);
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
        }

        try {
            // (هذا الـ API يجب إنشاؤه في الخطوة 5)
            await fetch(`/api/exams/submit-attempt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ attemptId: attemptIdRef.current, answers })
            });
            
            // (الانتقال لصفحة النتائج)
            router.push(`/results/${attemptIdRef.current}?userId=${userId}&firstName=${encodeURIComponent(firstName || "")}`);

        } catch (err) {
            setError("حدث خطأ أثناء إرسال الإجابات.");
            setIsLoading(false);
        }
    };

    // (تخزين الإجابات عند الاختيار)
    const handleAnswerChange = (questionId, optionId) => {
        setAnswers(prev => ({ ...prev, [questionId]: optionId }));
    };

    // --- العرض (Render) ---
    
    if (isLoading) {
         return (
            <div className="app-container loader-container">
                <Head><title>جاري التحميل...</title></Head>
                <h1>جاري تحميل الامتحان...</h1>
                <div className="loading-bar"></div>
            </div>
         );
    }
    
    if (error) {
        return (
            <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
                <Head><title>خطأ</title></Head>
                <h1>خطأ: {error}</h1>
                <button className="back-button" onClick={() => router.back()}>
                    &larr; رجوع
                </button>
            </div>
        );
    }

    // (الحالة 1: عرض تفاصيل الامتحان - قبل البدء)
    if (!questions) {
        return (
            <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
                <Head><title>{examDetails.title}</title></Head>
                <div className="exam-details-box">
                    <h1>{examDetails.title}</h1>
                    <p>المدة: {examDetails.duration_minutes} دقيقة</p>
                    <p>المحاولات المسموحة: {examDetails.allowed_attempts || 'غير محدود'}</p>
                    
                    {examDetails.requires_student_name && (
                        <input 
                            type="text" 
                            className="exam-name-input"
                            placeholder="اكتب اسمك (مطلوب)" 
                            value={studentName}
                            onChange={(e) => setStudentName(e.target.value)}
                        />
                    )}
                </div>
                <button className="button-link" onClick={startExam} style={{width: '90%', maxWidth: '400px', marginTop: '20px'}}>
                    🚀 بدء الامتحان
                </button>
            </div>
        );
    }
    
    // (الحالة 2: عرض أسئلة الامتحان - بعد البدء)
    const allAnswered = questions ? Object.keys(answers).length === questions.length : false;

    return (
        <div className="app-container">
            <Head><title>جاري الامتحان...</title></Head>
            
            {/* 1. العداد */}
            <div className="timer-bar">
                الوقت المتبقي: {Math.floor(timer / 60)}:{('0' + (timer % 60)).slice(-2)}
            </div>
            
            {/* 2. الأسئلة (كل سؤال في مربع) */}
            {questions.map((q, index) => (
                <div key={q.id} className="question-box">
                    <h4>{index + 1}. {q.question_text}</h4>
                    <div className="options-list">
                        {q.options.map(opt => (
                            <label key={opt.id} className="option-label">
                                <input 
                                    type="radio" 
                                    name={q.id} 
                                    value={opt.id}
                                    onChange={() => handleAnswerChange(q.id, opt.id)}
                                    checked={answers[q.id] === opt.id}
                                />
                                {opt.option_text}
                            </label>
                        ))}
                    </div>
                </div>
            ))}

            {/* 3. زر الإنهاء (يتم تفعيله فقط بعد إجابة الكل) */}
            <button 
                className="button-link" 
                onClick={() => handleSubmit(false)}
                disabled={!allAnswered}
                style={!allAnswered ? { backgroundColor: '#555', cursor: 'not-allowed', opacity: 0.7 } : {}}
                title={!allAnswered ? "يجب الإجابة على جميع الأسئلة" : "إنهاء وتسليم الإجابات"}
            >
                🏁 إنهاء وتسليم الإجابات
            </button>
        </div>
    );
}
