import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import Script from 'next/script';

// مكونات Watermark و SettingsIcon كما هي
const SettingsIcon = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="white" style={{ filter: 'drop-shadow(0px 0px 2px black)' }}>
        <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.23,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" />
    </svg>
);
const Watermark = ({ user }) => {
    const [pos, setPos] = useState({ top: '10%', left: '10%' });
    useEffect(() => {
        if (!user) return;
        const interval = setInterval(() => {
            setPos({ top: `${Math.floor(Math.random() * 60) + 20}%`, left: `${Math.floor(Math.random() * 60) + 20}%` });
        }, 5000);
        return () => clearInterval(interval);
    }, [user]);
    return (
        <div style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 15, pointerEvents: 'none', padding: '4px 8px', background: 'rgba(0,0,0,0.5)', color: '#fff', borderRadius: '4px', fontSize: '12px', whiteSpace: 'nowrap' }}>
            {user.first_name} ({user.id})
        </div>
    );
};

export default function WatchPage() {
    const router = useRouter();
    const { videoId } = router.query;
    
    // States
    const [streamUrl, setStreamUrl] = useState(null);
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    const [qualities, setQualities] = useState([]);
    const [currentQuality, setCurrentQuality] = useState(-1);
    const [showQualityMenu, setShowQualityMenu] = useState(false);
    
    const videoRef = useRef(null);
    const hlsRef = useRef(null); 

    // ##############################
    // نظام تسجيل الأخطاء (LOGGING)
    // ##############################
    const logBuffer = useRef([]); 
    
    // لإضافة حدث للمخزن
    const queueLog = (message, type = 'info', details = null) => {
        const time = new Date().toLocaleTimeString();
        logBuffer.current.push({ time, message, type, details });
        // إرسال اللوج مباشرة عند وقوع خطأ حاد أو تحذير
        if (type === 'error' || type === 'warn') sendLogsNow();
    };

    // لإرسال المخزن إلى Vercel Logs الآن
    const sendLogsNow = () => {
        if (logBuffer.current.length === 0) return;
        const logsToSend = [...logBuffer.current];
        logBuffer.current = []; 
        fetch('/api/debug-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logs: logsToSend })
        }).catch(e => console.error("Log send failed", e));
    };

    // إرسال اللوجات كل 3 ثواني بشكل دوري
    useEffect(() => {
        const interval = setInterval(sendLogsNow, 3000); 
        return () => clearInterval(interval);
    }, []);
    

    // ##############################
    // 3. تشغيل الفيديو (Direct HLS)
    // ##############################
    useEffect(() => {
        if (!streamUrl || !videoRef.current || typeof window === 'undefined' || !window.Hls) return;

        const video = videoRef.current;
        let hls = null;
        queueLog(`Attempting Direct Playback.`, 'info');

        if (window.Hls.isSupported()) {
            if (hlsRef.current) hlsRef.current.destroy();

            hls = new window.Hls({
                maxBufferLength: 30,
                enableWorker: true,
                // إعدادات تخفيف قيود الـ CORS 
                xhrSetup: function (xhr, url) {
                    xhr.withCredentials = false;
                    xhr.setRequestHeader('Referer', 'https://www.youtube.com/'); 
                }
            });

            hls.loadSource(streamUrl);
            hls.attachMedia(video);

            hls.on(window.Hls.Events.MANIFEST_PARSED, (event, data) => {
                const levels = data.levels.map((lvl, idx) => ({ height: lvl.height, index: idx }));
                setQualities(levels);
                queueLog(`✅ MANIFEST_PARSED (Direct). Qualities found: ${levels.length}`, 'success');
                video.play().catch(() => queueLog("Autoplay prevented", 'warn'));
            });

            hls.on(window.Hls.Events.FRAG_LOADED, (e, data) => {
                if (data.frag.sn === 0) queueLog(`🎉 FRAG_LOADED (Direct). Video data is flowing!`, 'success');
            });

            hls.on(window.Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    queueLog(`❌ FATAL ERROR: ${data.type}`, 'error', { 
                        details: data.details, 
                        responseCode: data.response?.code,
                        url: data.response?.url 
                    });
                    hls.destroy();
                }
            });

            hlsRef.current = hls;

        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // دعم Safari IOS
            video.src = streamUrl;
            queueLog(`Running on Native HLS (iOS).`, 'info');
        }

        return () => {
            if (hls) hls.destroy();
            hlsRef.current = null;
        };
    }, [streamUrl]);

    // تغيير الجودة
    const changeQuality = (index) => {
        if (!hlsRef.current) return;
        hlsRef.current.currentLevel = index; 
        setCurrentQuality(index);
        setShowQualityMenu(false);
        queueLog(`Quality changed to: ${index === -1 ? 'Auto' : qualities.find(q => q.index === index)?.height + 'p'}`, 'info');
    };

    // ##############################
    // 4. جلب بيانات المستخدم والفيديو
    // ##############################
    useEffect(() => {
        const setupUser = (u) => { if (u && u.id) setUser(u); else setError("خطأ: لا يمكن التعرف على المستخدم."); };
        const params = new URLSearchParams(window.location.search);
        const urlUserId = params.get("userId");
        const urlFirstName = params.get("firstName");

        if (urlUserId) { setupUser({ id: urlUserId, first_name: urlFirstName || "User" }); } 
        else if (window.Telegram?.WebApp) { window.Telegram.WebApp.ready(); const u = window.Telegram.WebApp.initDataUnsafe?.user; if (u) setupUser(u); } 
        
        if (videoId) {
            queueLog(`Fetching video link for ID: ${videoId}`, 'info');
            fetch(`/api/secure/get-video-id?lessonId=${videoId}`)
                .then(res => res.ok ? res.json() : res.json().then(e => { throw new Error(e.message); }))
                .then(data => {
                    if (data.message) throw new Error(data.message);
                    setStreamUrl(data.streamUrl ? data.streamUrl.trim() : null);
                    queueLog(`API Success. URL is ready.`, 'success');
                })
                .catch(err => {
                    setError(err.message);
                    queueLog(`API Fetch Error: ${err.message}`, 'error');
                });
        }
    }, [videoId]);


    if (error) return <div className="center-msg"><h1>{error}</h1></div>;
    if (!user || !streamUrl) return <div className="center-msg"><h1>جاري التحميل...</h1></div>;

    return (
        <div className="page-container">
            <Head>
                <title>مشاهدة الدرس</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
                <meta name="referrer" content="no-referrer" /> 
            </Head>

            <Script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js" strategy="afterInteractive" />

            <div className="video-wrapper">
                <video 
                    ref={videoRef} 
                    controls 
                    playsInline 
                    className="main-video"
                    controlsList="nodownload"
                />

                {/* زر الجودة المخصص */}
                {qualities.length > 0 && (
                    <div className="custom-controls">
                        <button 
                            className="settings-btn" 
                            onClick={() => setShowQualityMenu(!showQualityMenu)}
                        >
                            <SettingsIcon />
                        </button>
                        
                        {showQualityMenu && (
                            <div className="quality-menu">
                                <div 
                                    className={`quality-item ${currentQuality === -1 ? 'active' : ''}`}
                                    onClick={() => changeQuality(-1)}
                                >
                                    Auto
                                </div>
                                {qualities.map((q) => (
                                    <div 
                                        key={q.index}
                                        className={`quality-item ${currentQuality === q.index ? 'active' : ''}`}
                                        onClick={() => changeQuality(q.index)}
                                    >
                                        {q.height}p
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <Watermark user={user} />
            </div>

            <style jsx global>{`
                body { margin: 0; background: #111; color: white; font-family: sans-serif; overflow-x: hidden; }
                .page-container { 
                    display: flex; flex-direction: column; align-items: center; justify-content: center; 
                    min-height: 100vh; padding: 10px; 
                }
                .center-msg { display: flex; justify-content: center; align-items: center; height: 100vh; color: #fff; }
                .video-wrapper { 
                    position: relative; width: 100%; max-width: 900px; 
                    aspect-ratio: 16/9; background: #000; border-radius: 8px; overflow: hidden;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center;
                }
                
                .main-video { width: 100%; height: 100%; outline: none; }

                /* أدوات التحكم المخصصة (زر الجودة) */
                .custom-controls { position: absolute; top: 10px; right: 10px; z-index: 25; }
                .settings-btn {
                    background: rgba(0, 0, 0, 0.5); border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
                    cursor: pointer; backdrop-filter: blur(4px);
                }

                .quality-menu {
                    position: absolute; top: 50px; right: 0; background: rgba(20, 20, 20, 0.95);
                    border-radius: 8px; overflow: hidden; min-width: 110px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.5); display: flex; flex-direction: column;
                    border: 1px solid rgba(255,255,255,0.1);
                }
                
                .quality-item {
                    padding: 12px 20px; cursor: pointer; font-size: 14px; font-weight: bold; text-align: center;
                    border-bottom: 1px solid rgba(255,255,255,0.05); color: #ddd;
                }
                .quality-item:last-child { border-bottom: none; }
                .quality-item:active, .quality-item:hover { background: #38bdf8; color: #000; }
                .quality-item.active { color: #38bdf8; }
            `}</style>
        </div>
    );
}
