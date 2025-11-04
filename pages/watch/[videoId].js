// pages/watch/[videoId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useCallback } from 'react';
import Head from 'next/head';
import YouTube from 'react-youtube';

export default function WatchPage() {
    const router = useRouter();
    const { videoId } = router.query;

    // === الحالات ===
    const [youtubeId, setYoutubeId] = useState(null);
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [showSeekIcon, setShowSeekIcon] = useState({ direction: null, visible: false });
    const [watermarkPos, setWatermarkPos] = useState({ top: '15%', left: '15%' });
    const [isSeeking, setIsSeeking] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [availablePlaybackRates, setAvailablePlaybackRates] = useState([]);
    const [videoQuality, setVideoQuality] = useState('auto');
    const [availableQualityLevels, setAvailableQualityLevels] = useState([]);
    const [qualitiesFetched, setQualitiesFetched] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // === Refs ===
    const playerRef = useRef(null);
    const iframeRef = useRef(null);
    const seekTimeoutRef = useRef(null);
    const watermarkIntervalRef = useRef(null);
    const progressBarRef = useRef(null);
    const playerWrapperRef = useRef(null);
    const qualityForceInterval = useRef(null);

    // ==================================================================
    // 1. تحميل الفيديو + التحقق من المستخدم
    // ==================================================================
    useEffect(() => {
        const setupUserAndLoadVideo = (foundUser) => {
            if (foundUser && foundUser.id) setUser(foundUser);
            else { setError("خطأ: لا يمكن التعرف على المستخدم."); return; }

            if (videoId) {
                fetch(`/api/secure/get-video-id?lessonId=${videoId}`)
                    .then(r => { if (!r.ok) throw new Error('لا تملك صلاحية'); return r.json(); })
                    .then(d => setYoutubeId(d.youtube_video_id))
                    .catch(e => setError(e.message));
            }
        };

        const urlParams = new URLSearchParams(window.location.search);
        const urlUserId = urlParams.get('userId');
        const urlFirstName = urlParams.get('firstName');

        if (urlUserId && urlUserId.trim() !== '') {
            setupUserAndLoadVideo({ id: urlUserId, first_name: urlFirstName ? decodeURIComponent(urlFirstName) : "User" });
        } else if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
            window.Telegram.WebApp.ready();
            const miniAppUser = window.Telegram.WebApp.initDataUnsafe?.user;
            if (!miniAppUser?.id) { setError("لا يمكن التعرف على هويتك من تليجرام."); return; }
            const platform = window.Telegram.WebApp.platform;
            if (platform === 'ios') {
                setupUserAndLoadVideo(miniAppUser);
            } else {
                fetch(`/api/auth/check-admin?userId=${miniAppUser.id}`)
                    .then(r => r.json())
                    .then(d => d.isAdmin ? setupUserAndLoadVideo(miniAppUser) : setError('الفتح من تليجرام متاح للآيفون فقط.'))
                    .catch(() => setError('خطأ في التحقق من صلاحيات الأدمن.'));
            }
        } else {
            setError('الرجاء الفتح من البرنامج أو تليجرام.');
        }

        const progressInterval = setInterval(() => {
            if (playerRef.current && !isSeeking) setCurrentTime(playerRef.current.getCurrentTime());
        }, 500);

        watermarkIntervalRef.current = setInterval(() => {
            setWatermarkPos({ top: `${Math.floor(Math.random() * 70) + 10}%`, left: `${Math.floor(Math.random() * 70) + 10}%` });
        }, 5000);

        const fsChange = () => setIsFullscreen(!!document.fullscreenElement);
        ['fullscreenchange', 'mozfullscreenchange', 'webkitfullscreenchange', 'msfullscreenchange'].forEach(ev => document.addEventListener(ev, fsChange));

        return () => {
            clearInterval(progressInterval);
            clearInterval(watermarkIntervalRef.current);
            clearInterval(qualityForceInterval.current);
            ['fullscreenchange', 'mozfullscreenchange', 'webkitfullscreenchange', 'msfullscreenchange'].forEach(ev => document.removeEventListener(ev, fsChange));
        };
    }, [videoId, isSeeking]);

    // ==================================================================
    // 2. إجبار الجودة
    // ==================================================================
    const forceQuality = useCallback((quality) => {
        if (!playerRef.current || quality === 'auto') return;

        if (qualityForceInterval.current) clearInterval(qualityForceInterval.current);

        let attempts = 0;
        const maxAttempts = 25;

        qualityForceInterval.current = setInterval(() => {
            const player = playerRef.current;
            if (!player) return;

            const current = player.getPlaybackQuality();
            if (current === quality || attempts >= maxAttempts) {
                clearInterval(qualityForceInterval.current);
                return;
            }

            try { player.setPlaybackQuality(quality); } catch(e) {}
            const time = player.getCurrentTime();
            player.cueVideoById({ videoId: youtubeId, startSeconds: time, suggestedQuality: quality });
            setTimeout(() => player.playVideo(), 150);

            attempts++;
        }, 350);
    }, [youtubeId]);

    // ==================================================================
    // 3. تغيير الجودة
    // ==================================================================
    const handleSetQuality = (e) => {
        const newQuality = e.target.value;
        setVideoQuality(newQuality);

        if (newQuality === 'auto') {
            if (playerRef.current) playerRef.current.setPlaybackQuality('default');
            if (qualityForceInterval.current) clearInterval(qualityForceInterval.current);
            return;
        }

        forceQuality(newQuality);
    };

    // ==================================================================
    // 4. جاهزية المشغل
    // ==================================================================
    const onPlayerReady = useCallback((event) => {
        playerRef.current = event.target;
        const iframe = event.target.getIframe();
        if (iframe) iframeRef.current = iframe;

        setDuration(event.target.getDuration());

        // جلب الجودات أول مرة
        const quals = event.target.getAvailableQualityLevels();
        if (quals?.length && !qualitiesFetched) {
            setAvailableQualityLevels(['auto', ...quals]);
            setQualitiesFetched(true);
        }

        const rates = event.target.getAvailablePlaybackRates();
        if (rates?.length) {
            setAvailablePlaybackRates(rates);
            setPlaybackRate(event.target.getPlaybackRate());
        }

        // تطبيق الجودة المطلوبة
        if (videoQuality !== 'auto') {
            setTimeout(() => forceQuality(videoQuality), 500);
        }
    }, [youtubeId, qualitiesFetched, videoQuality, forceQuality]);

    // ==================================================================
    // 5. حدث تغيير الجودة الفعلية (يُعيد جلب القوائم)
    // ==================================================================
    const handleActualQualityChange = useCallback((event) => {
        const actual = event.data;
        console.log("الجودة الفعلية الآن:", actual);

        // إعادة جلب الجودات في كل مرة
        if (playerRef.current) {
            const quals = playerRef.current.getAvailableQualityLevels();
            if (quals?.length && !availableQualityLevels.includes('auto')) {
                setAvailableQualityLevels(['auto', ...quals]);
            }
        }
    }, [availableQualityLevels]);

    // ==================================================================
    // 6. باقي الدوال
    // ==================================================================
    const formatQualityLabel = (q) => ({ hd1080:'1080p', hd720:'720p', large:'480p', medium:'360p', small:'240p', tiny:'144p', auto:'تلقائي' }[q] || q);
    const handlePlayPause = () => { const s = playerRef.current?.getPlayerState(); s === 1 ? playerRef.current?.pauseVideo() : playerRef.current?.playVideo(); };
    const handleSeek = (dir) => {
        const t = playerRef.current?.getCurrentTime() + (dir === 'forward' ? 10 : -10);
        playerRef.current?.seekTo(t, true);
        setShowSeekIcon({ direction: dir, visible: true });
        clearTimeout(seekTimeoutRef.current);
        seekTimeoutRef.current = setTimeout(() => setShowSeekIcon({ direction: null, visible: false }), 600);
    };
    const formatTime = (t) => isNaN(t) || t <= 0 ? '0:00' : `${Math.floor(t/60)}:${Math.floor(t%60).toString().padStart(2,'0')}`;
    const handleOnPlay = () => setIsPlaying(true);
    const handleSetPlaybackRate = (e) => { const r = parseFloat(e.target.value); playerRef.current?.setPlaybackRate(r); setPlaybackRate(r); };
    const handleFullscreen = () => {
        const el = playerWrapperRef.current;
        const req = el?.requestFullscreen || el?.mozRequestFullScreen || el?.webkitRequestFullscreen || el?.msRequestFullscreen;
        const exit = document.exitFullscreen || document.mozCancelFullScreen || document.webkitExitFullscreen || document.msExitFullscreen;
        document.fullscreenElement ? exit.call(document) : req?.call(el);
    };

    // ==================================================================
    // 7. Scrub
    // ==================================================================
    const calculateSeekTime = (e) => {
        if (!progressBarRef.current || !duration) return null;
        const rect = progressBarRef.current.getBoundingClientRect();
        const x = e.touches ? e.touches[0].clientX : e.clientX;
        const pos = Math.max(0, Math.min(rect.width, x - rect.left));
        return (pos / rect.width) * duration;
    };
    const handleScrubStart = (e) => { e.preventDefault(); setIsSeeking(true); const t = calculateSeekTime(e); if (t !== null) { setCurrentTime(t); playerRef.current?.seekTo(t, true); } window.addEventListener('mousemove', handleScrubbing); window.addEventListener('touchmove', handleScrubbing); window.addEventListener('mouseup', handleScrubEnd); window.addEventListener('touchend', handleScrubEnd); };
    const handleScrubbing = (e) => { const t = calculateSeekTime(e); if (t !== null) { setCurrentTime(t); playerRef.current?.seekTo(t, true); } };
    const handleScrubEnd = () => { setIsSeeking(false); window.removeEventListener('mousemove', handleScrubbing); window.removeEventListener('touchmove', handleScrubbing); window.removeEventListener('mouseup', handleScrubEnd); window.removeEventListener('touchend', handleScrubEnd); };

    // ==================================================================
    // 8. Render
    // ==================================================================
    if (error) return <div className="message-container"><Head><title>خطأ</title></Head><h1>{error}</h1></div>;
    if (!youtubeId || !user) return <div className="message-container"><Head><title>جاري التحميل</title></Head><h1>جاري تحميل الفيديو...</h1></div>;

    const opts = { playerVars: { autoplay: 0, controls: 0, rel: 0, showinfo: 0, modestbranding: 1, disablekb: 1 } };

    return (
        <div className="page-container">
            <Head><title>مشاهدة الدرس</title><meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no"/></Head>

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
                    onPlaybackQualityChange={handleActualQualityChange}  {/* أعد إضافته */}
                />

                <div className="controls-overlay">
                    <div className="interaction-grid">
                        <div className="seek-zone" onDoubleClick={() => handleSeek('backward')}></div>
                        <div className="play-pause-zone" onClick={handlePlayPause}>
                            {!isPlaying && <div className="play-icon">Play</div>}
                        </div>
                        <div className="seek-zone" onDoubleClick={() => handleSeek('forward')}></div>
                    </div>

                    <div className="bottom-controls">
                        <div className="extra-controls">
                            {availableQualityLevels.length > 0 && (
                                <select className="control-select" value={videoQuality} onChange={handleSetQuality}>
                                    {availableQualityLevels.map(q => <option key={q} value={q}>{formatQualityLabel(q)}</option>)}
                                </select>
                            )}
                            {availablePlaybackRates.length > 0 && (
                                <select className="control-select" value={playbackRate} onChange={handleSetPlaybackRate}>
                                    {availablePlaybackRates.map(r => <option key={r} value={r}>{r}x</option>)}
                                </select>
                            )}
                        </div>
                        <span className="time-display">{formatTime(currentTime)}</span>
                        <div ref={progressBarRef} className="progress-bar-container" onMouseDown={handleScrubStart} onTouchStart={handleScrubStart}>
                            <div className="progress-bar-track"></div>
                            <div className="progress-bar-filled" style={{width:`${(currentTime/duration)*100}%`}}></div>
                            <div className="progress-bar-handle" style={{left:`${(currentTime/duration)*100}%`}}></div>
                        </div>
                        <span className="time-display">{formatTime(duration)}</span>
                        <button className="fullscreen-btn" onClick={handleFullscreen}>{isFullscreen?'Exit':'Fullscreen'}</button>
                    </div>

                    {showSeekIcon.visible && (
                        <div className={`seek-indicator ${showSeekIcon.direction}`}>
                            {showSeekIcon.direction === 'forward' ? 'Fast Forward 10' : 'Rewind 10'}
                        </div>
                    )}

                    <div className="watermark" style={{ top: watermarkPos.top, left: watermarkPos.left }}>
                        {user.first_name} ({user.id})
                    </div>
                </div>
            </div>

            <footer className="developer-info">
                <p>برمجة وتطوير: A7MeD WaLiD</p>
                <p>للتواصل: <a href="https://t.me/A7MeDWaLiD0" target="_blank" rel="noopener noreferrer">اضغط هنا</a></p>
            </footer>

            <style jsx global>{`
                /* نفس الـ CSS الأصلي */
                body { margin: 0; overscroll-behavior: contain; }
                .page-container { display: flex; flex-direction: column; align-items: center; min-height: 100vh; padding: 10px; }
                .message-container { display: flex; align-items: center; justify-content: center; height: 100vh; color: white; text-align: center; }
                .player-wrapper { position: relative; width: 100%; max-width: 900px; aspect-ratio: 16 / 7; background: #111; }
                .player-wrapper:fullscreen { width: 100%; height: 100%; max-width: none; aspect-ratio: auto; }
                .youtube-player, .youtube-iframe { width: 100%; height: 100%; }
                .controls-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 10; display: flex; flex-direction: column; justify-content: space-between; }
                .interaction-grid { flex-grow: 1; display: flex; }
                .seek-zone { flex: 1; height: 100%; }
                .play-pause-zone { flex: 2; display: flex; justify-content: center; align-items: center; cursor: pointer; }
                .play-icon { font-size: clamp(40px, 10vw, 80px); color: white; text-shadow: 0 0 15px rgba(0,0,0,0.8); }
                .bottom-controls { height: 40px; display: flex; align-items: center; padding: 0 10px; background: linear-gradient(to top, rgba(0,0,0,0.7), transparent); gap: 10px; }
                .extra-controls { display: flex; gap: 8px; }
                .control-select { background: rgba(255,255,255,0.2); color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: clamp(11px, 2.5vw, 14px); cursor: pointer; }
                .time-display { color: white; font-size: clamp(11px, 2.5vw, 14px); min-width: 40px; text-align: center; }
                .progress-bar-container { flex-grow: 1; height: 15px; position: relative; cursor: pointer; }
                .progress-bar-track { position: absolute; width: 100%; height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px; }
                .progress-bar-filled { position: absolute; height: 4px; background: #FF0000; border-radius: 2px; }
                .progress-bar-handle { position: absolute; width: 12px; height: 12px; background: #FF0000; border-radius: 50%; transform: translateX(-50%); }
                .progress-bar-container:hover .progress-bar-track,
                .progress-bar-container:hover .progress-bar-filled { height: 6px; }
                .progress-bar-container:hover .progress-bar-handle { transform: translateX(-50%) scale(1.2); }
                .seek-indicator { position: absolute; top: 50%; transform: translate(-50%, -50%); font-size: clamp(30px, 6vw, 40px); color: white; animation: seek-pop 0.6s ease-out; }
                .seek-indicator.forward { left: 75%; }
                .seek-indicator.backward { left: 25%; }
                @keyframes seek-pop { 0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; } 50% { transform: translate(-50%, -50%) scale(1.2); } 100% { opacity: 0; } }
                .watermark { position: absolute; padding: 4px 8px; background: rgba(0,0,0,0.7); color: white; font-size: clamp(10px, 2.5vw, 14px); border-radius: 4px; font-weight: bold; transition: top 2s, left 2s; z-index: 20; }
                .fullscreen-btn { background: none; border: none; color: white; font-size: clamp(18px, 3vw, 22px); cursor: pointer; }
            `}</style>
        </div>
    );
}
