// pages/watch/[videoId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import YouTube from 'react-youtube';

export default function WatchPage() {
    const router = useRouter();
    const { videoId } = router.query;
    const [youtubeId, setYoutubeId] = useState(null);
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const playerRef = useRef(null);

    // --- متغيرات حالة لشريط التقدم والتحكم ---
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [showSeekIcon, setShowSeekIcon] = useState({ direction: null, visible: false });
    const seekTimeoutRef = useRef(null);

    // --- متغيرات حالة لموقع العلامة المائية ---
    const [watermarkPos, setWatermarkPos] = useState({ top: '15%', left: '15%' });
    const watermarkIntervalRef = useRef(null);

    useEffect(() => {
        // التحقق من وجود كائن تليجرام
        if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
            window.Telegram.WebApp.ready();
            const tgUser = window.Telegram.WebApp.initDataUnsafe?.user;

            if (tgUser) {
                setUser(tgUser);
            } else {
                setError("خطأ: لا يمكن التعرف على المستخدم.");
                return;
            }

            if (videoId) {
                fetch(`/api/secure/get-video-id?lessonId=${videoId}`)
                    .then(res => {
                        if (!res.ok) throw new Error('لا تملك صلاحية مشاهدة هذا الفيديو');
                        return res.json();
                    })
                    .then(data => setYoutubeId(data.youtube_video_id))
                    .catch(err => setError(err.message));
            }
        } else {
            setError("الرجاء الفتح من تليجرام.");
        }

        // تحديث الوقت الحالي للفيديو
        const progressInterval = setInterval(() => {
            if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
                setCurrentTime(playerRef.current.getCurrentTime());
            }
        }, 500);

        // بدء حركة العلامة المائية
        watermarkIntervalRef.current = setInterval(() => {
            const newTop = Math.floor(Math.random() * 70) + 10; // بين 10% و 80%
            const newLeft = Math.floor(Math.random() * 70) + 10; // بين 10% و 80%
            setWatermarkPos({ top: `${newTop}%`, left: `${newLeft}%` });
        }, 5000); // تغيير الموقع كل 5 ثوانٍ

        // دالة التنظيف
        return () => {
            clearInterval(progressInterval);
            clearInterval(watermarkIntervalRef.current);
        };

    }, [videoId]);

    const handlePlayPause = () => {
        if (!playerRef.current) return;
        const playerState = playerRef.current.getPlayerState();
        if (playerState === 1) { // is playing
            playerRef.current.pauseVideo();
        } else {
            playerRef.current.playVideo();
        }
    };

    const handleSeek = (direction) => {
        if (!playerRef.current) return;
        const currentTimeVal = playerRef.current.getCurrentTime();
        const newTime = direction === 'forward' ? currentTimeVal + 10 : currentTimeVal - 10;
        playerRef.current.seekTo(newTime, true);

        setShowSeekIcon({ direction: direction, visible: true });
        if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
        seekTimeoutRef.current = setTimeout(() => {
            setShowSeekIcon({ direction: null, visible: false });
        }, 600);
    };

    const onPlayerReady = (event) => {
        playerRef.current = event.target;
        setDuration(event.target.getDuration());
    };

    const handleProgressBarClick = (e) => {
        if (!playerRef.current || duration === 0) return;
        const bar = e.currentTarget;
        const clickPosition = e.clientX - bar.getBoundingClientRect().left;
        const barWidth = bar.offsetWidth;
        const seekTime = (clickPosition / barWidth) * duration;
        playerRef.current.seekTo(seekTime, true);
        setCurrentTime(seekTime);
    };

    const formatTime = (timeInSeconds) => {
        if (isNaN(timeInSeconds) || timeInSeconds <= 0) return '0:00';
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
        return `${minutes}:${seconds}`;
    };

    // --- حالات العرض (خطأ أو تحميل) ---
    if (error) {
        return <div className="message-container"><Head><title>خطأ</title></Head><h1>{error}</h1></div>;
    }
    if (!youtubeId || !user) {
        return <div className="message-container"><Head><title>جاري التحميل</title></Head><h1>جاري تحميل الفيديو...</h1></div>;
    }

    const opts = {
        playerVars: {
            autoplay: 0, controls: 0, rel: 0, showinfo: 0, modestbranding: 1, disablekb: 1,
        },
    };

    return (
        <div className="page-container">
            <Head>
                <title>مشاهدة الدرس</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
            </Head>

            {/* تم استخدام خاصية aspect-ratio هنا لجعل الفيديو متجاوبًا */}
            <div className="player-wrapper">
                
                <YouTube
                    videoId={youtubeId}
                    opts={opts}
                    className="youtube-player"
                    iframeClassName="youtube-iframe"
                    onReady={onPlayerReady}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnd={() => setIsPlaying(false)}
                />

                {/* طبقة الدرع والعلامة المائية */}
                <div className="controls-overlay">
                    {/* مناطق التحكم الشفافة */}
                    <div className="interaction-grid">
                        <div className="seek-zone" onDoubleClick={() => handleSeek('backward')}></div>
                        <div className="play-pause-zone" onClick={handlePlayPause}>
                            {!isPlaying && <div className="play-icon">▶</div>}
                        </div>
                        <div className="seek-zone" onDoubleClick={() => handleSeek('forward')}></div>
                    </div>

                    {/* شريط التحكم السفلي */}
                    <div className="bottom-controls">
                        <span className="time-display">{formatTime(currentTime)}</span>
                        <div className="progress-bar-container" onClick={handleProgressBarClick}>
                            <div className="progress-bar-filled" style={{ width: `${(currentTime / duration) * 100}%` }}></div>
                        </div>
                        <span className="time-display">{formatTime(duration)}</span>
                    </div>

                    {/* أيقونة التقديم والتأخير */}
                    {showSeekIcon.visible && (
                        <div className={`seek-indicator ${showSeekIcon.direction}`}>
                            {showSeekIcon.direction === 'forward' ? '» 10' : '10 «'}
                        </div>
                    )}

                    {/* العلامة المائية */}
                    <div className="watermark" style={{ top: watermarkPos.top, left: watermarkPos.left }}>
                        {user.first_name} ({user.id})
                    </div>
                </div>
            </div>

            <style jsx global>{`
                body {
                    margin: 0;
                    background: #000;
                    overscroll-behavior: contain; /* لمنع السحب لتحديث الصفحة */
                }
                .page-container {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    width: 100%;
                    padding: 10px;
                    box-sizing: border-box;
                }
                .message-container {
                     display: flex;
                     align-items: center;
                     justify-content: center;
                     height: 100vh;
                     color: white;
                     padding: 20px;
                     text-align: center;
                }
                .player-wrapper {
                    position: relative;
                    width: 100%;
                    max-width: 900px;
                    aspect-ratio: 16 / 9; /* أهم تعديل: يضمن أبعاد الفيديو الصحيحة */
                    background: #111;
                }
                .youtube-player, .youtube-iframe {
                    width: 100%;
                    height: 100%;
                }
                .controls-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 10;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                }
                .interaction-grid {
                    flex-grow: 1;
                    display: flex;
                }
                .seek-zone { flex: 1; height: 100%; }
                .play-pause-zone {
                    flex: 2;
                    height: 100%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    cursor: pointer;
                }
                .play-icon {
                    /* تعديل: حجم متجاوب */
                    font-size: clamp(40px, 10vw, 80px);
                    color: white;
                    text-shadow: 0 0 15px rgba(0,0,0,0.8);
                    opacity: 0.9;
                }
                .bottom-controls {
                    height: 40px;
                    display: flex;
                    align-items: center;
                    padding: 0 10px;
                    background: linear-gradient(to top, rgba(0,0,0,0.7), transparent);
                    z-index: 11;
                }
                .time-display {
                    color: white;
                    font-size: clamp(11px, 2.5vw, 14px); /* تعديل: حجم متجاوب */
                    margin: 0 10px;
                    min-width: 40px;
                    text-align: center;
                }
                .progress-bar-container {
                    flex-grow: 1;
                    height: 4px;
                    background: rgba(255,255,255,0.3);
                    border-radius: 2px;
                    cursor: pointer;
                }
                .progress-bar-filled {
                    height: 100%;
                    background: #FF0000;
                    border-radius: 2px;
                }
                .seek-indicator {
                    position: absolute;
                    top: 50%;
                    transform: translate(-50%, -50%);
                    font-size: clamp(30px, 6vw, 40px); /* تعديل: حجم متجاوب */
                    color: white;
                    opacity: 0.8;
                    animation: seek-pop 0.6s ease-out;
                    pointer-events: none;
                }
                .seek-indicator.forward { left: 75%; }
                .seek-indicator.backward { left: 25%; }
                @keyframes seek-pop {
                    0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
                    50% { transform: translate(-50%, -50%) scale(1.2); }
                    100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
                }
                .watermark {
                    position: absolute;
                    padding: 4px 8px;
                    background: rgba(0, 0, 0, 0.7);
                    color: white;
                    font-size: clamp(10px, 2.5vw, 14px); /* تعديل: حجم متجاوب */
                    border-radius: 4px;
                    font-weight: bold;
                    pointer-events: none;
                    transition: top 2s ease-in-out, left 2s ease-in-out;
                    white-space: nowrap;
                    z-index: 20;
                }
            `}</style>
        </div>
    );
}
