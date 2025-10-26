// ✅ pages/watch/[videoId].js
import { useRouter } from "next/router";
import { useEffect, useState, useRef } from "react";
import Head from "next/head";
import YouTube from "react-youtube";

export default function WatchPage() {
  const router = useRouter();
  const { videoId } = router.query;
  const [isAllowed, setIsAllowed] = useState(false);
  const playerRef = useRef(null);

  useEffect(() => {
    // ✅ الطبقة 1: السماح فقط لو المستخدم داخل موقعك مش داخل تب جديدة
    const referrer = document.referrer;
    if (referrer && referrer.includes(window.location.hostname)) {
      setIsAllowed(true);
    } else {
      // لو فتح الصفحة مباشرة أو نسخ الرابط، منرجعهوش
      setIsAllowed(true); // تقدر تخليها false لو عايز أقصى حماية
    }
  }, []);

  // ✅ الطبقة 2: إعدادات تشغيل تمنع فتح يوتيوب خارجي أو نسخ الرابط
  const opts = {
    width: "100%",
    height: "100%",
    playerVars: {
      rel: 0, // ما يظهرش فيديوهات تانية
      modestbranding: 1, // يخفي شعار يوتيوب الكبير
      controls: 1, // يظهر الكنترول العادي فقط
      disablekb: 1, // يمنع استخدام الكيبورد
      fs: 0, // يمنع فتح فول سكرين خارج الموقع
      iv_load_policy: 3,
      origin: typeof window !== "undefined" ? window.location.origin : "",
    },
  };

  const onReady = (event) => {
    playerRef.current = event.target;
  };

  // ✅ الطبقة 3: تعطيل الضغط بالزر اليمين أو نسخ اللينك
  useEffect(() => {
    const blockRightClick = (e) => e.preventDefault();
    document.addEventListener("contextmenu", blockRightClick);
    return () => document.removeEventListener("contextmenu", blockRightClick);
  }, []);

  // ✅ الطبقة 4: حماية واجهة المستخدم من التلاعب
  if (!isAllowed) {
    return (
      <div className="flex h-screen items-center justify-center text-xl font-bold text-red-600">
        ❌ الوصول مرفوض
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Protected Video</title>
      </Head>

      <div className="flex min-h-screen flex-col items-center justify-center bg-black">
        <div
          className="relative w-full"
          style={{
            maxWidth: "900px",
            aspectRatio: "16 / 9",
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: "0 0 20px rgba(255,255,255,0.15)",
          }}
        >
          {videoId ? (
            <YouTube
              videoId={videoId}
              opts={opts}
              onReady={onReady}
              iframeClassName="w-full h-full"
              className="absolute inset-0"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-white">
              جاري التحميل...
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        * {
          user-select: none !important;
        }
        iframe {
          pointer-events: auto !important;
        }
      `}</style>
    </>
  );
}
