import { supabase } from '../../../lib/supabaseClient';
import axios from 'axios';
import { checkUserAccess } from '../../../lib/authHelper';
import jwt from 'jsonwebtoken'; // ✅ استيراد مكتبة التوكن لضمان استخراج الاسم كخطة بديلة

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
        // ✅ تم التعديل هنا: التدرج في جلب بيانات الفصل والمادة والكورس والمدرس بالكامل
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
        // ✅ [مُحدّث] تسجيل المشاهدة في Firebase بدقة تامة وضمان اكتمال العملية
        // ================================================================
        try {
            // 1. استخراج الـ ID والتأكد من أنه ليس مصفوفة (Array)
            const rawUserId = req.headers['x-user-id']; 
            const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
            
            if (userId) {
                let fallbackName = 'مستخدم';
                
                // 🟢 الخطة البديلة (Fallback): استخراج اسم المستخدم من التوكن مباشرة
                try {
                    const authHeader = req.headers['authorization'];
                    if (authHeader && authHeader.startsWith('Bearer ')) {
                        const token = authHeader.split(' ')[1];
                        const decoded = jwt.verify(token, process.env.JWT_SECRET);
                        if (decoded.username) fallbackName = decoded.username;
                    }
                } catch(e) {
                    errLog("Failed to decode JWT for fallback name.");
                }

                // 🟢 جلب بيانات الطالب (تحويل userId لرقم ليتطابق مع الـ bigint في الجدول)
                const { data: studentData, error: studentErr } = await supabase
                    .from('users')
                    .select('first_name, username, phone')
                    .eq('id', parseInt(userId, 10))
                    .maybeSingle();

                if (studentErr) {
                    errLog(`Failed to fetch student data: ${studentErr.message}`);
                }

                // 🟢 تحديد الاسم النهائي (الأولوية: الاسم الأول -> اليوزرنيم -> الهاتف -> التوكن)
                const studentFullName = studentData 
                    ? (studentData.first_name || studentData.username || studentData.phone || fallbackName) 
                    : fallbackName;

                const docId = `${lessonId}_${userId}`;

                // 4. ⚠️ استخدام await لضمان إتمام حفظ البيانات قبل أن تنهي بيئة السيرفر الدالة
                await db.collection('video_views').doc(docId).set({
                    videoId: lessonId.toString(),
                    studentId: userId.toString(),
                    teacherId: teacherId.toString(),
                    teacherName: teacherName,
                    studentName: studentFullName,
                    videoTitle: videoData.title || 'بدون عنوان',
                    courseName: courseName,
                    subjectName: subjectName,
                    chapterName: chapterName,
                    lastViewedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                
                log(`📝 Logged view successfully. Student: ${studentFullName}`);
            }
        } catch (firebaseSetupErr) {
            errLog(`Firebase Write Error: ${firebaseSetupErr.message}`);
        }
        // ================================================================


        // 4. الاتصال بالبروكسي (الأساسي ثم الاحتياطي)
        let proxyResult = { url: null, availableQualities: [] };
        let isOfflineMode = true;

        try {
            // --- المحاولة الأولى: السيرفر الأساسي ---
            log(`➡️ Trying Primary Proxy...`);
            const primaryResponse = await axios.get(`${PROXY_BASE_URL}/extract`, { 
                params: { id: youtubeId }
                // تم إزالة مهلة الانتظار، سينتظر الرد الطبيعي أو الخطأ
            });
            
            proxyResult = primaryResponse.data;
            log("✅ Primary Proxy Succeeded!");

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
                
                proxyResult = backupResponse.data;
                log(`✅ Backup Proxy Succeeded!`);
            } catch (backupErr) {
                errLog(`❌ Backup Proxy ALSO Failed: ${backupErr.message}`);
                throw backupErr; // رمي الخطأ للـ catch الخارجية إذا فشل الاثنان
            }
        }

        // التأكد من وجود نتائج صالحة
        if (!proxyResult || !proxyResult.availableQualities || proxyResult.availableQualities.length === 0) {
            throw new Error("No streams found from either proxy");
        }

        // 5. فلترة وتنقية الروابط
        let rawQualities = proxyResult.availableQualities;
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
            ...proxyResult, 
            url: proxyResult.url || null, 
            duration: "0",
            youtube_video_id: youtubeId, 
            db_video_title: videoData.title,
            subject_name: subjectName, 
            chapter_name: chapterName, 
            offline_mode: isOfflineMode 
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
