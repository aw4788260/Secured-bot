import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import Script from 'next/script';

export default function WatchPage() {
    const router = useRouter();
    const { videoId } = router.query;
    
    const [originalUrl, setOriginalUrl] = useState(null);
    const [logs, setLogs] = useState([]);
    const [useProxy, setUseProxy] = useState(false); // حالة التبديل بين البروكسي والمباشر
    const videoRef = useRef(null);
    const hlsRef = useRef(null);

    // دالة اللوج
    const addLog = (msg, type = 'info') => {
        const time = new Date().toLocaleTimeString().split(' ')[0];
        setLogs(prev => [`[${time}] [${type.toUpperCase()}] ${msg}`, ...prev].slice(0, 50));
    };

    // 1. جلب الرابط الأصلي فقط
    useEffect(() => {
        if (videoId) {
            addLog(`Fetching details for ID: ${videoId}`, 'info');
            fetch(`/api/secure/get-video-id?lessonId=${videoId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.streamUrl) {
                        const url = data.streamUrl.trim();
                        setOriginalUrl(url);
                        addLog(`Original URL found.`, 'success');
                    } else {
                        addLog('Stream URL is empty!', 'error');
                    }
                })
                .catch(err => addLog(`API Error: ${err.message}`, 'error'));
        }
    }, [videoId]);

    // 2. دالة تشغيل HLS
    const initPlayer = () => {
        if (!originalUrl || !videoRef.current || !window.Hls) return;

        // تدمير النسخة السابقة
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        // تحديد الرابط بناءً على الوضع المختار
        let playUrl = originalUrl;
        if (useProxy) {
            playUrl = `/api/proxy-m3u8?url=${encodeURIComponent(originalUrl)}`;
            addLog(`🔄 Mode: PROXY. Connecting to local API...`, 'warning');
        } else {
            addLog(`DIRECT Mode. Connecting to Google directly...`, 'warning');
        }

        if (window.Hls.isSupported()) {
            const hls = new window.Hls({
                debug: false,
                enableWorker: true,
                xhrSetup: function (xhr, url) {
                    xhr.withCredentials = false;
                }
            });

            hls.loadSource(playUrl);
            hls.attachMedia(videoRef.current);

            hls.on(window.Hls.Events.MANIFEST_LOADED, () => {
                addLog(`✅ MANIFEST_LOADED. Connection successful!`, 'success');
            });

            hls.on(window.Hls.Events.MANIFEST_PARSED, (event, data) => {
                addLog(`✅ PARSED. Found ${data.levels.length} qualities. Starting playback...`, 'success');
                videoRef.current.play().catch(e => addLog(`Autoplay blocked: ${e.message}`, 'error'));
            });

            hls.on(window.Hls.Events.FRAG_LOADED, (event, data) => {
                // هذه الرسالة تعني أن الفيديو يعمل فعلياً
               // addLog(`📦 Chunk Loaded (${data.stats.loaded} bytes)`, 'success');
            });

            hls.on(window.Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    addLog(`❌ FATAL ERROR: ${data.type}`, 'error');
                    if (data.response && data.response.code) {
                        addLog(`❌ HTTP Code: ${data.response.code}`, 'error');
                    }
                    
                    switch (data.type) {
                        case window.Hls.ErrorTypes.NETWORK_ERROR:
                            addLog(`Network blocked. Try switching mode.`, 'error');
                            hls.destroy();
                            break;
                        default:
                            hls.destroy();
                            break;
                    }
                }
            });

            hlsRef.current = hls;
        }
    };

    // إعادة التشغيل عند تغيير الوضع أو الرابط
    useEffect(() => {
        if (originalUrl) {
            initPlayer();
        }
    }, [originalUrl, useProxy]);

    return (
        <div style={{ background: '#111', minHeight: '100vh', color: '#fff', padding: '10px', fontFamily: 'monospace' }}>
            <Head>
                <title>Super Debugger</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <meta name="referrer" content="no-referrer" />
            </Head>

            <Script 
                src="https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js" 
                onLoad={() => {
                    addLog('HLS Library Loaded', 'success');
                    if(originalUrl) initPlayer();
                }}
            />

            <h3 style={{textAlign: 'center', color: '#38bdf8'}}>Super Debugger</h3>
            
            {/* أزرار التحكم */}
            <div style={{display: 'flex', gap: '10px', marginBottom: '10px', justifyContent: 'center'}}>
                <button 
                    onClick={() => setUseProxy(false)}
                    style={{
                        padding: '10px', background: useProxy ? '#333' : '#ff4444', 
                        color: 'white', border: 'none', borderRadius: '5px', flex: 1
                    }}
                >
                    1. Test Direct
                </button>
                <button 
                    onClick={() => setUseProxy(true)}
                    style={{
                        padding: '10px', background: useProxy ? '#00C851' : '#333', 
                        color: 'white', border: 'none', borderRadius: '5px', flex: 1
                    }}
                >
                    2. Test Proxy
                </button>
            </div>

            <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#000', marginBottom: '10px' }}>
                <video ref={videoRef} controls playsInline muted style={{ width: '100%', height: '100%' }} />
            </div>

            {/* شاشة اللوج */}
            <div style={{ 
                background: '#000', border: '1px solid #333', height: '300px', 
                overflowY: 'scroll', padding: '10px', fontSize: '11px', lineHeight: '1.5' 
            }}>
                <div style={{borderBottom: '1px solid #555', paddingBottom: '5px', marginBottom: '5px', color: '#aaa'}}>
                    LOGS (Newest First):
                </div>
                {logs.map((log, i) => (
                    <div key={i} style={{ 
                        color: log.includes('ERROR') ? '#ff4444' : (log.includes('SUCCESS') ? '#00C851' : (log.includes('WARNING') ? '#ffbb33' : '#ccc')),
                        borderBottom: '1px solid #222' 
                    }}>
                        {log}
                    </div>
                ))}
            </div>
        </div>
    );
}
