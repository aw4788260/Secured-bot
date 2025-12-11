import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';

// =========================================================
// 🔒 مكون الصور الآمن (SecureImage) - نسخة النتائج (Cached)
// =========================================================
const SecureImage = ({ fileId }) => {
    const [src, setSrc] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const CACHE_NAME = 'exam-secure-images-v1'; // نفس اسم الكاش المستخدم في الامتحان
        const requestUrl = `/api/exams/get-image?file_id=${fileId}`;

        const fetchImage = async () => {
            try {
                // 1. البحث في الكاش أولاً
                const cache = await caches.open(CACHE_NAME);
                let response = await cache.match(requestUrl);

                if (!response) {
                    // 2. إذا لم تكن في الكاش، نطلبها من السيرفر
                    const uid = localStorage.getItem('auth_user_id');
                    const did = localStorage.getItem('auth_device_id');
                    
                    if (!uid || !did) return;

                    response = await fetch(requestUrl, {
                        headers: { 'x-user-id': uid, 'x-device-id': did }
                    });

                    // 3. تخزينها في الكاش للمستقبل
                    if (response.ok) {
                        await cache.put(requestUrl, response.clone());
                    }
                }

                if (response.ok) {
                    const blob = await response.blob();
                    const url = URL.createObjectURL(blob);
                    if (isMounted) {
                        setSrc(url);
                        setLoading(false);
                    }
                } else {
                    throw new Error('Failed load');
                }
            } catch (err) {
                console.error("Image load error:", err);
                if (isMounted) setLoading(false);
            }
        };

        if (fileId) fetchImage();

        return () => {
            isMounted = false;
            if (src) URL.revokeObjectURL(src);
        };
    }, [fileId]);

    if (loading) return <div style={{color:'#aaa', fontSize:'12px'}}>جاري تحميل الصورة...</div>;
    return src ? <img src={src} className="question-image" alt="Question" /> : <div style={{color:'#ef4444', fontSize:'12px'}}>❌ الصورة غير متوفرة</div>;
};

// =========================================================
// 📄 صفحة النتائج الرئيسية
// =========================================================
export default function ResultsPage() {
    const router = useRouter();
    const { attemptId } = router.query;
    
    const [results, setResults] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!router.isReady || !attemptId) return;

        // 1. استخراج بيانات الدخول
        const uid = localStorage.getItem('auth_user_id');
        const did = localStorage.getItem('auth_device_id');

        if (!uid || !did) {
             router.replace('/login');
             return;
        }
        
        // 2. طلب النتائج
        fetch(`/api/exams/get-results?attemptId=${attemptId}`, {
            headers: { 
                'x-user-id': uid,
                'x-device-id': did 
            }
        })
        .then(res => {
            if (res.status === 403) throw new Error("⛔ غير مصرح لك برؤية هذه النتيجة.");
            if (!res.ok) return res.json().then(e => { throw new Error(e.error || 'خطأ في التحميل'); });
            return res.json();
        })
        .then(data => {
            setResults(data);
            setIsLoading(false);
        })
        .catch(err => {
             setError(err.message);
             setIsLoading(false);
        });
    }, [router.isReady, attemptId]);

    // ✅ دالة العودة الذكية (تغلق الويب في الأندرويد أو تعود للرئيسية في المتصفح)
    const handleSmartExit = () => {
        if (typeof window !== 'undefined' && window.Android && window.Android.closeWebView) {
            // نحن في تطبيق الأندرويد -> أغلق الـ WebView
            window.Android.closeWebView();
        } else {
            // نحن في المتصفح -> عد للمكتبة
            router.push('/'); 
        }
    };

    if (isLoading) {
         return (
            <div className="app-container loader-container">
                <Head><title>جاري التحميل...</title></Head>
                <h1>جاري تحميل النتيجة...</h1>
                <div className="loading-bar"></div>
            </div>
         );
    }

    if (error) {
        return (
            <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
                <Head><title>خطأ</title></Head>
                <h1 style={{color: '#ef4444'}}>خطأ: {error}</h1>
                <button className="back-button" onClick={handleSmartExit}>&larr; خروج</button>
            </div>
        );
    }

    if (!results) return null;

    // عرض النتيجة
    return (
        <div className="app-container">
            <Head><title>النتيجة: {results.exam_title}</title></Head>
            
            {/* ✅ زر خروج علوي */}
            <button 
                onClick={handleSmartExit} 
                style={{
                    position: 'absolute', top: '20px', left: '20px',
                    background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
                    width: '35px', height: '35px', color: '#fff', fontSize: '18px', cursor: 'pointer'
                }}
            >
                ✕
            </button>

            <h1 style={{marginBottom:'10px', marginTop:'40px'}}>{results.exam_title}</h1>
            
            {/* دائرة الدرجة */}
            <div style={{textAlign:'center', margin:'20px 0'}}>
                <div className="score-badge">
                    {results.score_details.percentage}%
                </div>
                <p style={{fontSize: '1.1em', fontWeight: 'bold', color: '#cbd5e1'}}>
                    ({results.score_details.correct} إجابة صحيحة من {results.score_details.total})
                </p>
            </div>

            <hr style={{width: '100%', borderColor: '#334155', margin: '20px 0'}} />
            
            <h2>التصحيح التفصيلي:</h2>
            
            {results.corrected_questions.map((q, index) => {
                const userAnswerId = q.user_answer ? q.user_answer.selected_option_id : null;
                const correctOptionId = q.correct_option_id;
                const isUserCorrect = q.user_answer?.is_correct;
                
                return (
                    <div key={q.id} className="question-box-result" style={{
                        border: isUserCorrect ? '1px solid #2ecc71' : '1px solid #e74c3c'
                    }}>
                        {/* عرض الصورة إن وجدت */}
                        {q.image_file_id && (
                            <div className="question-image-container">
                                <SecureImage fileId={q.image_file_id} />
                            </div>
                        )}

                        <h4>{index + 1}. {q.question_text}</h4>
                        
                        <div className="options-list">
                            {q.options.map(opt => {
                                let className = 'option-result';
                                const isCorrect = opt.id === correctOptionId;
                                const isUserChoice = opt.id === userAnswerId;

                                if (isCorrect) className += ' correct-answer'; 
                                else if (isUserChoice && !isCorrect) className += ' wrong-answer'; 

                                return (
                                    <div key={opt.id} className={className}>
                                        {opt.option_text}
                                        {isCorrect && " ✅"}
                                        {isUserChoice && !isCorrect && " ❌"}
                                    </div>
                                );
                            })}
                            
                            {!userAnswerId && (
                                <div className="option-result wrong-answer" style={{marginTop:'10px'}}>
                                    (لم يتم الإجابة على هذا السؤال)
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
            
            {/* ✅ زر خروج سفلي واضح */}
            <button className="button-link" style={{marginTop: '20px', justifyContent:'center', background: '#38bdf8', color: '#000'}} onClick={handleSmartExit}>
                الخروج والعودة للقائمة
            </button>
        </div>
    );
}
