import { supabase } from '../../../lib/supabaseClient';
import axios from 'axios';
import { checkUserAccess } from '../../../lib/authHelper';

// ✅ 1. استيراد مكتبات Firebase
import { db } from '../../../lib/firebaseAdmin';
import admin from 'firebase-admin';

export default async (req, res) => {
    const reqId = Math.random().toString(36).substring(7).toUpperCase();
    const log = (msg) => console.log(`🔍 [PROXY-${reqId}] ${msg}`);
    const errLog = (msg) => console.error(`❌ [ERROR-${reqId}] ${msg}`);

    // 1. قراءة إعدادات البروكسي (الأساسي والاحتياطي)
    const PROXY_BASE_URL = process.env.PYTHON_PROXY_URL; 
    const PROXY_BACKUP_URL = process.env.PYTHON_PROXY_BACKUP_URL; 

    if (!PROXY_BASE_URL) {
        errLog("CRITICAL: PYTHON_PROXY_URL is not defined in .env file");
        return res.status(500).json({ message: "Server Config Error" });
    }

    const { lessonId } = req.query;

    if (!lessonId) {
        return res.status(400).json({ message: "Missing lessonId" });
    }

    try {
        // 2. التحقق الأمني (بوابة المرور)
        const hasAccess = await checkUserAccess(req, lessonId, 'video');
        
        if (!hasAccess) {
            errLog("⛔ Access Denied or Token Invalid.");
            return res.status(403).json({ message: "Access Denied" });
        }

        const userId = req.headers['x-user-id']; 
        
        // 3. جلب البيانات من قاعدة البيانات (النسخة الآمنة)
        // ✅ تم التعديل هنا: جلب تفاصيل الشابتر، المادة، الكورس، والمدرس بالكامل
        const { data: videoData, error: vidErr } = await supabase
            .from('videos')
            .select(`
                youtube_video_id, 
                title, 
                chapters ( 
                    title, 
                    subjects ( 
                        title,
                        courses (
                            title,
                            teacher_id,
                            teachers ( name )
                        )
                    ) 
                )
            `)
            .eq('id', lessonId)
            .single();

        if (vidErr || !videoData) {
            errLog(`Database Fetch Error: ${vidErr?.message}`);
            return res.status(404).json({ message: "Video not found in DB" });
        }

        const youtubeId = videoData.youtube_video_id;
        log(`🎥 Requesting Proxy for: ${videoData.title} (User: ${userId})`);

        // استخراج تفاصيل الكورس والمدرس بشكل آمن
        const chapter = videoData.chapters;
        const subject = chapter?.subjects;
        const course = subject?.courses;
        
        const chapterName = chapter?.title || 'بدون فصل';
        const subjectName = subject?.title || 'بدون مادة';
        const courseName = course?.title || 'بدون كورس';
        const teacherId = course?.teacher_id || 'UNKNOWN_TEACHER';
        const teacherName = course?.teachers?.name || 'بدون مدرس';

        // ================================================================
        // ✅ [جديد] 3.5 تسجيل المشاهدة في Firebase بصمت (Fire and Forget)
        // ================================================================
        try {
            if (userId) {
                // ✅ تم التعديل: جلب first_name و username لعدم وجود last_name في الـ Schema
                const { data: studentData } = await supabase
                    .from('users')
                    .select('first_name, username')
                    .eq('id', userId)
                    .maybeSingle();

                const studentFullName = studentData 
                    ? (studentData.first_name || studentData.username || 'مستخدم') 
                    : 'مستخدم';

                const docId = `${lessonId}_${userId}`;

                // تسجيل البيانات بدون await لضمان سرعة الرد وعدم تعطيل الفيديو
                db.collection('video_views').doc(docId).set({
                    videoId: lessonId,
                    studentId: userId,
                    teacherId: teacherId.toString(), // ✅ تم وضع الـ ID الحقيقي للمدرس
                    teacherName: teacherName,       // ✅ اسم المدرس الفعلي
                    studentName: studentFullName,   // ✅ اسم الطالب الصحيح
                    videoTitle: videoData.title || 'بدون عنوان',
                    courseName: courseName,         // ✅ اسم الكورس
                    subjectName: subjectName,       // ✅ اسم المادة
                    chapterName: chapterName,       // ✅ اسم الفصل
                    lastViewedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true }).catch(err => errLog(`Firebase View Log Write Error: ${err.message}`));
                
                log("📝 Video view logged to Firebase successfully in background.");
            }
        } catch (firebaseSetupErr) {
            errLog(`Failed to setup Firebase log (Ignored): ${firebaseSetupErr.message}`);
        }
        // ================================================================


        // 4. الاتصال بالبروكسي (نظام السيرفر الأساسي + الاحتياطي)
        let result = null;
        let proxyMethodUsed = "local_vps_primary";

        try {
            // --- المحاولة الأولى: السيرفر الأساسي ---
            log(`➡️ Trying Primary Proxy...`);
            const primaryResponse = await axios.get(`${PROXY_BASE_URL}/extract`, {
                params: { id: youtubeId }
                // تم إزالة مهلة الانتظار، سينتظر الرد الطبيعي أو الخطأ
            });
            result = primaryResponse.data;

        } catch (primaryErr) {
            errLog(`⚠️ Primary Proxy Failed (${primaryErr.message}). Switching IMMEDIATELY to Backup Proxy...`);
            
            // إذا لم يكن هناك رابط احتياطي في .env، ارمِ الخطأ فوراً
            if (!PROXY_BACKUP_URL) {
                throw primaryErr; 
            }

            // --- المحاولة الثانية: السيرفر الاحتياطي (تعمل فوراً عند حدوث خطأ في الأساسي) ---
            try {
                const backupResponse = await axios.get(`${PROXY_BACKUP_URL}/extract`, {
                    params: { id: youtubeId }
                });
                result = backupResponse.data;
                proxyMethodUsed = "local_vps_backup_api"; // لتمييز مصدر الرد في النهاية
                log(`✅ Backup Proxy Succeeded!`);
            } catch (backupErr) {
                errLog(`❌ Backup Proxy ALSO Failed: ${backupErr.message}`);
                throw backupErr; // رمي الخطأ للـ catch الخارجية إذا فشل الاثنان
            }
        }

        // التأكد من وجود نتائج صالحة
        if (!result || !result.availableQualities || result.availableQualities.length === 0) {
            throw new Error("No streams found from either proxy");
        }

        // 5. فلترة وتنقية الروابط
        let rawQualities = result.availableQualities;
        const uniqueQualitiesMap = new Map();
        const audioStreams = [];

        for (const stream of rawQualities) {
            if (stream.type === 'audio_only') {
                audioStreams.push(stream);
                continue;
            }

            const quality = stream.quality;
            const codec = (stream.vcodec || "").toLowerCase();
            
            if (!uniqueQualitiesMap.has(quality)) {
                uniqueQualitiesMap.set(quality, stream);
            } else {
                const existingStream = uniqueQualitiesMap.get(quality);
                const existingCodec = (existingStream.vcodec || "").toLowerCase();
                
                if (codec.includes('avc1') && !existingCodec.includes('avc1')) {
                    uniqueQualitiesMap.set(quality, stream);
                }
            }
        }

        const filteredQualities = [
            ...Array.from(uniqueQualitiesMap.values()),
            ...audioStreams
        ];

        // 6. تجهيز الرد
        const thumbnail = `https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`;

        const { data: settingResult } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'offline_mode')
            .single();
        const isOfflineMode = settingResult ? settingResult.value === 'true' : true;

        return res.status(200).json({
            availableQualities: filteredQualities,
            title: videoData.title,
            thumbnail: thumbnail,
            duration: "0",
            youtube_video_id: youtubeId,
            db_video_title: videoData.title,
            subject_name: subjectName, 
            chapter_name: chapterName,
            offline_mode: isOfflineMode,
            proxy_method: proxyMethodUsed
        });

    // معالجة الأخطاء النهائية (لو فشل الأساسي والاحتياطي)
    } catch (proxyErr) {
        errLog(`VPS Proxy Error: ${proxyErr.message}`);
        
        if (proxyErr.code === 'ECONNREFUSED') {
            return res.status(502).json({ message: "Proxy Services Unreachable" });
        }
        if (proxyErr.response) {
            return res.status(502).json({ message: "VPS Extraction Failed", details: proxyErr.response.data });
        }
        return res.status(500).json({ message: "Proxy Connection Error" });
    }
};
