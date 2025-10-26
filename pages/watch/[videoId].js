// pages/watch/[videoId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useCallback } from 'react';
import Head from 'next/head';
import YouTube from 'react-youtube';

// --- Helper ---
const formatTime = (s) => {
  if (!s || s <= 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
};

// --- Watermark ---
const Watermark = ({ user }) => {
  const [pos, setPos] = useState({ top: '10%', left: '10%' });

  useEffect(() => {
    const move = setInterval(() => {
      setPos({
        top: `${Math.floor(Math.random() * 70) + 10}%`,
        left: `${Math.floor(Math.random() * 70) + 10}%`
      });
    }, 5000);
    return () => clearInterval(move);
  }, []);

  if (!user) return null;

  return (
    <div style={{ ...styles.watermark, top: pos.top, left: pos.left }}>
      {user.first_name} ({user.id})
    </div>
  );
};

// --- Controls ---
const CustomControls = ({ playerRef, isPlaying, onPlayPause, currentTime, duration }) => {
  return (
    <div style={styles.controls}>
      <div style={styles.playPauseArea} onClick={onPlayPause}>
        {!isPlaying && <div style={styles.playIcon}>▶</div>}
      </div>
      <div style={styles.progressContainer}>
        <span style={styles.time}>{formatTime(currentTime)}</span>
        <div
          style={styles.progressBar}
          onClick={(e) => {
            if (!playerRef.current || !duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            playerRef.current.seekTo(ratio * duration, true);
          }}
        >
          <div style={{ ...styles.progressFill, width: `${(currentTime / duration) * 100}%` }} />
        </div>
        <span style={styles.time}>{formatTime(duration)}</span>
      </div>
    </div>
  );
};

// --- Main Page ---
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
    if (typeof window !== 'undefined') {
      document.addEventListener('contextmenu', (e) => e.preventDefault());
      document.onselectstart = () => false;
      document.ondragstart = () => false;
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      const tgUser = window.Telegram.WebApp.initDataUnsafe?.user;
      if (!tgUser) {
        setError('لا يمكن تحديد المستخدم.');
        return;
      }
      setUser(tgUser);

      if (videoId) {
        fetch(`/api/secure/get-video-id?lessonId=${videoId}`)
          .then((res) => {
            if (!res.ok) throw new Error('لا تملك صلاحية مشاهدة الفيديو');
            return res.json();
          })
          .then((d) => {
            setYoutubeId(d.youtube_video_id);
            setIsLoading(false);
          })
          .catch((e) => setError(e.message));
      }
    } else {
      setError('افتح من داخل تليجرام.');
    }
  }, [videoId]);

  useEffect(() => {
    const t = setInterval(() => {
      if (playerRef.current?.getCurrentTime) {
        setCurrentTime(playerRef.current.getCurrentTime());
      }
    }, 500);
    return () => clearInterval(t);
  }, []);

  const onPlayerReady = (e) => {
    playerRef.current = e.target;
    setDuration(e.target.getDuration());
  };

  const handlePlayPause = () => {
    if (!playerRef.current) return;
    const s = playerRef.current.getPlayerState();
    s === 1 ? playerRef.current.pauseVideo() : playerRef.current.playVideo();
  };

  if (error)
    return (
      <div style={styles.msg}>
        <h1>{error}</h1>
      </div>
    );

  if (isLoading)
    return (
      <div style={styles.msg}>
        <h1>جاري تحميل الفيديو...</h1>
      </div>
    );

  const opts = {
    playerVars: { autoplay: 0, controls: 0, rel: 0, modestbranding: 1, disablekb: 1 }
  };

  return (
    <div style={styles.page}>
      <Head>
        <title>مشاهدة الدرس</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={styles.videoWrapper}>
        <div style={styles.videoBox}>
          <YouTube
            videoId={youtubeId}
            opts={opts}
            onReady={onPlayerReady}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnd={() => setIsPlaying(false)}
            style={styles.player}
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

      <style jsx global>{`
        * {
          box-sizing: border-box;
          user-select: none;
        }
      `}</style>
    </div>
  );
}

// --- Styles ---
const styles = {
  page: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: '#000',
    minHeight: '100vh',
    padding: '10px'
  },
  videoWrapper: {
    width: '100%',
    maxWidth: '900px'
  },
  videoBox: {
    position: 'relative',
    width: '100%',
    aspectRatio: '16 / 9',
    background: '#000',
    overflow: 'hidden',
    borderRadius: '10px'
  },
  player: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%'
  },
  msg: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    color: 'white',
    height: '100vh',
    textAlign: 'center'
  },
  watermark: {
    position: 'absolute',
    background: 'rgba(0, 0, 0, 0.6)',
    color: '#fff',
    padding: '3px 7px',
    fontSize: '12px',
    borderRadius: '4px',
    zIndex: 10,
    transition: 'top 2s ease, left 2s ease',
    pointerEvents: 'none'
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    zIndex: 9
  },
  playPauseArea: {
    height: '60%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer'
  },
  playIcon: {
    fontSize: '60px',
    color: 'white'
  },
  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '5px 10px'
  },
  progressBar: {
    flexGrow: 1,
    height: '4px',
    background: 'rgba(255,255,255,0.3)',
    margin: '0 10px',
    borderRadius: '2px',
    cursor: 'pointer'
  },
  progressFill: {
    height: '100%',
    background: '#FF0000',
    borderRadius: '2px'
  },
  time: {
    color: '#fff',
    fontSize: '12px',
    width: '40px',
    textAlign: 'center'
  }
};
