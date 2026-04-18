import { db } from '../../../../lib/firebaseAdmin';
// ✅ استخدام دالة التحقق الصحيحة الخاصة بلوحة التحكم
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper'; 

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        // 1. التحقق من هوية المدرس أو الأدمن باستخدام الـ Cookies
        const { user, error } = await requireTeacherOrAdmin(req, res);
        
        // إذا كان هناك خطأ في الصلاحيات، الدالة سترسل الرد التلقائي (401)
        if (error) return; 

        const { videoId } = req.query;
        
        // ✅ التعديل الرئيسي هنا:
        // جلب الـ ID الخاص ببروفايل المدرس (teacherId) وتحويله لنص ليطابق ما تم حفظه في فايربيز
        // (الكود القديم كان يستخدم user.id وهو رقم حساب الدخول)
        const teacherId = user.teacherId ? user.teacherId.toString() : null; 

        // حماية إضافية لمنع تمرير بيانات فارغة لفايربيز
        if (!teacherId && user.role !== 'super_admin') {
             return res.status(400).json({ message: "لم يتم العثور على بروفايل المدرس" });
        }

        // 2. بناء استعلام فايربيز (Firebase Query)
        let viewsQuery = db.collection('video_views');

        // إذا كان المستخدم مدرساً، نفلتر النتائج لتخصه فقط (السوبر أدمن يرى كل شيء)
        if (user.role !== 'super_admin') {
            viewsQuery = viewsQuery.where('teacherId', '==', teacherId);
        }

        if (videoId) {
            viewsQuery = viewsQuery.where('videoId', '==', videoId.toString());
        }

        // الترتيب: الأحدث أولاً
        viewsQuery = viewsQuery.orderBy('lastViewedAt', 'desc');

        const snapshot = await viewsQuery.get();

        // 3. تجميع البيانات
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

        // 4. إرسال الرد
        return res.status(200).json({ 
            success: true, 
            count: viewsList.length, 
            views: viewsList 
        });

    } catch (error) {
        console.error("❌ Error in get-video-views API:", error);
        
        // ملاحظة: إذا طلب فايربيز بناء (Index) في الكونسول، سيظهر الخطأ هنا
        return res.status(500).json({ 
            message: 'Internal Server Error', 
            error: error.message 
        });
    }
}
