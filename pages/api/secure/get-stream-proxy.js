import { supabase } from '../../../lib/supabaseClient';
import axios from 'axios';
import { checkUserAccess } from '../../../lib/authHelper';
import jwt from 'jsonwebtoken';

// ✅ 1. استيراد مكتبات Firebase
import { db } from '../../../lib/firebaseAdmin';
import admin from 'firebase-admin';

export default async (req, res) => {
    const reqId = Math.random().toString(36).substring(7).toUpperCase();
    const log = (msg) => console.log(`🔍 [PROXY-${reqId}] ${msg}`);
    const errLog = (msg) => console.error(`❌ [ERROR-${reqId}] ${msg}`);

    log("🚀 Start Request: get-stream-proxy");

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

        // 3. جلب البيانات من قاعدة البيانات (النسخة الآمنة)
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
        // ✅ 3.5 تسجيل المشاهدة في Firebase بدقة تامة
        // ================================================================
        try {
            const rawUserId = req.headers['x-user-id']; 
            const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;

            if (userId) {
                let fallbackName = 'مستخدم';
                
                // الخطة البديلة لجلب الاسم من التوكن
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

                // جلب بيانات الطالب (باستخدام parseInt لحل مشكلة الـ bigint)
                const { data: studentData, error: studentErr } = await supabase
                    .from('users')
                    .select('first_name, username, phone')
                    .eq('id', parseInt(userId, 10))
                    .maybeSingle();

                if (studentErr) {
                    errLog(`Failed to fetch student data: ${studentErr.message}`);
                }

                const studentFullName = studentData 
                    ? (studentData.first_name || studentData.username || studentData.phone || fallbackName) 
                    : fallbackName;

                const docId = `${lessonId}_${userId}`;

                // ⚠️ إضافة await لمنع Vercel من إغلاق الاتصال قبل الحفظ
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
                
                log(`📝 Video view logged to Firebase successfully for: ${studentFullName}`);
            }
        } catch (firebaseSetupErr) {
            errLog(`Failed to setup Firebase log: ${firebaseSetupErr.message}`);
        }
        // ================================================================


        // 4. الاتصال بالبروكسي (نظام السيرفر الأساسي + الاحتياطي)
        let proxyResult = null; // ✅ تم إزالة تعريف isOfflineMode من هنا لمنع التكرار

        try {
            // --- المحاولة الأولى: السيرفر الأساسي ---
            log(`➡️ Trying Primary Proxy...`);
            const primaryResponse = await axios.get(`${PROXY_BASE_URL}/extract`, {
                params: { id: youtubeId }
            });
            proxyResult = primaryResponse.data;
            log("✅ Primary Proxy Succeeded!");

        } catch (primaryErr) {
            errLog(`⚠️ Primary Proxy Failed (${primaryErr.message}). Switching IMMEDIATELY to Backup Proxy...`);
            
            if (!PROXY_BACKUP_URL) {
                throw primaryErr; 
            }

            // --- المحاولة الثانية: السيرفر الاحتياطي ---
            try {
                const backupResponse = await axios.get(`${PROXY_BACKUP_URL}/extract`, {
                    params: { id: youtubeId }
                });
                proxyResult = backupResponse.data;
                log(`✅ Backup Proxy Succeeded!`);
            } catch (backupErr) {
                errLog(`❌ Backup Proxy ALSO Failed: ${backupErr.message}`);
                throw backupErr;
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
        
        proxyResult.availableQualities = filteredQualities;

        // 6. تجهيز الرد
        const thumbnail = `https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`;

        const { data: settingResult } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'offline_mode')
            .single();
            
        // ✅ يتم تعريف المتغير مرة واحدة فقط هنا
        const isOfflineMode = settingResult ? settingResult.value === 'true' : true;

        return res.status(200).json({
            ...proxyResult,
            url: proxyResult.url || null,
            thumbnail: thumbnail,
            duration: "0",
            youtube_video_id: youtubeId,
            db_video_title: videoData.title,
            subject_name: subjectName, 
            chapter_name: chapterName,
            offline_mode: isOfflineMode
        });

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
