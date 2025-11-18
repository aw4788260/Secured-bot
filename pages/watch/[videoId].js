import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import Script from 'next/script';

export default function WatchPage() {
    const router = useRouter();
    const { videoId } = router.query;
    
    const [originalUrl, setOriginalUrl] = useState(null);
    const [useProxy, setUseProxy] = useState(false); 
    const [statusMessage, setStatusMessage] = useState("Waiting for action..."); // رسالة بسيطة للمستخدم
    
    const videoRef = useRef(null);
    const hlsRef = useRef(null);

    // ---------------------------------------------------------
    // دالة الإرسال إلى Vercel Logs
    // ---------------------------------------------------------
    const logToVercel = (message, type = 'info', details = null) => {
        // تحديث الرسالة الظاهرة للمستخدم فقط
        setStatusMessage(message);

        // إرسال التفاصيل الكاملة للسيرفر
        try {
            fetch('/api/debug-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, type, details })
            });
        } catch (e) {
            console.error("Failed to send log", e);
        }
    };

    // 1. جلب تفاصيل الفيديو
    useEffect(() => {
        if (videoId) {
            logToVercel(`Page Loaded. Fetching ID: ${videoId}`, 'info');
            
            fetch(`/api/secure/get-video-id?lessonId=${videoId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.streamUrl) {
                        setOriginalUrl(data.streamUrl.trim());
                        logToVercel(`API Success. URL found.`, 'info');
                    } else {
                        logToVercel(`API Error. Stream URL empty.`, 'error', data);
                    }
                })
                .catch(err => logToVercel(`API Fetch Error: ${err.message}`, 'error'));
        }
    }, [videoId]);

    // 2. تشغيل المشغل
    const initPlayer = () => {
        if (!originalUrl || !videoRef.current || !window.Hls) return;

        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        // تحديد الرابط
        let playUrl = originalUrl;
        const mode = useProxy ? "PROXY" : "DIRECT";
        
        if (useProxy) {
            playUrl = `/api/proxy-m3u8?url=${encodeURIComponent(originalUrl)}`;
        }

        logToVercel(`Starting Player. Mode: ${mode}`, 'info', { playUrl });

        if (window.Hls.isSupported()) {
            const hls = new window.Hls({
                debug: false, // نغلق الديباج الداخلي عشان منزحمش اللوج
                enableWorker: true,
                xhrSetup: function (xhr, url) {
                    xhr.withCredentials = false;
                }
            });

            hls.loadSource(playUrl);
            hls.attachMedia(videoRef.current);

            // ---- الأحداث ----

            hls.on(window.Hls.Events.MANIFEST_LOADED, () => {
                logToVercel(`✅ MANIFEST_LOADED (${mode}) - Connection Successful`, 'success');
            });

            hls.on(window.Hls.Events.MANIFEST_PARSED, (event, data) => {
                logToVercel(`✅ MANIFEST_PARSED. Levels: ${data.levels.length}`, 'success');
                videoRef.current.play().catch(e => logToVercel(`Autoplay prevented: ${e.message}`, 'warn'));
            });

            // لن نرسل هذا الحدث للسيرفر لتوفير الموارد إلا لو أردت التأكد
             hls.on(window.Hls.Events.FRAG_LOADED, (event, data) => {
                 // logToVercel(`Fragment Loaded (SN: ${data.frag.sn})`, 'info');
             });

            hls.on(window.Hls.Events.ERROR, (event, data) => {
                // نرسل الأخطاء فقط
                if (data.fatal) {
                    logToVercel(`❌ FATAL ERROR (${mode}): ${data.type}`, 'error', {
                        details: data.details,
                        responseCode: data.response?.code
                    });

                    switch (data.type) {
                        case window.Hls.ErrorTypes.NETWORK_ERROR:
                            hls.destroy();
                            break;
                        default:
                            hls.destroy();
                            break;
                    }
                } else {
                     // الأخطاء غير القاتلة (Non-fatal)
                     // logToVercel(`⚠️ Non-fatal error: ${data.details}`, 'warn');
                }
            });

            hlsRef.current = hls;
        }
    };

    // إعادة التشغيل عند تغيير الزر
    useEffect(() => {
        if (originalUrl) {
            // تأخير بسيط للتأكد من جاهزية الحالة
            setTimeout(initPlayer, 500);
        }
    }, [useProxy, originalUrl]);

    return (
        <div style={{ background: '#111', minHeight: '100vh', color: '#fff', padding: '20px', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Head>
                <title>Remote Debugger</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <meta name="referrer" content="no-referrer" />
            </Head>

            <Script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js" />

            <h3>Remote Logger Active</h3>
            <p style={{color: '#888', fontSize: '12px'}}>Logs are being sent to Vercel Dashboard</p>
            
            {/* حالة النظام الحالية تظهر للمستخدم */}
            <div style={{
                padding: '10px', background: '#222', borderRadius: '5px', 
                marginBottom: '20px', width: '100%', maxWidth: '600px', textAlign: 'center',
                border: '1px solid #444', color: '#38bdf8'
            }}>
                STATUS: {statusMessage}
            </div>

            {/* أزرار التحكم */}
            <div style={{display: 'flex', gap: '15px', marginBottom: '20px', width: '100%', maxWidth: '600px'}}>
                <button 
                    onClick={() => setUseProxy(false)}
                    style={{
                        padding: '15px', background: !useProxy ? '#ff4444' : '#333', 
                        color: 'white', border: 'none', borderRadius: '8px', flex: 1, fontWeight: 'bold'
                    }}
                >
                    1. Test Direct
                </button>
                <button 
                    onClick={() => setUseProxy(true)}
                    style={{
                        padding: '15px', background: useProxy ? '#00C851' : '#333', 
                        color: 'white', border: 'none', borderRadius: '8px', flex: 1, fontWeight: 'bold'
                    }}
                >
                    2. Test Proxy
                </button>
            </div>

            <div style={{ position: 'relative', width: '100%', maxWidth: '600px', aspectRatio: '16/9', background: '#000', borderRadius: '10px', overflow: 'hidden' }}>
                <video ref={videoRef} controls playsInline muted style={{ width: '100%', height: '100%' }} />
            </div>
        </div>
    );
}
