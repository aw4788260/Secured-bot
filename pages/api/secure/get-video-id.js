import { supabase } from '../../../lib/supabaseClient';
import axios from 'axios';
import { checkUserAccess } from '../../../lib/authHelper';

// ✅ 1. استيراد مكتبات Firebase
import { db } from '../../../lib/firebaseAdmin';
import admin from 'firebase-admin';

// تم تغيير اسم المتغير الاحتياطي لتجنب التعارض
const PYTHON_PROXY_BASE_URL = process.env.PYTHON_PROXY_BASE_URL;
const PYTHON_HLS_BACKUP_URL = process.env.PYTHON_HLS_BACKUP_URL; 

export default async (req, res) => {
    const reqId = Math.random().toString(36).substring(7).toUpperCase();
    const log = (msg) => console.log(`🔍 [DEBUG-${reqId}] ${msg}`);
    const errLog = (msg) => console.error(`❌ [ERROR-${reqId}] ${msg}`);

    log("🚀 Start Request: get-video-id");

    const { lessonId } = req.query;
    
    if (!lessonId) {
        return res.status(400).json({ message: "Missing Lesson ID" });
    }

    // 1. التحقق الأمني
    const hasAccess = await checkUserAccess(req, lessonId, 'video');
    if (!hasAccess) {
        return res.status(403).json({ message: "Access Denied" });
    }

    try {
        // 2. جلب بيانات الفيديو من قاعدة البيانات (نسختك الأصلية دون تغيير)
        const { data: videoData, error: vidErr } = await supabase
            .from('videos')
            .select('youtube_video_id, title, chapters ( title, subjects ( title ) )')
            .eq('id', lessonId)
            .single();

        if (vidErr || !videoData) {
            return res.status(404).json({ message: "Video not found" });
        }

        // ================================================================
        // ✅ [جديد] تسجيل المشاهدة في Firebase بصمت (Fire and Forget)
        // ================================================================
        try {
            const studentId = req.headers['x-user-id']; // مستخرج من authHelper
            
            if (studentId) {
                const docId = `${lessonId}_${studentId}`;
                
                // جلب اسم الطالب (اختياري، مضاف للتبسيط في العرض للمدرس)
                const { data: studentData } = await supabase
                    .from('users')
                    .select('first_name, last_name')
                    .eq('id', studentId)
                    .maybeSingle();

                const studentFullName = studentData 
                    ? `${studentData.first_name || ''} ${studentData.last_name || ''}`.trim() 
                    : 'مستخدم';

                // تسجيل البيانات في فايربيز دون انتظار (لا يوجد await)
                db.collection('video_views').doc(docId).set({
                    videoId: lessonId,
                    studentId: studentId,
                    teacherId: 'UNKNOWN_TEACHER', // يتم تجاهله أو استخدامه لاحقاً إذا احتجت
                    studentName: studentFullName || 'بدون اسم',
                    videoTitle: videoData.title || 'بدون عنوان',
                    courseName: videoData.chapters?.subjects?.title || 'بدون مادة',
                    chapterName: videoData.chapters?.title || 'بدون فصل',
                    lastViewedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true }).catch(err => {
                    errLog(`Firebase View Log Error: ${err.message}`);
                });
                
                log("📝 Firebase View logging triggered.");
            }
        } catch (firebaseSetupErr) {
            errLog(`Firebase Setup Error (Ignored): ${firebaseSetupErr.message}`);
        }
        // ================================================================

        // ================================================================
        // 3. الاتصال بالبروكسي (الأساسي ثم الاحتياطي)
        // ================================================================
        let proxyResult = { url: null, availableQualities: [] };
        let isOfflineMode = true;

        try {
            const settingResult = await supabase.from('app_settings').select('value').eq('key', 'offline_mode').single();
            if (settingResult.data) {
                isOfflineMode = settingResult.data.value === 'true';
            }

            if (PYTHON_PROXY_BASE_URL) {
                const proxyHeaders = process.env.PYTHON_PROXY_KEY ? { 'X-API-Key': process.env.PYTHON_PROXY_KEY } : {};
                const queryParams = { youtubeId: videoData.youtube_video_id };

                try {
                    // --- المحاولة الأولى: السيرفر الأساسي ---
                    log("➡️ Trying Primary Proxy...");
                    const primaryResponse = await axios.get(`${PYTHON_PROXY_BASE_URL}/api/get-hls-playlist`, { 
                        params: queryParams,
                        headers: proxyHeaders
                    });
                    
                    proxyResult = primaryResponse.data;
                    log("✅ Primary Proxy Succeeded!");

                } catch (primaryErr) {
                    errLog(`⚠️ Primary Proxy Failed: ${primaryErr.message}. Switching IMMEDIATELY to Backup...`);
                    
                    // استخدام المتغير الجديد هنا
                    if (PYTHON_HLS_BACKUP_URL) {
                        // --- المحاولة الثانية: السيرفر الاحتياطي ---
                        const backupResponse = await axios.get(`${PYTHON_HLS_BACKUP_URL}/api/get-hls-playlist`, {
                            params: queryParams,
                            headers: proxyHeaders
                        });
                        
                        proxyResult = backupResponse.data;
                        log("✅ Backup Proxy Succeeded!");
                    } else {
                        throw primaryErr;
                    }
                }

                if (!proxyResult.url && proxyResult.availableQualities?.length > 0) {
                    proxyResult.url = proxyResult.availableQualities.sort((a, b) => b.quality - a.quality)[0].url;
                }

            } else {
                log("⚠️ Proxy URL missing, skipping stream fetch.");
            }
        } catch (proxyErr) {
            errLog(`Proxy Failed (Ignored for Player 2): ${proxyErr.message}`);
        }

        // 4. إرسال الرد النهائي
        res.status(200).json({ 
            ...proxyResult, 
            url: proxyResult.url || null, 
            duration: "0",
            youtube_video_id: videoData.youtube_video_id, 
            db_video_title: videoData.title,
            subject_name: videoData.chapters?.subjects?.title,
            chapter_name: videoData.chapters?.title,
            offline_mode: isOfflineMode 
        });

    } catch (err) {
        errLog(`Critical Error: ${err.message}`);
        res.status(500).json({ message: err.message });
    }
};
