import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import Script from 'next/script';

export default function DebugPage() {
    const router = useRouter();
    const { videoId } = router.query;
    
    const [logs, setLogs] = useState([]);
    const [streamUrl, setStreamUrl] = useState('');
    const artRef = useRef(null);
    const playerInstance = useRef(null);

    // دالة لإضافة السجلات للشاشة
    const addLog = (msg, type = 'info') => {
        const time = new Date().toLocaleTimeString();
        setLogs(prev => [`[${time}] [${type}] ${msg}`, ...prev]);
        console.log(`[${type}] ${msg}`);
    };

    // 1. دالة تشغيل Artplayer
    const initPlayer = (url) => {
        if (!window.Artplayer || !window.Hls) {
            addLog("المكتبات لم يتم تحميلها بعد!", "error");
            return;
        }

        if (playerInstance.current) playerInstance.current.destroy(false);

        addLog(`محاولة تشغيل الرابط: ${url.substring(0, 50)}...`, "warn");

        const art = new window.Artplayer({
            container: artRef.current,
            url: url,
            type: 'm3u8',
            volume: 0.5,
            isLive: false,
            autoplay: true,
            customType: {
                m3u8: function (video, url, art) {
                    if (window.Hls.isSupported()) {
                        const hls = new window.Hls({
                            debug: true, // تفعيل وضع الديباج الداخلي لـ HLS
                            xhrSetup: function (xhr) {
                                // محاولة خداع السيرفر
                                xhr.withCredentials = false; 
                            }
                        });
                        
                        hls.loadSource(url);
                        hls.attachMedia(video);
                        
                        hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
                            addLog("✅ نجح: تم قراءة ملف المانيفست (MANIFEST_PARSED)", "success");
                            video.play().catch(e => addLog(`تنبيه التشغيل التلقائي: ${e.message}`, "warn"));
                        });

                        hls.on(window.Hls.Events.ERROR, (event, data) => {
                            if (data.fatal) {
                                addLog(`❌ خطأ قاتل: ${data.type} - ${data.details}`, "error");
                                switch (data.type) {
                                    case window.Hls.ErrorTypes.NETWORK_ERROR:
                                        addLog("⚠️ خطأ شبكة (قد يكون CORS أو 403 Forbidden)", "error");
                                        hls.startLoad();
                                        break;
                                    case window.Hls.ErrorTypes.MEDIA_ERROR:
                                        addLog("⚠️ خطأ في فك تشفير الفيديو", "error");
                                        hls.recoverMediaError();
                                        break;
                                    default:
                                        hls.destroy();
                                        break;
                                }
                            } else {
                                addLog(`تنبيه HLS: ${data.details}`, "info");
                            }
                        });
                        
                        art.hls = hls;
                    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                        video.src = url;
                        addLog("تشغيل عبر المشغل الأصلي (Safari/Native)", "info");
                    } else {
                        addLog("المتصفح لا يدعم HLS", "error");
                    }
                }
            }
        });

        playerInstance.current = art;
    };

    // 2. جلب الرابط من السيرفر
    const fetchAndPlay = () => {
        if (!videoId) return addLog("لا يوجد Video ID", "error");
        
        addLog(`جاري الاتصال بالسيرفر لجلب ID: ${videoId}...`, "info");
        
        fetch(`/api/secure/get-video-id?lessonId=${videoId}`)
            .then(res => res.json())
            .then(data => {
                if (data.message) {
                    addLog(`خطأ من الـ API: ${data.message}`, "error");
                    return;
                }
                
                // البحث عن الجودات
                const qualities = data.availableQualities || [];
                if (qualities.length > 0) {
                    const firstUrl = qualities[0].url;
                    addLog(`تم العثور على ${qualities.length} جودة. تشغيل الأولى.`, "success");
                    setStreamUrl(firstUrl);
                    initPlayer(firstUrl);
                } else if (data.streamUrl) {
                    addLog("تم العثور على رابط Stream مباشر.", "success");
                    setStreamUrl(data.streamUrl);
                    initPlayer(data.streamUrl);
                } else {
                    addLog("الرد لا يحتوي على روابط صالحة!", "error");
                    addLog(JSON.stringify(data), "info");
                }
            })
            .catch(err => addLog(`فشل الاتصال بالكامل: ${err.message}`, "error"));
    };

    // تشغيل فيديو اختبار عام
    const playTestVideo = () => {
        const testUrl = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
        addLog("بدء اختبار برابط خارجي مضمون...", "info");
        initPlayer(testUrl);
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'monospace', background: '#111', color: '#eee', minHeight: '100vh' }}>
            <Head>
                <title>Debug Player</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                {/* هذا التاج مهم جداً لحل مشاكل جوجل */}
                <meta name="referrer" content="no-referrer" />
            </Head>

            {/* تحميل المكتبات */}
            <Script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js" />
            <Script src="https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.js" onLoad={() => addLog("المكتبات جاهزة.", "success")} />

            <h3>🔍 وضع التشخيص (Debug Mode)</h3>
            
            <div style={{ marginBottom: '10px' }}>
                <button onClick={fetchAndPlay} style={{ padding: '10px', marginRight: '10px', background: '#38bdf8', border: 'none', borderRadius: '4px' }}>
                    1. جلب وتشغيل الفيديو الأصلي
                </button>
                <button onClick={playTestVideo} style={{ padding: '10px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px' }}>
                    2. تجربة فيديو اختبار (Test Stream)
                </button>
            </div>

            {/* المشغل */}
            <div ref={artRef} style={{ width: '100%', height: '300px', background: '#000', marginBottom: '20px' }}></div>

            {/* شاشة اللوج */}
            <div style={{ background: '#222', border: '1px solid #444', padding: '10px', height: '300px', overflowY: 'scroll' }}>
                <strong>سجل الأحداث:</strong>
                {logs.map((log, i) => (
                    <div key={i} style={{ 
                        borderBottom: '1px solid #333', 
                        padding: '2px', 
                        color: log.includes('error') ? '#ff6b6b' : log.includes('success') ? '#51cf66' : log.includes('warn') ? '#fcc419' : '#ccc' 
                    }}>
                        {log}
                    </div>
                ))}
            </div>
        </div>
    );
}
