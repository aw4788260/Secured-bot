import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import Script from 'next/script';

export default function WatchPage() {
    const router = useRouter();
    const { videoId } = router.query;
    
    const [statusMessage, setStatusMessage] = useState("Initializing...");
    const [originalUrl, setOriginalUrl] = useState(null);
    const videoRef = useRef(null);
    const hlsRef = useRef(null);
    
    // --- نظام اللوجات المتطور (Batching) ---
    const logBuffer = useRef([]); // مخزن مؤقت للوجات

    // دالة الإضافة للمخزن
    const queueLog = (message, type = 'info', details = null) => {
        const time = new Date().toLocaleTimeString();
        logBuffer.current.push({ time, message, type, details });
        setStatusMessage(`${type.toUpperCase()}: ${message}`); // تحديث واجهة المستخدم
    };

    // دالة الإرسال للسيرفر (تُستدعى كل 3 ثواني)
    useEffect(() => {
        const interval = setInterval(() => {
            if (logBuffer.current.length > 0) {
                // إرسال نسخة من المخزن وتفريغه
                const logsToSend = [...logBuffer.current];
                logBuffer.current = []; 

                fetch('/api/debug-log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ logs: logsToSend })
                }).catch(e => console.error("Log send failed", e));
            }
        }, 3000); // كل 3 ثواني

        return () => clearInterval(interval);
    }, []);

    // --- جلب الفيديو ---
    useEffect(() => {
        if (videoId) {
            queueLog(`Fetching Video ID: ${videoId}`, 'info');
            fetch(`/api/secure/get-video-id?lessonId=${videoId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.streamUrl) {
                        setOriginalUrl(data.streamUrl.trim());
                        queueLog(`API Success. URL obtained.`, 'success');
                    } else {
                        queueLog(`API returned empty URL`, 'error', data);
                    }
                })
                .catch(err => queueLog(`API Fetch Error`, 'error', err.message));
        }
    }, [videoId]);

    // --- تشغيل المشغل عبر البروكسي ---
    useEffect(() => {
        if (!originalUrl || !videoRef.current || !window.Hls) return;

        // تدمير القديم
        if (hlsRef.current) hlsRef.current.destroy();

        // استخدام البروكسي إجبارياً (لحل مشكلة IP Lock & CORS)
        const proxyUrl = `/api/proxy-m3u8?url=${encodeURIComponent(originalUrl)}`;
        
        queueLog(`Starting HLS with PROXY`, 'info', { proxyUrl });

        if (window.Hls.isSupported()) {
            const hls = new window.Hls({
                debug: false,
                enableWorker: true,
                xhrSetup: function (xhr) { xhr.withCredentials = false; }
            });

            hls.loadSource(proxyUrl);
            hls.attachMedia(videoRef.current);

            // الأحداث
            hls.on(window.Hls.Events.MANIFEST_LOADED, () => {
                queueLog(`✅ MANIFEST_LOADED. Proxy connection established.`, 'success');
            });

            hls.on(window.Hls.Events.MANIFEST_PARSED, (e, data) => {
                queueLog(`✅ MANIFEST_PARSED. Qualities found: ${data.levels.length}`, 'success');
                videoRef.current.play().catch(e => queueLog(`Autoplay blocked`, 'warn', e.message));
            });

            hls.on(window.Hls.Events.FRAG_LOADED, (e, data) => {
                // سنرسل لوج واحد فقط عند تحميل أول قطعة فيديو للتأكد من النجاح
                if (data.frag.sn === 0 || data.frag.sn === 1) {
                    queueLog(`🎉 FRAG_LOADED (SN: ${data.frag.sn}). Video data is flowing!`, 'success');
                }
            });

            hls.on(window.Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    queueLog(`❌ FATAL ERROR: ${data.type}`, 'error', { 
                        details: data.details, 
                        responseCode: data.response?.code,
                        url: data.response?.url 
                    });
                    
                    // محاولة أخيرة للإنعاش
                    if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
                         hls.startLoad();
                    } else {
                        hls.destroy();
                    }
                }
            });

            hlsRef.current = hls;
        }
    }, [originalUrl]);

    return (
        <div style={{ background: '#000', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <Head>
                <title>Test Player</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            </Head>
            <Script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js" />

            <div style={{ width: '100%', maxWidth: '800px', aspectRatio: '16/9', background: '#111', border: '1px solid #333' }}>
                <video ref={videoRef} controls playsInline style={{ width: '100%', height: '100%' }} />
            </div>

            <div style={{ marginTop: '20px', padding: '10px', background: '#222', borderRadius: '5px', fontFamily: 'monospace', fontSize: '12px', color: '#0f0' }}>
                STATUS: {statusMessage}
            </div>
        </div>
    );
}
