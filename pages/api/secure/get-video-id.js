// pages/api/secure/get-video-id.js

import { supabase } from '../../../lib/supabaseClient';
// [ ✅✅✅ تعديل: استيراد "ytdl-core" بدلاً من "play-dl" ]
import ytdl from '@distube/ytdl-core';

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
    const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;

    // --- [ ✅✅✅ بداية: الإصلاح النهائي (من كود Colab) ] ---
    
    // 2. جلب الكوكيز من متغيرات البيئة الآمنة
    // (نفترض أنه "string" واحد طويل)
    const cookieString = process.env.YOUTUBE_COOKIES;
    if (!cookieString) {
        console.error("[CRITICAL] YOUTUBE_COOKIES environment variable is not set on Vercel!");
        throw new Error("Server configuration error: Missing cookies.");
    }
    console.log(`[ytdl-core] Cookies loaded. Attempting info for: ${youtubeId}`);

    // 3. [ ✅✅✅ الأهم ]
    // (تحويل الكوكيز من "string" إلى "Array<string>" كما يتطلبه ytdl-core)
    const cookiesArray = cookieString.split(';').map(cookie => cookie.trim()).filter(Boolean);
    
    // (إنشاء العميل مع الكوكيز - تماماً مثل كود Colab)
    const agent = ytdl.createAgent(cookiesArray);

    // (استدعاء "getInfo" باستخدام العميل)
    const info = await ytdl.getInfo(videoUrl, { agent });

    // (اختيار أي Format فقط للتأكد من نجاح العملية)
    const streamFormat = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
    if (!streamFormat || !streamFormat.url) {
        throw new Error("ytdl-core could not find a valid stream format.");
    }
    
    // [ ✅✅✅ اللوج الذي طلبته ]
    console.log(`[TEST SUCCESS] Video: ${info.videoDetails.title}`);
    console.log(`[TEST SUCCESS] Stream URL Found: ${streamFormat.url.substring(0, 100)}...`);

    // --- [ ✅✅✅ نهاية: الإصلاح النهائي ] ---

    // 4. إرجاع الـ ID للمشغل كالمعتاد
    // (الكود يعمل "كـجهاز تحقق" فقط، وهو ينجح إذا لم يرمِ خطأ)
    res.status(200).json({ 
        youtube_video_id: youtubeId 
    });

  } catch (err) {
    console.error(`[ytdl-core FAILED] Error for ${youtubeId}:`, err.message);
    res.status(500).json({ message: err.message || 'ytdl-core execution failed' });
  }
};
