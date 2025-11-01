// pages/watch/[videoId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useCallback } from 'react';
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
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [showSeekIcon, setShowSeekIcon] = useState({ direction: null, visible: false });
    const seekTimeoutRef = useRef(null);
    const [watermarkPos, setWatermarkPos] = useState({ top: '15%', left: '15%' });
    const watermarkIntervalRef = useRef(null);
    const [isSeeking, setIsSeeking] = useState(false);
    const progressBarRef = useRef(null);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [availablePlaybackRates, setAvailablePlaybackRates] = useState([]);
    const [videoQuality, setVideoQuality] = useState('auto');
    const [availableQualityLevels, setAvailableQualityLevels] = useState([]);
    const [qualitiesFetched, setQualitiesFetched] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    
    // Ref للعنصر الحاوي (لإصلاح ملء الشاشة)
    const playerWrapperRef = useRef(null);

    useEffect(() => {
        // (إصلاح التوافق مع الأندرويد)
        const urlParams = new URLSearchParams(window.location.search);
        const urlUserId = urlParams.get('userId');
        const urlFirstName = urlParams.get('firstName');
        let tgUser = null;
        if (urlUserId && urlUserId.trim() !== '') {
            tgUser = { 
                id: urlUserId, 
                first_name: urlFirstName ? decodeURIComponent(urlFirstName) : "User"
            };
        } else if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
            window.Telegram.WebApp.ready();
            tgUser = window.Telegram.WebApp.initDataUnsafe?.user;
        }
        if (tgUser && tgUser.id) { 
            setUser(tgUser); 
        } else { 
            setError("خطأ: لا يمكن التعرف على المستخدم."); 
            return; 
        }

        if (videoId) {
            fetch(`/api/secure/get-video-id?lessonId=${videoId}`)
                .then(res => { if (!res.ok) throw new Error('لا تملك صلاحية مشاهدة هذا الفيديو'); return res.json(); })
                .then(data => setYoutubeId(data.youtube_video_id))
                .catch(err => setError(err.message));
        }

        const progressInterval = setInterval(() => { if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function' && !isSeeking) { setCurrentTime(playerRef.current.getCurrentTime()); } }, 500);
        watermarkIntervalRef.current = setInterval(() => {
            const newTop = Math.floor(Math.random() * 70) + 10;
            const newLeft = Math.floor(Math.random() * 70) + 10;
            setWatermarkPos({ top: `${newTop}%`, left: `${newLeft}%` });
        }, 5000);
        
        // (متابعة حالة ملء الشاشة)
        const handleFullscreenChange = () => {
            const isFs = !!(document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
            setIsFullscreen(isFs);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('msfullscreenchange', handleFullscreenChange);

        return () => { 
            clearInterval(progressInterval); 
            clearInterval(watermarkIntervalRef.current); 
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.removeEventListener('msfullscreenchange', handleFullscreenChange);
        };
    }, [videoId, isSeeking]);

    // (دالة ترجمة الجودات)
    const formatQualityLabel = (quality) => {
        const qualityMap = {
            hd1080: '1080p',
            hd720: '720p',
            large: '480p',
            medium: '360p',
            small: '240p',
            tiny: '144p',
            auto: 'تلقائي'
        };
        return qualityMap[quality] || quality;
    };
    
    // (دوال التحكم الأساسية)
    const handlePlayPause = () => { if (!playerRef.current) return; const playerState = playerRef.current.getPlayerState(); if (playerState === 1) { playerRef.current.pauseVideo(); } else { playerRef.current.playVideo(); } };
    const handleSeek = (direction) => { if (!playerRef.current) return; const currentTimeVal = playerRef.current.getCurrentTime(); const newTime = direction === 'forward' ? currentTimeVal + 10 : currentTimeVal - 10; playerRef.current.seekTo(newTime, true); setShowSeekIcon({ direction: direction, visible: true }); if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current); seekTimeoutRef.current = setTimeout(() => { setShowSeekIcon({ direction: null, visible: false }); }, 600); };
    
    // --- [ ✅ إصلاح سماحية ملء الشاشة مدمج هنا ] ---
    const onPlayerReady = useCallback((event) => {
        playerRef.current = event.target;
        setDuration(event.target.getDuration());
        const rates = playerRef.current.getAvailablePlaybackRates();
        if (rates && rates.length > 0) {
            setAvailablePlaybackRates(rates);
            setPlaybackRate(playerRef.current.getPlaybackRate());
        }

        // (هذا هو الكود المضاف لضمان السماحية للـ WebView)
        try {
            const iframe = event.target.getIframe();
            if (iframe) {
                iframe.setAttribute('allow', 'fullscreen; autoplay; encrypted-media');
                iframe.setAttribute('allowfullscreen', 'true');
            }
        } catch (e) {
            console.error("Failed to set iframe attributes:", e);
        }
    }, []); // نهاية onPlayerReady

    const handleOnPlay = () => { setIsPlaying(true); if (playerRef.current && !qualitiesFetched) { const qualities = playerRef.current.getAvailableQualityLevels(); if (qualities && qualities.length > 0) { setAvailableQualityLevels(['auto', ...qualities]); setVideoQuality(playerRef.current.getPlaybackQuality()); setQualitiesFetched(true); } } };
    
    // (دوال شريط التمرير)
    const calculateSeekTime = (e) => { if (!progressBarRef.current || duration === 0) return null; const bar = progressBarRef.current; const rect = bar.getBoundingClientRect(); const clientX = e.touches ? e.touches[0].clientX : e.clientX; const boundedX = Math.max(0, Math.min(rect.width, clientX - rect.left)); const seekRatio = boundedX / rect.width; return seekRatio * duration; };
    const handleScrubStart = (e) => { e.preventDefault(); setIsSeeking(true); const seekTime = calculateSeekTime(e); if (seekTime !== null) { setCurrentTime(seekTime); playerRef.current.seekTo(seekTime, true); } window.addEventListener('mousemove', handleScrubbing); window.addEventListener('touchmove', handleScrubbing); window.addEventListener('mouseup', handleScrubEnd); window.addEventListener('touchend', handleScrubEnd); };
    const handleScrubbing = (e) => { const seekTime = calculateSeekTime(e); if (seekTime !== null) { setCurrentTime(seekTime); playerRef.current.seekTo(seekTime, true); } };
    const handleScrubEnd = () => { setIsSeeking(false); window.removeEventListener('mousemove', handleScrubbing); window.removeEventListener('touchmove', handleScrubbing); window.removeEventListener('mouseup', handleScrubEnd); window.removeEventListener('touchend', handleScrubEnd); };
    
    // (دالة السرعة وتنسيق الوقت)
    const handleSetPlaybackRate = (e) => { const newRate = parseFloat(e.target.value); if (playerRef.current && !isNaN(newRate)) { playerRef.current.setPlaybackRate(newRate); setPlaybackRate(newRate); } };
    const formatTime = (timeInSeconds) => { if (isNaN(timeInSeconds) || timeInSeconds <= 0) return '0:00'; const minutes = Math.floor(timeInSeconds / 60); const seconds = Math.floor(timeInSeconds % 60).toString().padStart(2, '0'); return `${minutes}:${seconds}`; };
    
    // --- [ ✅ إصلاح زر الجودة (لعرض القيمة الحقيقية) ] ---
    // 1. دالة "طلب" تغيير الجودة
    const handleSetQuality = (e) => {
        const newQuality = e.target.value;
        if (!playerRef.current) return;
        playerRef.current.setPlaybackQuality(newQuality);
        console.log(`▶️ تم طلب تغيير الجودة إلى ${newQuality}...`);
    };
    // 2. دالة "الاستجابة" عند تغيير الجودة الفعلي
    const handleActualQualityChange = (event) => {
        const actualQuality = event.data;
        if (actualQuality) {
            console.log(`✅ الجودة تغيرت بالفعل إلى: ${actualQuality}`);
            setVideoQuality(actualQuality); // تحديث القائمة
        }
    };
    // --- [ نهاية إصلاح الجودة ] ---

    // --- [ ✅ إصلاح دالة ملء الشاشة (لاستهداف الحاوية) ] ---
    const handleFullscreen = () => {
        const elem = playerWrapperRef.current; // استهداف العنصر الحاوي
        if (!elem) return;
        const requestFS = elem.requestFullscreen || elem.mozRequestFullScreen || elem.webkitRequestFullscreen || elem.msRequestFullscreen;
        const exitFS = document.exitFullscreen || document.mozCancelFullScreen || document.webkitExitFullscreen || document.msExitFullscreen;
        if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
            if (requestFS) {
                requestFS.call(elem); 
                setIsFullscreen(true);
            }
        } else {
            if (exitFS) {
                exitFS.call(document);
                setIsFullscreen(false);
            }
        }
    };
    // --- [ نهاية إصلاح ملء الشاشة ] ---

    if (error) { return <div className="message-container"><Head><title>خطأ</title></Head><h1>{error}</h1></div>; }
    if (!youtubeId || !user) { return <div className="message-container"><Head><title>جاري التحميل</title></Head><h1>جاري تحميل الفيديو...</h1></div>; }
    const opts = { playerVars: { autoplay: 0, controls: 0, rel: 0, showinfo: 0, modestbranding: 1, disablekb: 1, }, };

    return (
        <div className="page-container">
            <Head>
                <title>مشاهدة الدرس</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
            </Head>

            {/* (إضافة Ref هنا) */}
            <div className="player-wrapper" ref={playerWrapperRef}>
                <YouTube
                    videoId={youtubeId}
                    opts={opts}
                    className="youtube-player"
                    iframeClassName="youtube-iframe"
                    onReady={onPlayerReady}
                    onPlay={handleOnPlay}
                    onPause={() => setIsPlaying(false)}
                    onEnd={() => setIsPlaying(false)}
                    // (ربط دالة استجابة الجودة)
                    onPlaybackQualityChange={handleActualQualityChange}
                />

                <div className="controls-overlay">
                    <div className="interaction-grid">
                        <div className="seek-zone" onDoubleClick={() => handleSeek('backward')}></div>
                        <div className="play-pause-zone" onClick={handlePlayPause}>
                            {!isPlaying && <div className="play-icon">▶</div>}
                        </div>
                        <div className="seek-zone" onDoubleClick={() => handleSeek('forward')}></div>
                    </div>

                    <div className="bottom-controls">
                        <div className="extra-controls">
                            {availableQualityLevels.length > 0 && (
                                <select className="control-select" value={videoQuality} onChange={handleSetQuality}>
                                    {availableQualityLevels.map(quality => (
                                        <option key={quality} value={quality}>
                                            {formatQualityLabel(quality)}
                                        </option>
                                    ))}
                                </select>
                            )}
                            {availablePlaybackRates.length > 0 && (
                                <select className="control-select" value={playbackRate} onChange={handleSetPlaybackRate}>
                                    {availablePlaybackRates.map(rate => (
                                        <option key={rate} value={rate}>{rate}x</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <span className="time-display">{formatTime(currentTime)}</span>
                        <div
                            ref={progressBarRef}
                            className="progress-bar-container"
                            onMouseDown={handleScrubStart}
                            onTouchStart={handleScrubStart}
                        >
                            <div className="progress-bar-track"></div>
                            <div className="progress-bar-filled" style={{ width: `${(currentTime / duration) * 100}%` }}></div>
                            <div className="progress-bar-handle" style={{ left: `${(currentTime / duration) * 100}%` }}></div>
                        </div>
                        <span className="time-display">{formatTime(duration)}</span>
                        
                        <button className="fullscreen-btn" onClick={handleFullscreen} title="ملء الشاشة">
                            {isFullscreen ? '⤡' : '⛶'}
                        </button>
                    </div>

                    {showSeekIcon.visible && (
                        <div className={`seek-indicator ${showSeekIcon.direction}`}>
                            {showSeekIcon.direction === 'forward' ? '» 10' : '10 «'}
                        </div>
                    )}

                    <div className="watermark" style={{ top: watermarkPos.top, left: watermarkPos.left }}>
                        {user.first_name} ({user.id})
                    </div>
                </div>
            </div>

{/* --- [ ✅ إضافة معلومات المبرمج ] --- */}
            <footer className="developer-info" style={{ maxWidth: '900px', margin: '30px auto 0' }}>
              <p>برمجة وتطوير: A7MeD WaLiD</p>
              <p>للتواصل: <a href="https://t.me/A7MeDWaLiD0" target="_blank" rel="noopener noreferrer">اضغط هنا</a></p>
            </footer>
            {/* --- [ نهاية الإضافة ] --- */}
            {/* (الـ CSS بالكامل مع إصلاح ملء الشاشة) */}
            <style jsx global>{`
                body { margin: 0; overscroll-behavior: contain; }
                .page-container { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; width: 100%; padding: 10px; box-sizing: border-box; }
                .message-container { display: flex; align-items: center; justify-content: center; height: 100vh; color: white; padding: 20px; text-align: center; }
                .player-wrapper { position: relative; width: 100%; max-width: 900px; aspect-ratio: 16 / 13; background: #111; }
                
                /* (CSS لملء الشاشة) */
                .player-wrapper:fullscreen,
                .player-wrapper:-webkit-full-screen,
                .player-wrapper:-moz-full-screen,
                .player-wrapper:-ms-fullscreen {
                    width: 100%;
                    height: 100%;
                    max-width: none;
                    aspect-ratio: auto; 
                }
                
                .youtube-player, .youtube-iframe { width: 100%; height: 100%; }
                .controls-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 10; display: flex; flex-direction: column; justify-content: space-between; }
                .interaction-grid { flex-grow: 1; display: flex; direction: ltr; }
                .seek-zone { flex: 1; height: 100%; }
                .play-pause-zone { flex: 2; height: 100%; display: flex; justify-content: center; align-items: center; cursor: pointer; }
                .play-icon { font-size: clamp(40px, 10vw, 80px); color: white; text-shadow: 0 0 15px rgba(0,0,0,0.8); opacity: 0.9; }
                .bottom-controls { height: 40px; display: flex; align-items: center; padding: 0 10px; background: linear-gradient(to top, rgba(0,0,0,0.7), transparent); z-index: 11; gap: 10px; }
                .extra-controls { display: flex; gap: 8px; direction: ltr; }
                .control-select { background-color: rgba(255, 255, 255, 0.2); color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: clamp(11px, 2.5vw, 14px); cursor: pointer; -webkit-appearance: none; -moz-appearance: none; appearance: none; direction: ltr; text-align: center; text-align-last: center; }
                .control-select option { background-color: #333; color: white; }
                .time-display { color: white; font-size: clamp(11px, 2.5vw, 14px); margin: 0 5px; min-width: 40px; text-align: center; }
                .progress-bar-container { position: relative; flex-grow: 1; height: 15px; display: flex; align-items: center; cursor: pointer; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; direction: ltr; }
                .progress-bar-track { position: absolute; width: 100%; height: 4px; background: rgba(255, 255, 255, 0.3); border-radius: 2px; transition: height 0.1s ease; }
                .progress-bar-filled { position: absolute; height: 4px; background: #FF0000; border-radius: 2px; transition: height 0.1s ease; }
                .progress-bar-handle { position: absolute; width: 12px; height: 12px; background-color: #FF0000; border-radius: 50%; transform: translateX(-50%); transition: transform 0.1s ease, height 0.1s ease, width 0.1s ease; }
                .progress-bar-container:hover .progress-bar-track, .progress-bar-container:hover .progress-bar-filled { height: 6px; }
                .progress-bar-container:hover .progress-bar-handle { transform: translateX(-50%) scale(1.2); }
                .seek-indicator { position: absolute; top: 50%; transform: translate(-50%, -50%); font-size: clamp(30px, 6vw, 40px); color: white; opacity: 0.8; animation: seek-pop 0.6s ease-out; pointer-events: none; direction: ltr; }
                .seek-indicator.forward { left: 75%; }
                .seek-indicator.backward { left: 25%; }
                @keyframes seek-pop { 0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; } 50% { transform: translate(-50%, -50%) scale(1.2); } 100% { transform: translate(-50%, -50%) scale(1); opacity: 0; } }
                .watermark { position: absolute; padding: 4px 8px; background: rgba(0, 0, 0, 0.7); color: white; font-size: clamp(10px, 2.5vw, 14px); border-radius: 4px; font-weight: bold; pointer-events: none; transition: top 2s ease-in-out, left 2s ease-in-out; white-space: nowrap; z-index: 20; }
                .fullscreen-btn { background: none; border: none; color: white; font-size: clamp(18px, 3vw, 22px); cursor: pointer; padding: 0 5px; line-height: 1; font-weight: bold; min-width: 25px; }
                .fullscreen-btn:hover { color: #FF0000; }
            `}</style>
        </div>
    );
}
