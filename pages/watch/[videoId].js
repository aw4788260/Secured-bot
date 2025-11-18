// pages/watch/[videoId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';

const Plyr = dynamic(() => import('plyr-react'), { ssr: false });
import 'plyr/dist/plyr.css';

export default function WatchPage() {
    const router = useRouter();
    const { videoId } = router.query;
    
    const [streamUrl, setStreamUrl] = useState(null);
    const [logs, setLogs] = useState([]); // لتخزين اللوجات
    const playerWrapperRef = useRef(null);
    const plyrInstanceRef = useRef(null);

    // دالة مساعدة لإضافة لوج
    const addLog = (msg) => {
        const time = new Date().toLocaleTimeString();
        setLogs(prev => [`[${time}] ${msg}`, ...prev]);
    };

    // 1. جلب الرابط
    useEffect(() => {
        if (videoId) {
            addLog("جاري طلب رابط الفيديو من السيرفر...");
            fetch(`/api/secure/get-video-id?lessonId=${videoId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.streamUrl) {
                        addLog(`تم جلب الرابط: ${data.streamUrl.substring(0, 50)}...`);
                        setStreamUrl(data.streamUrl);
                    } else {
                        addLog("فشل جلب الرابط من الـ API");
                    }
                })
                .catch(err => addLog(`API Error: ${err.message}`));
        }
    }, [videoId]);

    // 2. محاولة تشغيل الفيديو بـ HLS ورصد الأخطاء
    useEffect(() => {
        if (!streamUrl || !plyrInstanceRef.current) return;

        // تحميل hls.js ديناميكياً
        import('hls.js').then((HlsModule) => {
            const Hls = HlsModule.default;
            const videoElement = plyrInstanceRef.current.plyr.media;

            if (Hls.isSupported()) {
                addLog("HLS.js مدعوم. جاري التحميل...");
                const hls = new Hls({
                    debug: false, // (ممكن تفعله لو عايز تفاصيل أكتر في الكونسول)
                    xhrSetup: function (xhr, url) {
                        // (رصد الطلب قبل خروجه)
                        addLog(`Requesting Chunk: ...${url.slice(-20)}`);
                    }
                });

                hls.loadSource(streamUrl);
                hls.attachMedia(videoElement);

                // [ 🛑 المصيدة: هنا هنكشف الخطأ ]
                hls.on(Hls.Events.ERROR, function (event, data) {
                    if (data.fatal) {
                         addLog(`❌ FATAL ERROR: ${data.type}`);
                    }
                    
                    if (data.response) {
                        // هذا هو الدليل القاطع (رقم الخطأ من جوجل)
                        const status = data.response.code; // 403, 404, etc
                        const url = data.response.url;
                        addLog(`⛔ HTTP Error ${status} from Google!`);
                        addLog(`URL: ${url.substring(0, 40)}...`);
                        
                        if (status === 403) {
                            addLog("✅ الدليل: 403 Forbidden (تم حظر الـ IP)");
                        }
                    } else {
                        addLog(`Error Type: ${data.details}`);
                    }
                });

                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    addLog("تم قراءة ملف المانيفت (القائمة) بنجاح.");
                    videoElement.play().catch(e => addLog("Autoplay blocked"));
                });

            } else {
                addLog("HLS غير مدعوم في هذا المتصفح (Native Mode).");
                videoElement.src = streamUrl;
            }
        });

    }, [streamUrl]);

    return (
        <div style={{ padding: '20px', background: '#111', minHeight: '100vh', color: '#fff' }}>
            <Head><title>صفحة التشخيص (Debug)</title></Head>
            
            <h1>🕵️ صفحة تشخيص الأخطاء</h1>
            
            <div className="player-wrapper" ref={playerWrapperRef} style={{ maxWidth: '800px', margin: '0 auto' }}>
                 <Plyr ref={plyrInstanceRef} source={{ type: 'video', sources: [] }} />
            </div>

            {/* صندوق اللوجات */}
            <div style={{ 
                marginTop: '20px', 
                padding: '15px', 
                background: '#222', 
                border: '1px solid #444', 
                fontFamily: 'monospace', 
                fontSize: '12px',
                height: '300px',
                overflowY: 'scroll'
            }}>
                <h3 style={{color: '#ff5555'}}>سجل الأخطاء (Live Logs):</h3>
                {logs.map((log, i) => (
                    <div key={i} style={{ borderBottom: '1px solid #333', padding: '4px 0', color: log.includes('403') ? '#ff5555' : '#ccc' }}>
                        {log}
                    </div>
                ))}
            </div>
        </div>
    );
}
