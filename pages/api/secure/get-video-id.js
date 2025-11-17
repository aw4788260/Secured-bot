// pages/api/secure/get-video-id.js
import { supabase } from '../../../lib/supabaseClient';
import YtDlpWrap from 'yt-dlp-wrap'; 
import fs from 'fs'; 
import path from 'path'; 

export default async (req, res) => {
  const { lessonId } = req.query;
  if (!lessonId) {
    return res.status(400).json({ message: 'Missing lessonId' });
  }
  
  let youtubeId; 

  try {
    // 1. التحقق الأمني من Supabase (كما كان)
    const { data, error } = await supabase
      .from('videos')
      .select('youtube_video_id')
      .eq('id', lessonId)
      .single();

    if (error || !data || !data.youtube_video_id) {
      throw new Error('Video not found or permission denied');
    }

    youtubeId = data.youtube_video_id;

    // --- [ ✅✅✅ بداية: تطبيق منطق yt-dlp بالكوكيز ] ---
    
    // 2. جلب الكوكيز من متغيرات البيئة الآمنة
    const cookiesContent = process.env.YOUTUBE_COOKIES;
    if (!cookiesContent) {
        console.error("[CRITICAL] YOUTUBE_COOKIES environment variable is not set on Vercel!");
        throw new Error("Server configuration error: Missing cookies.");
    }

    // 3. كتابة الكوكيز في ملف مؤقت
    const cookieFile = path.join('/tmp', 'cookies.txt');
    fs.writeFileSync(cookieFile, cookiesContent);
    console.log(`[yt-dlp] Cookies written to ${cookieFile}`);

    // [ ✅✅✅ بداية الإصلاح: تحديد مسار قابل للكتابة (tmp) ]
    // 4. تحديد المسار القابل للكتابة لملف yt-dlp الثنائي
    const ytDlpBinaryPath = path.join('/tmp', 'yt-dlp');

    // 5. تهيئة المكتبة (وإخبارها بمكان الملف الثنائي)
    const ytDlpWrap = new YtDlpWrap(ytDlpBinaryPath);
    
    // 6. تحميل الملف الثنائي "إلى" المسار القابل للكتابة
    // (سيقوم بالتحميل فقط إذا لم يكن موجوداً)
    if (!fs.existsSync(ytDlpBinaryPath)) {
        console.log(`[yt-dlp] Binary not found at ${ytDlpBinaryPath}. Downloading...`);
        await YtDlpWrap.downloadFromGithub(ytDlpBinaryPath);
        console.log(`[yt-dlp] Binary downloaded successfully.`);
    } else {
        console.log(`[yt-dlp] Binary already exists at ${ytDlpBinaryPath}. Skipping download.`);
    }
    // [ ✅✅✅ نهاية الإصلاح ]
    
    const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;

    // 7. تنفيذ الأمر
    const infoJsonString = await ytDlpWrap.execPromise([
        videoUrl,
        '--cookie', cookieFile, // (استخدام ملف الكوكيز)
        '-j', // (طلب المعلومات كـ JSON)
        '--skip-download' // (عدم التحميل)
    ]);
    
    const info = JSON.parse(infoJsonString); // تحويل النص إلى JSON

    // [ ✅✅✅ اللوج الذي طلبته ]
    console.log(`[TEST SUCCESS] Video: ${info.title}`);
    
    // (اختياري: طباعة بعض الروابط للتأكد)
    const testFormat = info.formats.find(f => f.format_id === '18' || f.format_id === '22');
    if (testFormat) {
       console.log(`[TEST SUCCESS] Sample URL (Format ${testFormat.format_id}): ${testFormat.url.substring(0, 100)}...`);
    }

    // --- [ ✅✅✅ نهاية: تطبيق منطق yt-dlp ] ---

    // 9. إرجاع الـ ID للمشغل كالمعتاد
    res.status(200).json({ 
        youtube_video_id: youtubeId 
    });

  } catch (err) {
    console.error(`[yt-dlp FAILED] Error for ${youtubeId}:`, err.message);
    if (err.stderr) {
        console.error(`[yt-dlp STDERR]: ${err.stderr}`);
    }
    res.status(500).json({ message: err.message || 'yt-dlp execution failed' });
  }
};
