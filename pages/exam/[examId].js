// pages/exam/[examId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useCallback } from 'react';
import Head from 'next/head';

export default function ExamPage() {
    const router = useRouter();
    // (جلب البيانات من الرابط)
    const { examId, userId, firstName } = router.query;
    
    // (حالات لواجهة المستخدم)
    const [examDetails, setExamDetails] = useState(null); // تفاصيل الامتحان (قبل البدء)
    const [questions, setQuestions] = useState(null); // الأسئلة (بعد البدء)
    const [answers, setAnswers] = useState({}); // إجابات الطالب
    const [timer, setTimer] = useState(null); // (سيتم تعيينه عند جلب التفاصيل)
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [studentName, setStudentName] = useState(""); 

    // (حالات تقنية)
    const attemptIdRef = useRef(null); // لتخزين ID المحاولة
    const timerIntervalRef = useRef(null); // للتحكم بالعداد

    // (Refs لحفظ الإجابات ومنع الإرسال المزدوج)
    const answersRef = useRef(answers); 
    const isSubmittingRef = useRef(false); 
    
    // (دالة لتحديث Ref الإجابات كلما تغيرت الحالة)
    useEffect(() => {
        answersRef.current = answers;
    }, [answers]);


    // (التحقق من المستخدم)
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const urlUserId = urlParams.get('userId');
        let effectiveUserId = null;

        if (urlUserId && urlUserId.trim() !== '') {
            effectiveUserId = urlUserId;
        } else if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
            window.Telegram.WebApp.ready();
            const miniAppUser = window.Telegram.WebApp.initDataUnsafe?.user;
            if (miniAppUser && miniAppUser.id) {
                effectiveUserId = miniAppUser.id.toString();
            }
        }

        if (!effectiveUserId || !examId) {
             setError("لا يمكن التعرف على هويتك أو على الامتحان.");
             setIsLoading(false);
             return;
        }
        
        // (جلب تفاصيل الامتحان)
        fetch(`/api/exams/get-details?examId=${examId}&userId=${effectiveUserId}`)
            .then(res => res.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                setExamDetails(data.exam);
                setTimer(data.exam.duration_minutes * 60); // (تعيين العداد هنا)
                setIsLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setIsLoading(false);
            });
    }, [examId, userId]); // (يعتمد على examId و userId)


    // (العداد التنازلي)
    useEffect(() => {
        if (questions && timer > 0) {
            const timerId = setTimeout(() => {
                setTimer(timer - 1);
            }, 1000);
            return () => clearTimeout(timerId);
        } 
        else if (questions && timer === 0) {
            console.log("Time's up! Auto-submitting...");
            handleSubmit(true); 
        }
    }, [timer, questions]); 


    // (دالة بدء الامتحان)
    const startExam = async () => {
        setIsLoading(true);
        setError(null);

        if (examDetails.requires_student_name && (!studentName || studentName.trim() === '')) {
            setError("يجب إدخال اسمك أولاً.");
            setIsLoading(false);
            return;
        }
        
        const urlParams = new URLSearchParams(window.location.search);
        const currentUserId = urlParams.get('userId') || window.Telegram.WebApp.initDataUnsafe?.user?.id.toString();

        try {
            const res = await fetch(`/api/exams/start-attempt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ examId, userId: currentUserId, studentName: studentName.trim() })
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
    
    // (دالة الإرسال عند الخروج - باستخدام sendBeacon)
    const handleExitSubmit = useCallback(() => {
        if (isSubmittingRef.current) return;
        if (!attemptIdRef.current) return;

        console.log("Exit detected. Force submitting answers via sendBeacon...");
        isSubmittingRef.current = true;
        
        const data = {
            attemptId: attemptIdRef.current,
            answers: answersRef.current 
        };
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        
        navigator.sendBeacon('/api/exams/submit-attempt', blob);
        
    }, []); // (هذه الدالة لا تعتمد على أي شيء متغير، فهي تقرأ من Refs)

    
    // --- [ ✅✅ معدل: دالة تأكيد الخروج (لزر الرجوع) ] ---
    const handleBackButtonConfirm = useCallback(() => {
        if (window.Telegram && window.Telegram.WebApp) {
            window.Telegram.WebApp.showConfirm(
                "هل أنت متأكد من الخروج؟ سيتم تسليم إجاباتك الحالية وإنهاء الامتحان.", 
                (isConfirmed) => {
                    if (isConfirmed) {
                        // (1. قم بالتسليم)
                        handleExitSubmit();
                        // (2. [ ✅✅ هذا هو الإصلاح ] قم بالإغلاق)
                        window.Telegram.WebApp.close();
                    }
                }
            );
        }
    }, [handleExitSubmit]); // (تعتمد على دالة الإرسال)
    // --- [ نهاية التعديل ] ---


    // (Effect لتفعيل رصد الخروج)
    useEffect(() => {
        if (questions && timer > 0) {
            
            // --- 1. رصد زر الرجوع (تليجرام فقط) ---
            if (window.Telegram && window.Telegram.WebApp) {
                const twaBackButton = window.Telegram.WebApp.BackButton;
                twaBackButton.show();
                twaBackButton.onClick(handleBackButtonConfirm); 
            }
            
            // --- 2. رصد إغلاق الصفحة/التحديث (للمتصفح + الأندرويد) ---
            window.addEventListener('beforeunload', handleExitSubmit);

            // --- 3. رصد الرجوع (داخل المتصفح - Next.js) ---
            router.events.on('routeChangeStart', handleExitSubmit);

            // --- [ دالة التنظيف ] ---
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


    // (دالة إرسال الإجابات)
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
        
        // (إزالة كل المستمعين يدوياً)
        if (window.Telegram && window.Telegram.WebApp) {
            window.Telegram.WebApp.BackButton.offClick(handleBackButtonConfirm);
            window.Telegram.WebApp.BackButton.hide();
        }
        window.removeEventListener('beforeunload', handleExitSubmit);
        router.events.off('routeChangeStart', handleExitSubmit);
        
        setIsLoading(true);
        setTimer(null); // (إيقاف العداد)

        try {
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
            isSubmittingRef.current = false; 
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
            
            <div className="timer-bar">
                الوقت المتبقي: {Math.floor(timer / 60)}:{('0' + (timer % 60)).slice(-2)}
            </div>
            
            {questions.map((q, index) => (
                <div key={q.id} className="question-box">
                    
                    {q.image_file_id && (
                        <div className="question-image-container">
                            <img 
                                src={`/api/exams/get-image?file_id=${q.image_file_id}`} 
                                alt="Question Image" 
                                className="question-image"
                                loading="lazy" 
                            />
                        </div>
                    )}
                    
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
