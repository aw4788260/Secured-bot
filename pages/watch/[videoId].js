import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import Script from 'next/script';

export default function WatchPage() {
    const router = useRouter();
    const { videoId } = router.query;
    
    const [streamUrl, setStreamUrl] = useState(null);
    const [logs, setLogs] = useState([]); // لتخزين سجلات الديباج
    const videoRef = useRef(null);

    // دالة لإضافة سطر في شاشة اللوج
    const addLog = (msg, data = null) => {
        const time = new Date().toLocaleTimeString().split(' ')[0];
        const dataStr = data ? JSON.stringify(data, null, 2) : '';
        // بنضيف اللوج الجديد فوق القديم
        setLogs(prev => [`[${time}] ${msg} ${dataStr}`, ...prev].slice(0, 50));
        console.log(`[${time}] ${msg}`, data);
    };

    useEffect(() => {
        if (videoId) {
            addLog("1. Starting fetch for Video ID: " + videoId);
            fetch(`/api/secure/get-video-id?lessonId=${videoId}`)
                .then(res => res.json())
                .then(data => {
                    addLog("2. API Response received");
                    if (data.streamUrl) {
                        addLog("3. Stream URL found: " + data.streamUrl.substring(0, 50) + "...");
                        setStreamUrl(data.streamUrl.trim());
                    } else {
                        addLog("Error: Stream URL is empty in API response", data);
                    }
                })
                .catch(err => addLog("API Error: " + err.message));
        }
    }, [videoId]);

    useEffect(() => {
        if (!streamUrl || !videoRef.current || typeof window === 'undefined' || !window.Hls) return;

        addLog("4. Initializing HLS.js...");

        if (window.Hls.isSupported()) {
            const hls = new window.Hls({
                debug: true, // تفعيل الديباج الداخلي للمكتبة
                enableWorker: true,
                xhrSetup: function (xhr, url) {
                    xhr.withCredentials = false;
                }
            });

            addLog("5. Loading Source...");
            hls.loadSource(streamUrl);
            hls.attachMedia(videoRef.current);

            // -------------------------------------------
            // أهم الأحداث لكشف المشكلة
            // -------------------------------------------

            // 1. عند تحميل ملف المانيفست (القائمة)
            hls.on(window.Hls.Events.MANIFEST_LOADED, (event, data) => {
                addLog("✅ EVENT: MANIFEST_LOADED. URL reachable.");
            });

            // 2. عند فك تشفير القائمة وقراءة الجودات
            hls.on(window.Hls.Events.MANIFEST_PARSED, (event, data) => {
                addLog(`✅ EVENT: MANIFEST_PARSED. Found ${data.levels.length} quality levels.`);
                // طباعة تفاصيل الجودات
                data.levels.forEach((lvl, i) => {
                    addLog(`   - Level ${i}: ${lvl.height}p (Bitrate: ${lvl.bitrate})`);
                });
                videoRef.current.play().catch(e => addLog("Autoplay blocked: " + e.message));
            });

            // 3. عند البدء في تحميل قطعة فيديو (Chunk/Fragment)
            hls.on(window.Hls.Events.FRAG_LOADING, (event, data) => {
                // addLog(`... Loading fragment: sn=${data.frag.sn}`); // بلاش عشان منزحمش الشاشة
            });

            // 4. عند نجاح تحميل القطعة (هنا نتأكد ان الفيديو شغال فعلياً)
            hls.on(window.Hls.Events.FRAG_LOADED, (event, data) => {
                addLog(`✅ EVENT: FRAG_LOADED (Size: ${data.stats.loaded} bytes). Video data is arriving!`);
            });

            // 5. الأخطاء
            hls.on(window.Hls.Events.ERROR, (event, data) => {
                addLog(`❌ HLS ERROR: Type=${data.type}, Details=${data.details}`);
                if (data.fatal) {
                    addLog("   -> Fatal Error! Trying to recover...");
                    switch (data.type) {
                        case window.Hls.ErrorTypes.NETWORK_ERROR:
                            hls.startLoad();
                            break;
                        case window.Hls.ErrorTypes.MEDIA_ERROR:
                            hls.recoverMediaError();
                            break;
                        default:
                            hls.destroy();
                            break;
                    }
                }
                // فحص خاص لأخطاء 403/404
                if (data.response && data.response.code) {
                    addLog(`   -> HTTP Code: ${data.response.code}`);
                }
            });

            return () => hls.destroy();
        } else {
            addLog("⚠️ HLS not supported in this browser/webview (using native).");
            videoRef.current.src = streamUrl;
        }

    }, [streamUrl]);

    return (
        <div style={{ background: '#222', minHeight: '100vh', color: '#fff', padding: '10px', fontFamily: 'monospace' }}>
            <Head>
                <title>Debug Player</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <meta name="referrer" content="no-referrer" />
            </Head>

            <Script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js" strategy="beforeInteractive" />

            <h3>Debug Player (Test Mode)</h3>
            
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#000', marginBottom: '10px' }}>
                <video ref={videoRef} controls playsInline style={{ width: '100%', height: '100%' }} />
            </div>

            {/* شاشة اللوج */}
            <div style={{ 
                background: '#000', 
                border: '1px solid #0f0', 
                height: '300px', 
                overflowY: 'scroll', 
                padding: '10px',
                fontSize: '11px',
                lineHeight: '1.4'
            }}>
                <div style={{color: '#0f0', fontWeight: 'bold', borderBottom: '1px solid #333', marginBottom: '5px'}}>
                    DEBUG CONSOLE (Newest First):
                </div>
                {logs.length === 0 && <p>Waiting for logs...</p>}
                {logs.map((log, i) => (
                    <div key={i} style={{ borderBottom: '1px solid #333', padding: '2px 0', color: log.includes('❌') ? '#ff4444' : (log.includes('✅') ? '#00ff00' : '#ccc') }}>
                        {log}
                    </div>
                ))}
            </div>
        </div>
    );
}
