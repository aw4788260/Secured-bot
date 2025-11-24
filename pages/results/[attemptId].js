// pages/results/[attemptId].js
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';

export default function ResultsPage() {
    const router = useRouter();
    // (جلب المتغيرات من الرابط)
    const { attemptId, userId, firstName, subjectId } = router.query;
    
    const [results, setResults] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!attemptId) return;

        // (التحقق من هوية المستخدم)
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

        if (!effectiveUserId) {
             setError("لا يمكن التعرف على هويتك.");
             setIsLoading(false);
             return;
        }
        
        // (جلب النتائج)
        fetch(`/api/exams/get-results?attemptId=${attemptId}`)
            .then(res => res.json())
            .then(data => {
                if(data.error) throw new Error(data.error);
                setResults(data);
                setIsLoading(false);
            })
            .catch(err => {
                 setError(err.message);
                 setIsLoading(false);
            });
    }, [attemptId]);

    if (isLoading) {
         return (
            <div className="app-container loader-container">
                <Head><title>جاري تحميل النتيجة...</title></Head>
                <h1>جاري تحميل النتيجة...</h1>
                <div className="loading-bar"></div>
            </div>
         );
    }

    if (error || !results) {
        return (
            <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
                <Head><title>خطأ</title></Head>
                <h1>خطأ: {error || "لا يمكن العثور على النتائج."}</h1>
                {/* (زر العودة هنا أيضاً) */}
                <button className="back-button" onClick={() => router.back()}>
                    &larr; العودة
                </button>
            </div>
        );
    }


    // (عرض النتيجة والتصحيح)
    return (
        <div className="app-container">
            <Head><title>النتيجة النهائية: {results.exam_title}</title></Head>
            
            <h1>النتيجة النهائية لامتحان: {results.exam_title}</h1>
            <div className="score-badge">
                {results.score_details.percentage}%
            </div>
            <p style={{textAlign: 'center', fontSize: '1.2em', fontWeight: 'bold'}}>
                ({results.score_details.correct} إجابة صحيحة من {results.score_details.total} سؤال)
            </p>

            <hr style={{width: '100%', borderColor: '#334155', margin: '20px 0'}} />
            
            <h2>التصحيح التفصيلي:</h2>
            
            {results.corrected_questions.map((q, index) => {
                const userAnswerId = q.user_answer ? q.user_answer.selected_option_id : null;
                const correctOptionId = q.correct_option_id;
                
                return (
                    <div key={q.id} className="question-box-result">
                        
                        {/* [ ✅✅ جديد: عرض الصورة إن وجدت ] */}
                        {q.image_file_id && (
                            <div className="question-image-container">
                                <img 
    src={`/api/exams/get-image?file_id=${q.image_file_id}&userId=${userId}`} 
    alt="Question Image" 
    className="question-image"
    loading="lazy"
/>
                            </div>
                        )}

                        <h4>{index + 1}. {q.question_text}</h4>
                        <div className="options-list">
                            
                            {q.options.map(opt => {
                                let className = 'option-result';
                                const isCorrect = opt.id === correctOptionId;
                                const isUserChoice = opt.id === userAnswerId;

                                if (isCorrect) {
                                    className += ' correct-answer'; 
                                } else if (isUserChoice && !isCorrect) {
                                    className += ' wrong-answer'; 
                                }

                                return (
                                    <div key={opt.id} className={className}>
                                        {opt.option_text}
                                        {isCorrect && " (الإجابة الصحيحة ✅)"}
                                        {isUserChoice && !isCorrect && " (اختيارك ❌)"}
                                    </div>
                                );
                            })}
                            
                            {!userAnswerId && (
                                <div className="option-result wrong-answer">
                                    (لم يتم الإجابة على هذا السؤال)
                                </div>
                            )}

                        </div>
                    </div>
                );
            })}
            
            {/* --- [ ✅✅ هذا هو الكود الذي تم إصلاحه ] --- */}
            {/* (الضغط هنا سيعيدنا إلى app.js بدون تحديد مادة أو وضع) */}
            <button 
                className="button-link" 
                style={{marginTop: '20px'}} 
                onClick={() => router.push(`/app?userId=${userId || ''}&firstName=${firstName || ''}`)}
            >
                العودة للقائمة الرئيسية
            </button>
            {/* --- [ نهاية الإصلاح ] --- */}

        </div>
    );
}
