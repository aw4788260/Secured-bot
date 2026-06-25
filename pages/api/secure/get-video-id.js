import { supabase } from '../../../lib/supabaseClient';
import axios from 'axios';
import { checkUserAccess } from '../../../lib/authHelper';
import crypto from 'crypto'; // ✅ استيراد مكتبة التشفير

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
        // 2. جلب بيانات الفيديو من قاعدة البيانات
        // ✅ تمت إضافة جلب bunny_video_id
        const { data: videoData, error: vidErr } = await supabase
            .from('videos')
            .select(`
                youtube_video_id,
                bunny_video_id, 
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
        // ✅ [جديد] تسجيل المشاهدة في Firebase بصمت (Fire and Forget)
        // ================================================================
        try {
            const studentId = req.headers['x-user-id']; // مستخرج من authHelper
            
            if (studentId) {
                const docId = `${lessonId}_${studentId}`;
                
                // جلب اسم الطالب (الاعتماد على first_name ثم username)
                const { data: studentData } = await supabase
                    .from('users')
                    .select('first_name, username')
                    .eq('id', studentId)
                    .maybeSingle();

                const studentFullName = studentData 
                    ? (studentData.first_name || studentData.username || 'مستخدم') 
                    : 'مستخدم';

                // تسجيل البيانات في فايربيز دون انتظار (لا يوجد await)
                db.collection('video_views').doc(docId).set({
                    videoId: lessonId,
                    studentId: studentId,
                    teacherId: teacherId.toString(), // ✅ المعرف الحقيقي للمدرس
                    teacherName: teacherName,       // ✅ اسم المدرس
                    studentName: studentFullName,   // ✅ اسم الطالب الصحيح
                    videoTitle: videoData.title || 'بدون عنوان',
                    courseName: courseName,         // ✅ اسم الكورس
                    subjectName: subjectName,       // ✅ اسم المادة
                    chapterName: chapterName,       // ✅ اسم الفصل
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
        // 3. الاتصال بالسيرفرات (Bunny الأول -> Proxy احتياطي أول -> HLS احتياطي ثاني)
        // ================================================================
        let proxyResult = { url: null, availableQualities: [] };
        let isOfflineMode = true;

        try {
            const settingResult = await supabase.from('app_settings').select('value').eq('key', 'offline_mode').single();
            if (settingResult.data) {
                isOfflineMode = settingResult.data.value === 'true';
            }

            // 🟢 المحاولة الأولى: السيرفر الأساسي (Bunny Stream)
            if (videoData.bunny_video_id) {
                log("➡️ Trying Primary Server (Bunny Stream)...");
                try {
                    const bVideoId = videoData.bunny_video_id;
                    
                    // ✅ جلب البيانات الحساسة من متغيرات البيئة فقط
                    const streamDomain = process.env.BUNNY_STREAM_DOMAIN;
                    const pullZoneKey = process.env.BUNNY_PULL_ZONE_KEY;
                    
                    // التحقق من وجود المتغيرات لتجنب الأخطاء
                    if (!streamDomain || !pullZoneKey) {
                        throw new Error("Missing BunnyCDN environment variables (BUNNY_STREAM_DOMAIN or BUNNY_PULL_ZONE_KEY)");
                    }
                    
                    // الخوارزمية المطابقة لبايثون
                    const expirationHours = 24; 
                    const expires = Math.floor(Date.now() / 1000) + (expirationHours * 3600);
                    const tokenPath = `/${bVideoId}/`;
                    
                    const hashableString = `${pullZoneKey}${tokenPath}${expires}token_path=${tokenPath}`;

                    const hash = crypto.createHash('sha256').update(hashableString, 'utf-8').digest();
                    let token = hash.toString('base64');
                    token = token.replace(/\n/g, '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
                    
                    const encodedPath = encodeURIComponent(tokenPath);
                    const fileName = "playlist.m3u8";

                    proxyResult.url = `https://${streamDomain}/bcdn_token=${token}&expires=${expires}&token_path=${encodedPath}${tokenPath}${fileName}`;
                    log("✅ Bunny Stream URL Generated Successfully!");
                } catch (bunnyErr) {
                    errLog(`⚠️ Bunny Stream Generation Failed: ${bunnyErr.message}`);
                }
            }

            // 🟡 إذا لم يكن هناك Bunny ID أو فشل التوليد، ننتقل للسيرفرات الاحتياطية
            if (!proxyResult.url && PYTHON_PROXY_BASE_URL) {
                const proxyHeaders = process.env.PYTHON_PROXY_KEY ? { 'X-API-Key': process.env.PYTHON_PROXY_KEY } : {};
                const queryParams = { youtubeId: videoData.youtube_video_id };

                try {
                    // --- المحاولة الثانية: السيرفر الاحتياطي الأول ---
                    log("➡️ Trying First Backup (Primary Proxy)...");
                    const primaryResponse = await axios.get(`${PYTHON_PROXY_BASE_URL}/api/get-hls-playlist`, { 
                        params: queryParams,
                        headers: proxyHeaders
                    });
                    
                    proxyResult = primaryResponse.data;
                    log("✅ First Backup Proxy Succeeded!");

                } catch (primaryErr) {
                    errLog(`⚠️ First Backup Proxy Failed: ${primaryErr.message}. Switching IMMEDIATELY to Second Backup...`);
                    
                    // --- المحاولة الثالثة: السيرفر الاحتياطي الثاني ---
                    if (PYTHON_HLS_BACKUP_URL) {
                        const backupResponse = await axios.get(`${PYTHON_HLS_BACKUP_URL}/api/get-hls-playlist`, {
                            params: queryParams,
                            headers: proxyHeaders
                        });
                        
                        proxyResult = backupResponse.data;
                        log("✅ Second Backup Proxy Succeeded!");
                    } else {
                        throw primaryErr;
                    }
                }

                if (!proxyResult.url && proxyResult.availableQualities?.length > 0) {
                    proxyResult.url = proxyResult.availableQualities.sort((a, b) => b.quality - a.quality)[0].url;
                }
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
            bunny_video_id: videoData.bunny_video_id,
            db_video_title: videoData.title,
            subject_name: subjectName, // ✅ استخدام المتغير المستخرج بأمان
            chapter_name: chapterName, // ✅ استخدام المتغير المستخرج بأمان
            offline_mode: isOfflineMode 
        });

    } catch (err) {
        errLog(`Critical Error: ${err.message}`);
        res.status(500).json({ message: err.message });
    }
};
