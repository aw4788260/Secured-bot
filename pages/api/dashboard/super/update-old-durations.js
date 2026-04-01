import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

// دالة مساعدة لتحويل وقت يوتيوب المعقد إلى وقت عادي
const parseDuration = (isoDuration) => {
    if (!isoDuration) return '00:00';
    const match = isoDuration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return '00:00';

    const hours = match[1] ? parseInt(match[1], 10) : 0;
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    const seconds = match[3] ? parseInt(match[3], 10) : 0;

    let formatted = '';
    if (hours > 0) formatted += `${hours}:`;
    formatted += `${hours > 0 ? minutes.toString().padStart(2, '0') : minutes}:`;
    formatted += seconds.toString().padStart(2, '0');

    return formatted;
};

export default async function handler(req, res) {
    // 1. حماية المسار (فقط الأدمن أو المعلم صاحب الصلاحية يمكنه التشغيل)
    const { user, error: authError } = await requireTeacherOrAdmin(req, res);
    if (authError) return res.status(401).json({ error: 'غير مصرح لك بتشغيل هذا السكربت' });

    try {
        const apiKey = process.env.YOUTUBE_API_KEY;
        if (!apiKey) return res.status(400).json({ error: 'مفتاح YOUTUBE_API_KEY غير موجود في ملف .env' });

        // 2. جلب الفيديوهات التي لا تحتوي على مدة صحيحة (أو مدتها 00:00 أو Null)
        const { data: videos, error: dbError } = await supabase
            .from('videos')
            .select('id, youtube_video_id')
            .or('duration.is.null,duration.eq.00:00,duration.eq.');

        if (dbError) throw dbError;

        if (!videos || videos.length === 0) {
            return res.status(200).json({ message: '🎉 جميع الفيديوهات محدثة بالفعل! لا يوجد شيء لتحديثه.' });
        }

        let updatedCount = 0;
        let failedCount = 0;

        // 3. تقسيم الفيديوهات إلى مجموعات (50 فيديو في كل طلب) لأن يوتيوب يقبل 50 ID كحد أقصى في الطلب الواحد
        const chunkSize = 50;
        for (let i = 0; i < videos.length; i += chunkSize) {
            const chunk = videos.slice(i, i + chunkSize);
            
            // استخراج أرقام الفيديوهات وربطها بفاصلة
            const validVideos = chunk.filter(v => v.youtube_video_id);
            if(validVideos.length === 0) continue;

            const idsString = validVideos.map(v => v.youtube_video_id).join(',');

            // 4. الاتصال بـ YouTube API وجلب بيانات الـ 50 فيديو معاً
            const url = `https://www.googleapis.com/youtube/v3/videos?id=${idsString}&part=contentDetails&key=${apiKey}`;
            const ytRes = await fetch(url);
            const ytData = await ytRes.json();

            if (ytData.items && ytData.items.length > 0) {
                // 5. تحديث كل فيديو في قاعدة البيانات بناءً على الرد
                for (const ytItem of ytData.items) {
                    const formattedDuration = parseDuration(ytItem.contentDetails?.duration);
                    
                    // البحث عن الـ ID الخاص بنا في قاعدة البيانات الذي يطابق الـ youtube_video_id
                    const dbVideo = validVideos.find(v => v.youtube_video_id === ytItem.id);
                    
                    if (dbVideo) {
                        const { error: updateError } = await supabase
                            .from('videos')
                            .update({ duration: formattedDuration })
                            .eq('id', dbVideo.id);

                        if (!updateError) {
                            updatedCount++;
                        } else {
                            failedCount++;
                        }
                    }
                }
            }
        }

        return res.status(200).json({
            success: true,
            message: '✅ انتهت عملية التحديث!',
            stats: {
                total_found: videos.length,
                successfully_updated: updatedCount,
                failed_or_not_found_on_youtube: videos.length - updatedCount
            }
        });

    } catch (err) {
        console.error("Migration Error:", err);
        return res.status(500).json({ error: 'حدث خطأ غير متوقع أثناء التحديث.', details: err.message });
    }
}
