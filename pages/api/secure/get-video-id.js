import { supabase } from '../../../lib/supabaseClient';
import axios from 'axios';

// [ ✅✅ الرابط الجديد بتاع Railway اللي إنت بعتهولي ]
const PYTHON_PROXY_URL = 'https://web-production-3a04a.up.railway.app/api/get-video-info';

export default async (req, res) => {
  
  // الكود ده بيخدم الويب (المشاهدة) بس
  if (req.query.lessonId) {
    const { lessonId } = req.query;
    let youtubeId; 
    
    try {
      // 1. التحقق من Supabase (زي ما كان)
      const { data, error } = await supabase
        .from('videos')
        .select('youtube_video_id')
        .eq('id', lessonId)
        .single();

      if (error || !data || !data.youtube_video_id) {
        throw new Error('Video not found or permission denied');
      }
      youtubeId = data.youtube_video_id;

      // 2. [ ✅ الحل ] Vercel بيكلم Railway (عشان ياخد الـ IP النضيف)
      // دي هي الخطوة اللي بتخلي "صفحة المشاهدة" تتأكد من "الاستريم الجديد"
      console.log(`[Vercel App] Forwarding check for ${youtubeId} to Railway proxy...`);
      
      // Vercel بيكلم Railway عشان يتأكد إن الفيديو شغال
      // لو الخطوة دي فشلت (بسبب إن الفيديو اتمسح)، هيرمي Error
      await axios.get(PYTHON_PROXY_URL, { params: { youtubeId } });
      
      // 3. لو Railway نجح (مرجعش خطأ)، ابعت للويب
      console.log(`[Vercel App] Railway proxy check SUCCESS for ${youtubeId}`);
      // صفحة المشاهدة (watch/[videoId].js) بتستقبل الـ ID ده وبتشغل الفيديو
      res.status(200).json({ 
          youtube_video_id: youtubeId 
      });

    } catch (err) {
      // لو Railway رجع خطأ، Vercel هيرجع الخطأ ده لصفحة المشاهدة
      // وصفحة المشاهدة هتترجمه لـ "لا تملك صلاحية مشاهدة الفيديو"
      console.error(`[Vercel App] Check FAILED:`, err.response ? err.response.data.message : err.message);
      res.status(500).json({ message: "Video check failed (Proxy Error)" });
    }
  } else {
    res.status(400).json({ message: 'Missing lessonId' });
  }
};
