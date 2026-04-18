import { db } from '../../../../lib/firebaseAdmin';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper'; 

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const { user, error } = await requireTeacherOrAdmin(req, res);
        if (error) return; 

        // ✅ استقبال رقم الصفحة (الافتراضي 1) والحد الأقصى (الافتراضي 100)
        const { videoId, page = 1, limit = 100 } = req.query;
        
        const teacherId = user.teacherId ? user.teacherId.toString() : null; 

        if (!teacherId && user.role !== 'super_admin') {
             return res.status(400).json({ message: "لم يتم العثور على بروفايل المدرس" });
        }

        // ✅ حساب مقدار التخطي (Offset) بناءً على رقم الصفحة
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offsetNum = (pageNum - 1) * limitNum;

        // بناء الاستعلام الأساسي
        let baseQuery = db.collection('video_views');

        if (user.role !== 'super_admin') {
            baseQuery = baseQuery.where('teacherId', '==', teacherId);
        }

        if (videoId) {
            baseQuery = baseQuery.where('videoId', '==', videoId.toString());
        }

        // ✅ 1. جلب العدد الإجمالي (لحساب عدد الصفحات في الفرونت إند)
        const countSnapshot = await baseQuery.count().get();
        const totalCount = countSnapshot.data().count;

        // ✅ 2. جلب الـ 100 مشاهدة الخاصة بهذه الصفحة فقط
        const viewsQuery = baseQuery
            .orderBy('lastViewedAt', 'desc')
            .offset(offsetNum)
            .limit(limitNum);

        const snapshot = await viewsQuery.get();

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
                lastViewedAt: data.lastViewedAt ? data.lastViewedAt.toDate().toISOString() : null
            });
        });

        return res.status(200).json({ 
            success: true, 
            count: viewsList.length, 
            total: totalCount, // إرسال الإجمالي الكلي للفرونت إند
            views: viewsList 
        });

    } catch (error) {
        console.error("❌ Error in get-video-views API:", error);
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
}
