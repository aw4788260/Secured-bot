// pages/watch/[videoId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useCallback } from 'react';
import Head from 'next/head';
import YouTube from 'react-youtube';

export default function WatchPage() {
    // ... (كل متغيرات الحالة لم تتغير)
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

    // ... (useEffect لم يتغير)
    useEffect(() => {
        if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
            window.Telegram.WebApp.ready();
            const tgUser = window.Telegram.WebApp.initDataUnsafe?.user;
            if (tgUser) { setUser(tgUser); } else { setError("خطأ: لا يمكن التعرف على المستخدم."); return; }
            if (videoId) {
                fetch(`/api/secure/get-video-id?lessonId=${videoId}`)
                    .then(res => { if (!res.ok) throw new Error('لا تملك صلاحية مشاهدة هذا الفيديو'); return res.json(); })
                    .then(data => setYoutubeId(data.youtube_video_id))
                    .catch(err => setError(err.message));
            }
        } else { setError("الرجاء الفتح من تليجرام."); }
        const progressInterval = setInterval(() => { if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function' && !isSeeking) { setCurrentTime(playerRef.current.getCurrentTime()); } }, 500);
        watermarkIntervalRef.current = setInterval(() => {
            const newTop = Math.floor(Math.random() * 70) + 10;
            const newLeft = Math.floor(Math.random() * 70) + 10;
            setWatermarkPos({ top: `${newTop}%`, left: `${newLeft}%` });
        }, 5000);
        return () => { clearInterval(progressInterval); clearInterval(watermarkIntervalRef.current); };
    }, [videoId, isSeeking]);

    // --- **جديد: دالة لترجمة أسماء الجودات** ---
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

    // ... (باقي الدوال لم تتغير)
    const handlePlayPause = () => { if (!playerRef.current) return; const playerState = playerRef.current.getPlayerState(); if (playerState === 1) { playerRef.current.pauseVideo(); } else { playerRef.current.playVideo(); } };
    const handleSeek = (direction) => { if (!playerRef.current) return; const currentTimeVal = playerRef.current.getCurrentTime(); const newTime = direction === 'forward' ? currentTimeVal + 10 : currentTimeVal - 10; playerRef.current.seekTo(newTime, true); setShowSeekIcon({ direction: direction, visible: true }); if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current); seekTimeoutRef.current = setTimeout(() => { setShowSeekIcon({ direction: null, visible: false }); }, 600); };
    const onPlayerReady = useCallback((event) => { playerRef.current = event.target; setDuration(event.target.getDuration()); const rates = playerRef.current.getAvailablePlaybackRates(); if (rates && rates.length > 0) { setAvailablePlaybackRates(rates); setPlaybackRate(playerRef.current.getPlaybackRate()); } }, []);
    const handleOnPlay = () => { setIsPlaying(true); if (playerRef.current && !qualitiesFetched) { const qualities = playerRef.current.getAvailableQualityLevels(); if (qualities && qualities.length > 0) { setAvailableQualityLevels(['auto', ...qualities]); setVideoQuality(playerRef.current.getPlaybackQuality()); setQualitiesFetched(true); } } };
    const calculateSeekTime = (e) => { if (!progressBarRef.current || duration === 0) return null; const bar = progressBarRef.current; const rect = bar.getBoundingClientRect(); const clientX = e.touches ? e.touches[0].clientX : e.clientX; const boundedX = Math.max(0, Math.min(rect.width, clientX - rect.left)); const seekRatio = boundedX / rect.width; return seekRatio * duration; };
    const handleScrubStart = (e) => { e.preventDefault(); setIsSeeking(true); const seekTime = calculateSeekTime(e); if (seekTime !== null) { setCurrentTime(seekTime); playerRef.current.seekTo(seekTime, true); } window.addEventListener('mousemove', handleScrubbing); window.addEventListener('touchmove', handleScrubbing); window.addEventListener('mouseup', handleScrubEnd); window.addEventListener('touchend', handleScrubEnd); };
    const handleScrubbing = (e) => { const seekTime = calculateSeekTime(e); if (seekTime !== null) { setCurrentTime(seekTime); playerRef.current.seekTo(seekTime, true); } };
    const handleScrubEnd = () => { setIsSeeking(false); window.removeEventListener('mousemove', handleScrubbing); window.removeEventListener('touchmove', handleScrubbing); window.removeEventListener('mouseup', handleScrubEnd); window.removeEventListener('touchend', handleScrubEnd); };
    const handleSetPlaybackRate = (e) => { const newRate = parseFloat(e.target.value); if (playerRef.current && !isNaN(newRate)) { playerRef.current.setPlaybackRate(newRate); setPlaybackRate(newRate); } };
    // ✅ دالة تغيير الجودة بشكل فعلي
const handleSetQuality = (e) => {
  const newQuality = e.target.value;
  const oldQuality = videoQuality; // حفظ الجودة القديمة مؤقتًا
  if (!playerRef.current) return;

  const currentTime = playerRef.current.getCurrentTime?.() || 0;
  const wasPlaying = playerRef.current.getPlayerState?.() === 1;

  // نحاول نطلب الجودة الجديدة
  playerRef.current.loadVideoById({
    videoId: youtubeId,
    startSeconds: currentTime,
    suggestedQuality: newQuality,
  });

  // لو الفيديو كان متوقف، نوقفه بعد التحميل
  if (!wasPlaying) setTimeout(() => playerRef.current.pauseVideo?.(), 600);

  // ننتظر شوية ونتحقق فعلاً هل الجودة اتغيرت
  setTimeout(() => {
    const actualQuality = playerRef.current.getPlaybackQuality?.();
    if (actualQuality === newQuality) {
      // ✅ الجودة اتغيرت فعلاً → نثبت التغيير
      setVideoQuality(newQuality);
      console.log(`✅ تم تغيير الجودة إلى ${newQuality}`);
    } else {
      // ❌ الجودة ما اتغيرتش → نرجع للقيمة القديمة
      setVideoQuality(oldQuality);
      console.log(`❌ لم تتغير الجودة (ما زالت ${actualQuality})`);
    }
  }, 1000); // الانتظار ثانية واحدة قبل التحقق
};
    const formatTime = (timeInSeconds) => { if (isNaN(timeInSeconds) || timeInSeconds <= 0) return '0:00'; const minutes = Math.floor(timeInSeconds / 60); const seconds = Math.floor(timeInSeconds % 60).toString().padStart(2, '0'); return `${minutes}:${seconds}`; };

    if (error) { return <div className="message-container"><Head><title>خطأ</title></Head><h1>{error}</h1></div>; }
    if (!youtubeId || !user) { return <div className="message-container"><Head><title>جاري التحميل</title></Head><h1>جاري تحميل الفيديو...</h1></div>; }
    const opts = { playerVars: { autoplay: 0, controls: 0, rel: 0, showinfo: 0, modestbranding: 1, disablekb: 1, }, };

    return (
        <div className="page-container">
            <Head>
                <title>مشاهدة الدرس</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
            </Head>

            <div className="player-wrapper">
                <YouTube
                    videoId={youtubeId}
                    opts={opts}
                    className="youtube-player"
                    iframeClassName="youtube-iframe"
                    onReady={onPlayerReady}
                    onPlay={handleOnPlay}
                    onPause={() => setIsPlaying(false)}
                    onEnd={() => setIsPlaying(false)}
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
                                        // **--- التعديل هنا ---**
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

            <style jsx global>{`
                /* ... (كل أنماط CSS لم تتغير) ... */
                body { margin: 0; overscroll-behavior: contain; }
                .page-container { display: flex; align-items: center; justify-content: center; min-height: 100vh; width: 100%; padding: 10px; box-sizing: border-box; }
                .message-container { display: flex; align-items: center; justify-content: center; height: 100vh; color: white; padding: 20px; text-align: center; }
                .player-wrapper { position: relative; width: 100%; max-width: 900px; aspect-ratio: 16 / 7; background: linear-gradient(to bottom, #111827, #000000); }
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
                .time-display { color: white; font-size: clamp(11px, 2.5vw, 14px); margin: 0 10px; min-width: 40px; text-align: center; }
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
            `}</style>
        </div>
    );
}
