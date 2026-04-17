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
    const log = (msg) => console.log(`🔍 [PROXY-${reqId}] ${msg}`);
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
        // 2. جلب بيانات الفيديو من قاعدة البيانات
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
            return res.status(404).json({ message: "Video not found" });
        }

        const youtubeId = videoData.youtube_video_id;

        // استخراج المتغيرات بأمان لتجنب أخطاء undefined
        const chapter = videoData.chapters;
        const subject = chapter?.subjects;
        const course = subject?.courses;
        
        const chapterName = chapter?.title || 'بدون فصل';
        const subjectName = subject?.title || 'بدون مادة';
        const courseName = course?.title || 'بدون كورس';
        const teacherId = course?.teacher_id || 'UNKNOWN_TEACHER';
        const teacherName = course?.teachers?.name || 'بدون مدرس';

        // ================================================================
        // ✅ [مُحدّث] تسجيل المشاهدة في Firebase بدقة تامة
        // ================================================================
        try {
            // 1. استخراج الـ ID والتأكد من أنه ليس مصفوفة (Array)
            const rawStudentId = req.headers['x-user-id']; 
            const studentId = Array.isArray(rawStudentId) ? rawStudentId[0] : rawStudentId;
            
            if (studentId) {
                const docId = `${lessonId}_${studentId}`;
                
                // 2. جلب بيانات الطالب (تحويل studentId لرقم ليتطابق مع الـ bigint في الجدول)
                const { data: studentData, error: studentErr } = await supabase
                    .from('users')
                    .select('first_name, username, phone')
                    .eq('id', parseInt(studentId, 10))
                    .maybeSingle();

                if (studentErr) {
                    errLog(`Failed to fetch student data: ${studentErr.message}`);
                }

                // 3. تحديد اسم الطالب بدقة (الاسم الأول -> ثم اليوزرنيم -> ثم الهاتف)
                let studentFullName = 'مستخدم غير معروف';
                if (studentData) {
                    studentFullName = studentData.first_name || studentData.username || studentData.phone || 'مستخدم';
                }

                // 4. ⚠️ إضافة await ضرورية جداً لمنع الـ Timeout في Vercel قبل إتمام الحفظ
                await db.collection('video_views').doc(docId).set({
                    videoId: lessonId.toString(),
                    studentId: studentId.toString(),
                    teacherId: teacherId.toString(),
                    teacherName: teacherName,
                    studentName: studentFullName,
                    videoTitle: videoData.title || 'بدون عنوان',
                    courseName: courseName,
                    subjectName: subjectName,
                    chapterName: chapterName,
                    lastViewedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                
                log(`📝 Logged view to Firebase successfully for: ${studentFullName}`);
            }
        } catch (firebaseSetupErr) {
            errLog(`Firebase Write Error: ${firebaseSetupErr.message}`);
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
                    
                    // استخدام المتغير الاحتياطي
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
            errLog(`Proxy Failed: ${proxyErr.message}`);
        }

        // 4. إرسال الرد النهائي
        res.status(200).json({ 
            ...proxyResult, 
            url: proxyResult.url || null, 
            duration: "0",
            youtube_video_id: videoData.youtube_video_id, 
            db_video_title: videoData.title,
            subject_name: subjectName, 
            chapter_name: chapterName, 
            offline_mode: isOfflineMode,
            proxy_method: proxyMethodUsed
        });

    } catch (err) {
        errLog(`Critical Error: ${err.message}`);
        res.status(500).json({ message: err.message });
    }
};
