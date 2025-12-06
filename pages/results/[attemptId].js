import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';

// =========================================================
// 🔒 مكون الصور الآمن (لعرض صور الأسئلة في النتائج)
// =========================================================
const SecureImage = ({ fileId }) => {
    const [src, setSrc] = useState(null);
    useEffect(() => {
        const uid = localStorage.getItem('auth_user_id');
        const did = localStorage.getItem('auth_device_id');
        
        if (!uid || !did) return;

        fetch(`/api/exams/get-image?file_id=${fileId}`, { 
            headers: { 'x-user-id': uid, 'x-device-id': did } 
        })
        .then(res => {
            if (res.ok) return res.blob();
            throw new Error('Failed to load image');
        })
        .then(blob => setSrc(URL.createObjectURL(blob)))
        .catch(err => console.error(err));
        
        return () => { if(src) URL.revokeObjectURL(src); };
    }, [fileId]);

    return src ? <img src={src} className="question-image" alt="Question" /> : <div style={{color:'#aaa'}}>جاري تحميل الصورة...</div>;
};

// =========================================================
// 📄 صفحة النتائج الرئيسية
// =========================================================
export default function ResultsPage() {
    const router = useRouter();
    // [✅] نقرأ فقط معرف المحاولة (attemptId) من الرابط
    const { attemptId } = router.query;
    
    const [results, setResults] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!router.isReady || !attemptId) return;

        // 1. استخراج بيانات الدخول من التخزين الآمن
        const uid = localStorage.getItem('auth_user_id');
        const did = localStorage.getItem('auth_device_id');

        // إذا لم يكن مسجلاً، نطرده
        if (!uid || !did) {
             router.replace('/login');
             return;
        }
        
        // 2. طلب النتائج مع إرسال الهيدرز (الحل لمشكلة Missing Data)
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

    // دالة العودة
    const handleBackToMenu = () => {
        if (typeof window !== 'undefined' && window.Android && window.Android.closeWebView) {
            window.Android.closeWebView();
        } else {
            router.push('/app'); // العودة للرئيسية
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
                <button className="back-button" onClick={handleBackToMenu}>&larr; العودة</button>
            </div>
        );
    }

    if (!results) return null;

    // عرض النتيجة
    return (
        <div className="app-container">
            <Head><title>النتيجة: {results.exam_title}</title></Head>
            
            <h1 style={{marginBottom:'10px'}}>{results.exam_title}</h1>
            
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
            
            <button className="button-link" style={{marginTop: '20px', justifyContent:'center'}} onClick={handleBackToMenu}>
                العودة للقائمة الرئيسية
            </button>
        </div>
    );
}
