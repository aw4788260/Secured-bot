// pages/watch/[videoId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useCallback } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';

const Plyr = dynamic(() => import('plyr-react'), { ssr: false });
import 'plyr/dist/plyr.css';

const Watermark = ({ user }) => {
    const [watermarkPos, setWatermarkPos] = useState({ top: '15%', left: '15%' });
    const watermarkIntervalRef = useRef(null);

    useEffect(() => {
        if (!user) return;
        watermarkIntervalRef.current = setInterval(() => {
            const newTop = Math.floor(Math.random() * 70) + 10;
            const newLeft = Math.floor(Math.random() * 70) + 10;
            setWatermarkPos({ top: `${newTop}%`, left: `${newLeft}%` });
        }, 5000);
        return () => watermarkIntervalRef.current && clearInterval(watermarkIntervalRef.current);
    }, [user]);

    return (
        <div className="watermark" style={{
            position: 'absolute', top: watermarkPos.top, left: watermarkPos.left,
            zIndex: 15, pointerEvents: 'none', padding: '4px 8px',
            background: 'rgba(0,0,0,0.7)', color: 'white',
            fontSize: 'clamp(10px, 2.5vw, 14px)', borderRadius: '4px',
            fontWeight: 'bold', transition: 'top 2s, left 2s', whiteSpace: 'nowrap'
        }}>
            {user.first_name} ({user.id})
        </div>
    );
};

export default function WatchPage() {
    const router = useRouter();
    const { videoId } = router.query;

    const [streamUrl, setStreamUrl] = useState(null);
    const [qualities, setQualities] = useState([]);  // NEW
    const [youtubeId, setYoutubeId] = useState(null);
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    const [videoTitle, setVideoTitle] = useState("جاري التحميل...");
    const [isNativeAndroid, setIsNativeAndroid] = useState(false);

    const plyrRef = useRef(null);
    const hlsRef = useRef(null);

    // ---------------------------
    // 1. قراءة ملف m3u8 لجلب الجودات
    // ---------------------------
    const parseM3U8 = useCallback(async (url) => {
        try {
            const res = await fetch(url);
            const text = await res.text();

            const pattern = /#EXT-X-STREAM-INF:.*?RESOLUTION=(\d+x\d+).*?\n(.*\.m3u8)/g;
            const found = [...text.matchAll(pattern)];

            const q = found.map(m => ({
                resolution: m[1],
                url: new URL(m[2], url).toString(),
                height: parseInt(m[1].split("x")[1])
            })).sort((a, b) => b.height - a.height);

            setQualities(q);
        } catch (e) {
            console.log("Quality parse error", e);
        }
    }, []);

    // ---------------------------
    // 2. تشغيل HLS + إضافة الجودات
    // ---------------------------
    const initHLSPlayer = useCallback(() => {
        if (!streamUrl) return;

        const video = plyrRef.current?.plyr?.media;
        if (!video) {
            setTimeout(initHLSPlayer, 200);
            return;
        }

        if (window.Hls && window.Hls.isSupported()) {
            const hls = new window.Hls({
                enableWorker: true,
                maxBufferLength: 30,
                maxMaxBufferLength: 600
            });

            hlsRef.current = hls;

            hls.loadSource(streamUrl);
            hls.attachMedia(video);

            hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
                const availableQualities = hls.levels.map(l => l.height).sort((a, b) => b - a);

                plyrRef.current.plyr.options.quality = {
                    default: availableQualities[0],
                    options: availableQualities,
                    forced: true,
                    onChange: (newQuality) => {
                        hls.levels.forEach((lvl, i) => {
                            if (lvl.height === newQuality) hls.currentLevel = i;
                        });
                    }
                };
            });

        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = streamUrl;
        }
    }, [streamUrl]);

    // ---------------------------
    // 3. Call init when ready
    // ---------------------------
    useEffect(() => {
        if (streamUrl) setTimeout(initHLSPlayer, 300);
    }, [streamUrl, initHLSPlayer]);


    // ---------------------------
    // 4. Load API Data
    // ---------------------------
    useEffect(() => {
        const setupUser = (u) => {
            if (u?.id) setUser(u);
            else setError("خطأ: لا يمكن التعرف على المستخدم.");
        };

        const params = new URLSearchParams(window.location.search);
        const uid = params.get("userId");
        const fn = params.get("firstName");

        if (uid) {
            setupUser({ id: uid, first_name: fn || "User" });
            if (window.Android) setIsNativeAndroid(true);
        } else if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.ready();
            const u = window.Telegram.WebApp.initDataUnsafe?.user;
            setupUser(u);
        } else setError("يرجى الفتح من التطبيق.");

        if (videoId) {
            fetch(`/api/secure/get-video-id?lessonId=${videoId}`)
                .then(r => r.ok ? r.json() : r.json().then(err => { throw new Error(err.message); }))
                .then(data => {
                    setStreamUrl(data.streamUrl);
                    setYoutubeId(data.youtube_video_id);
                    setVideoTitle(data.videoTitle || "مشاهدة الدرس");
                    parseM3U8(data.streamUrl); // NEW
                })
                .catch(e => setError(e.message));
        }
    }, [videoId, parseM3U8]);


    const plyrSrc = {
        type: "video",
        title: videoTitle,
        sources: [{ src: streamUrl, type: "application/x-mpegURL" }]
    };

    const plyrOptions = {
        controls: [
            "play-large", "play", "progress",
            "current-time", "mute", "volume",
            "settings", "fullscreen"
        ],
        settings: ["quality", "speed"],
        quality: { default: 720, options: [] }
    };

    const handleDownload = () => {
        if (!youtubeId) return alert("انتظر..");
        if (isNativeAndroid) {
            try { window.Android.downloadVideo(youtubeId, videoTitle); }
            catch { alert("خطأ في الاتصال."); }
        } else alert("متاح فقط داخل التطبيق.");
    };

    if (error) return <div className="message-container"><h1>{error}</h1></div>;
    if (!user || !streamUrl) return <div className="message-container"><h1>جاري التحميل...</h1></div>;

    return (
        <div className="page-container">
            <Head>
                <title>مشاهدة الدرس</title>
                <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.8"></script>
            </Head>

            <div className="player-wrapper">
                <Plyr ref={plyrRef} source={plyrSrc} options={plyrOptions} />
                <Watermark user={user} />
            </div>

            {isNativeAndroid && (
                <button onClick={handleDownload} className="download-button-native">
                    ⬇️ تحميل الفيديو
                </button>
            )}

            <style jsx global>{`
                body { margin: 0; background: #111; color: white; }
                .page-container { padding: 10px; }
                .player-wrapper { width: 100%; max-width: 900px; aspect-ratio: 16/9; position: relative; }
                .message-container { height: 100vh; display: flex; justify-content: center; align-items: center; }
            `}</style>
        </div>
    );
}
