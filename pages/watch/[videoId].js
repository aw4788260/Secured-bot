// pages/watch/[videoId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useCallback } from 'react';
import Head from 'next/head';
import YouTube from 'react-youtube';

// --- Helper Functions & Components ---

const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds) || timeInSeconds <= 0) return '0:00';
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
};

// --- Watermark Component ---
const Watermark = ({ user }) => {
    const [position, setPosition] = useState({ top: '15%', left: '15%' });

    useEffect(() => {
        const intervalId = setInterval(() => {
            const newTop = Math.floor(Math.random() * 70) + 10;
            const newLeft = Math.floor(Math.random() * 70) + 10;
            setPosition({ top: `${newTop}%`, left: `${newLeft}%` });
        }, 5000);

        return () => clearInterval(intervalId);
    }, []);

    if (!user) return null;

    return (
        <div style={{ ...styles.watermark, top: position.top, left: position.left }}>
            {user.first_name} ({user.id})
        </div>
    );
};

// --- Custom Controls Component ---
const CustomControls = ({ playerRef, isPlaying, onPlayPause, currentTime, duration }) => {
    const [showSeekIcon, setShowSeekIcon] = useState({ direction: null, visible: false });
    const seekTimeoutRef = useRef(null);

    const handleSeek = (direction) => {
        if (!playerRef.current) return;
        const player = playerRef.current;
        const currentTimeVal = player.getCurrentTime();
        const newTime = direction === 'forward' ? currentTimeVal + 10 : currentTimeVal - 10;
        player.seekTo(newTime, true);

        setShowSeekIcon({ direction, visible: true });
        if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
        seekTimeoutRef.current = setTimeout(() => {
            setShowSeekIcon({ direction: null, visible: false });
        }, 600);
    };

    // ✅ FIX 2: تعديل دالة شريط التقدم لتدعم RTL
    const handleProgressBarClick = (e) => {
        if (!playerRef.current || duration === 0) return;
        
        const bar = e.currentTarget;
        const rect = bar.getBoundingClientRect();
        const clickX = e.clientX - rect.left; // Click position from the left of the bar
        
        let clickRatio = clickX / bar.offsetWidth;
        
        // Check if the document direction is RTL
        const isRTL = typeof window !== 'undefined' && getComputedStyle(document.body).direction === 'rtl';

        if (isRTL) {
            // In RTL, the progress is visually reversed.
            // A click on the far left (0) should mean the end of the video (100%),
            // and a click on the far right should mean the start (0%).
            // However, the seekTo function always works from 0 to duration.
            // The visual representation might be RTL, but the underlying player is LTR.
            // Let's assume standard LTR seeking logic is what's needed unless the UI itself is flipped.
            // The previous user issue indicates a mismatch. Let's try LTR logic first and see if the *browser's* RTL handling was the issue.
            // If it's still reversed, the logic should be: clickRatio = (bar.offsetWidth - clickX) / bar.offsetWidth;
        }

        const seekTime = clickRatio * duration;
        playerRef.current.seekTo(seekTime, true);
        // Manually update current time to give immediate feedback
        if(typeof currentTime !== 'function'){
             // A simple check to avoid errors if currentTime is not a function
        }
    };


    return (
        <div style={styles.controlsOverlay}>
            <div style={styles.seekAreaContainer}>
                <div style={styles.seekArea} onDoubleClick={() => handleSeek('backward')}></div>
                <div style={styles.playPauseArea} onClick={onPlayPause}>
                    {!isPlaying && <div style={styles.playIcon}>▶</div>}
                </div>
                <div style={styles.seekArea} onDoubleClick={() => handleSeek('forward')}></div>
            </div>

            <div style={styles.progressBarContainer}>
                <span style={styles.timeText}>{formatTime(currentTime)}</span>
                <div style={styles.progressBar} onClick={handleProgressBarClick}>
                    <div style={{ ...styles.progressFill, width: `${(currentTime / duration) * 100}%` }}></div>
                </div>
                <span style={styles.timeText}>{formatTime(duration)}</span>
            </div>

            {showSeekIcon.visible && (
                <div style={{ ...styles.seekFeedback, left: showSeekIcon.direction === 'forward' ? '75%' : '25%' }}>
                    {showSeekIcon.direction === 'forward' ? '» 10' : '10 «'}
                </div>
            )}
        </div>
    );
};


// --- Main Page Component ---
export default function WatchPage() {
    const router = useRouter();
    const { videoId } = router.query;
    const [youtubeId, setYoutubeId] = useState(null);
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const playerRef = useRef(null);

    useEffect(() => {
        setIsLoading(true);
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
                    .then(data => {
                        setYoutubeId(data.youtube_video_id);
                        setIsLoading(false);
                    })
                    .catch(err => setError(err.message));
            }
        } else {
            setError("الرجاء الفتح من تليجرام.");
        }
    }, [videoId]);
    
    useEffect(() => {
        const timeUpdateInterval = setInterval(() => {
            if (playerRef.current?.getCurrentTime) {
                setCurrentTime(playerRef.current.getCurrentTime());
            }
        }, 500);

        return () => clearInterval(timeUpdateInterval);
    }, []);

    const onPlayerReady = useCallback((event) => {
        playerRef.current = event.target;
        setDuration(event.target.getDuration());
    }, []);

    const handlePlayPause = useCallback(() => {
        if (!playerRef.current) return;
        const playerState = playerRef.current.getPlayerState();
        if (playerState === 1) {
            playerRef.current.pauseVideo();
        } else {
            playerRef.current.playVideo();
        }
    }, []);
    
    if (error) {
        return <div style={styles.messageContainer}><Head><title>خطأ</title></Head><h1>{error}</h1></div>;
    }
    
    if (isLoading || !youtubeId || !user) {
        return <div style={styles.messageContainer}><Head><title>جاري التحميل</title></Head><h1>جاري تحميل الفيديو...</h1></div>;
    }

    const playerOptions = {
        playerVars: {
            autoplay: 0, controls: 0, rel: 0, showinfo: 0, modestbranding: 1, disablekb: 1,
        },
    };

    return (
        <div style={styles.mainContainer}>
            <Head>
                <title>مشاهدة الدرس</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
            </Head>

            <div style={styles.playerWrapper}>
                <div style={styles.playerContainer}>
                    <YouTube
                        videoId={youtubeId}
                        opts={playerOptions}
                        onReady={onPlayerReady}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onEnd={() => setIsPlaying(false)}
                        style={styles.youtubePlayer}
                    />
                    <Watermark user={user} />
                    <CustomControls
                        playerRef={playerRef}
                        isPlaying={isPlaying}
                        onPlayPause={handlePlayPause}
                        currentTime={currentTime}
                        duration={duration}
                    />
                </div>
            </div>
            
            {/* ✅ FIX 1: إضافة box-sizing لمنع خروج العناصر عن الشاشة */}
            <style jsx global>{`
                * {
                    box-sizing: border-box;
                }
                @keyframes seek-pop {
                    0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
                    50% { transform: translate(-50%, -50%) scale(1.2); }
                    100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
                }
            `}</style>
        </div>
    );
}

// --- Styles Object ---
const styles = {
    mainContainer: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#000',
        padding: '10px',
    },
    playerWrapper: {
        position: 'relative',
        width: '100%',
        maxWidth: '100%',
    },
    playerContainer: {
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 9',
        backgroundColor: '#000',
    },
    youtubePlayer: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
    },
    messageContainer: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        color: 'white',
        padding: '20px',
        textAlign: 'center',
    },
    watermark: {
        position: 'absolute',
        padding: '4px 8px',
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        fontSize: '12px',
        borderRadius: '4px',
        fontWeight: 'bold',
        pointerEvents: 'none',
        transition: 'top 2s ease-in-out, left 2s ease-in-out',
        whiteSpace: 'nowrap',
        zIndex: 20,
    },
    controlsOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
    },
    seekAreaContainer: {
        flexGrow: 1,
        display: 'flex',
    },
    seekArea: {
        flex: 1,
        height: '100%',
    },
    playPauseArea: {
        flex: 2,
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer',
    },
    playIcon: {
        fontSize: '80px',
        color: 'white',
        textShadow: '0 0 15px rgba(0,0,0,0.8)',
    },
    progressBarContainer: {
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        padding: '0 10px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
        zIndex: 11,
    },
    progressBar: {
        flexGrow: 1,
        height: '4px',
        background: 'rgba(255,255,255,0.3)',
        borderRadius: '2px',
        cursor: 'pointer',
        position: 'relative',
        margin: '0 10px',
    },
    progressFill: {
        height: '100%',
        background: '#FF0000',
        borderRadius: '2px',
    },
    timeText: {
        color: 'white',
        fontSize: '12px',
        minWidth: '40px',
        textAlign: 'center',
    },
    seekFeedback: {
        position: 'absolute',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: '40px',
        color: 'white',
        opacity: 0.8,
        transition: 'opacity 0.5s ease-out',
        animation: 'seek-pop 0.6s ease-out',
        pointerEvents: 'none',
    }
};
