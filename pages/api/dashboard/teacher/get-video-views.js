import { db } from '../../../../lib/firebaseAdmin';
import { verifyTeacher } from '../../../../lib/teacherAuth'; //

export default async function handler(req, res) {
    // 1. السماح فقط بطلبات GET
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        // 2. التحقق من هوية وصلاحية المدرس
        // الدالة verifyTeacher تتأكد من التوكن وترجع بيانات المدرس إذا كان صالحاً
        const teacher = await verifyTeacher(req);
        if (!teacher) {
            return res.status(401).json({ message: 'Unauthorized: Teacher access required' });
        }

        const { videoId } = req.query;
        const teacherId = teacher.id;

        // 3. بناء الاستعلام من Firebase Firestore
        // نبدأ بالبحث عن المشاهدات الخاصة بهذا المدرس فقط لضمان الخصوصية
        let viewsQuery = db.collection('video_views').where('teacherId', '==', teacherId);

        // إذا تم تمرير معرف فيديو محدد، نقوم بفلترة النتائج
        if (videoId) {
            viewsQuery = viewsQuery.where('videoId', '==', videoId);
        }

        // ترتيب النتائج: الأحدث أولاً
        // ملاحظة: قد يطلب منك Firebase إنشاء "Index" لهذا الاستعلام في أول مرة تشغيل
        viewsQuery = viewsQuery.orderBy('lastViewedAt', 'desc');

        const snapshot = await viewsQuery.get();

        // 4. تجميع البيانات وتنسيقها
        const viewsList = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            viewsList.push({
                id: doc.id,
                studentId: data.studentId,
                studentName: data.studentName,
                videoTitle: data.videoTitle,
                courseName: data.courseName,
                chapterName: data.chapterName,
                // تحويل طابع الوقت الخاص بـ Firebase إلى نص ISO قابل للقراءة
                lastViewedAt: data.lastViewedAt ? data.lastViewedAt.toDate().toISOString() : null
            });
        });

        // 5. إرسال الرد النهائي
        return res.status(200).json({ 
            success: true, 
            count: viewsList.length, 
            views: viewsList 
        });

    } catch (error) {
        console.error("❌ Error in get-video-views API:", error);
        return res.status(500).json({ 
            message: 'Internal Server Error', 
            error: error.message 
        });
    }
}
