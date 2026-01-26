import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
  api: { bodyParser: false },
};

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // 2. التحقق الأمني
  const isAuthorized = await checkUserAccess(req);
  if (!isAuthorized) {
    return res.status(401).json({ error: 'Unauthorized Access' });
  }

  // 3. معرف المستخدم
  const userId = req.headers['x-user-id'];

  // جلب بيانات المستخدم
  const { data: user } = await supabase
    .from('users')
    .select('id, username, first_name, phone')
    .eq('id', userId)
    .single();

  if (!user) {
    return res.status(404).json({ error: 'User data not found' });
  }

  // 4. إعداد مجلد الحفظ
  const uploadDir = path.join(process.cwd(), 'storage', 'receipts');
  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  } catch (err) {
    return res.status(500).json({ error: 'فشل في إنشاء مجلد التخزين' });
  }

  const form = formidable({
    uploadDir,
    keepExtensions: true,
    maxFileSize: 30 * 1024 * 1024,
    filename: (name, ext, part) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      return `receipt_${uniqueSuffix}${ext}`;
    }
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Formidable Error:", err);
      return res.status(500).json({ error: 'فشل معالجة الملف المرفوع' });
    }

    try {
      const getValue = (key) => {
        const val = fields[key];
        return Array.isArray(val) ? val[0] : val;
      };
      
      const getFile = (key) => {
        const file = files[key];
        return Array.isArray(file) ? file[0] : file;
      };

      // استقبال البيانات
      const selectedItemsStr = getValue('selectedItems');
      const userNote = getValue('user_note');
      const receiptFile = getFile('receiptFile');
      
      if (!selectedItemsStr) return res.status(400).json({ error: 'لا توجد عناصر مختارة' });
      if (!receiptFile) return res.status(400).json({ error: 'صورة الإيصال مطلوبة' });

      const selectedItems = JSON.parse(selectedItemsStr);
      if (selectedItems.length === 0) return res.status(400).json({ error: 'السلة فارغة' });

      const fileName = path.basename(receiptFile.filepath);

      // المتغيرات النهائية
      let totalPrice = 0;
      let titleList = [];
      const requestedData = [];

      // ---------------------------------------------------------
      // بداية التعديل: التكرار غير المتزامن لجلب اسم الكورس الأب
      // ---------------------------------------------------------
      for (const item of selectedItems) {
        const price = parseInt(item.price) || 0;
        totalPrice += price;
        
        let parentCourseName = null;
        let typeLabel = '';

        // تحديد اسم الكورس الأب بناءً على النوع
        if (item.type === 'course') {
          typeLabel = '📦 كورس كامل';
          parentCourseName = item.title; // هو نفسه الكورس
        } else {
          // التعامل مع المواد الفرعية
          typeLabel = '📄 جزء منفصل'; 
          
          try {
            // منطق البحث المتسلسل للوصول للكورس (Course ID -> Title)
            let courseId = null;

            if (item.type === 'subject') {
              // المادة مرتبطة بالكورس مباشرة
              const { data } = await supabase.from('subjects').select('course_id').eq('id', item.id).single();
              courseId = data?.course_id;
            
            } else if (item.type === 'exam') {
              // الامتحان مرتبط بالمادة -> كورس
              const { data: ex } = await supabase.from('exams').select('subject_id').eq('id', item.id).single();
              if (ex?.subject_id) {
                const { data: sub } = await supabase.from('subjects').select('course_id').eq('id', ex.subject_id).single();
                courseId = sub?.course_id;
              }

            } else if (item.type === 'chapter') {
              // الفصل مرتبط بالمادة -> كورس
              const { data: ch } = await supabase.from('chapters').select('subject_id').eq('id', item.id).single();
              if (ch?.subject_id) {
                const { data: sub } = await supabase.from('subjects').select('course_id').eq('id', ch.subject_id).single();
                courseId = sub?.course_id;
              }

            } else if (item.type === 'video') {
              // فيديو -> فصل -> مادة -> كورس
              const { data: vid } = await supabase.from('videos').select('chapter_id').eq('id', item.id).single();
              if (vid?.chapter_id) {
                 const { data: ch } = await supabase.from('chapters').select('subject_id').eq('id', vid.chapter_id).single();
                 if (ch?.subject_id) {
                    const { data: sub } = await supabase.from('subjects').select('course_id').eq('id', ch.subject_id).single();
                    courseId = sub?.course_id;
                 }
              }

            } else if (item.type === 'pdf') {
              // ملف -> فصل -> مادة -> كورس
              const { data: pdf } = await supabase.from('pdfs').select('chapter_id').eq('id', item.id).single();
              if (pdf?.chapter_id) {
                 const { data: ch } = await supabase.from('chapters').select('subject_id').eq('id', pdf.chapter_id).single();
                 if (ch?.subject_id) {
                    const { data: sub } = await supabase.from('subjects').select('course_id').eq('id', ch.subject_id).single();
                    courseId = sub?.course_id;
                 }
              }
            }

            // إذا وجدنا رقم الكورس، نجلب اسمه
            if (courseId) {
              const { data: course } = await supabase.from('courses').select('title').eq('id', courseId).single();
              if (course) parentCourseName = course.title;
            }

          } catch (err) {
            console.error(`Error fetching parent course for item ${item.id}:`, err);
          }
        }

        // 1. تنسيق العنوان للعرض (مع التمييز)
        if (item.type === 'course') {
            titleList.push(`${typeLabel}: ${item.title}`);
        } else {
            // مثال: فيديو شرح (من كورس الفيزياء)
            const parentInfo = parentCourseName ? ` (من كورس: ${parentCourseName})` : '';
            // نترجم نوع العنصر للعربية للتوضيح
            const itemTypeAr = item.type === 'video' ? 'فيديو' : item.type === 'pdf' ? 'ملف' : item.type === 'exam' ? 'امتحان' : item.type === 'chapter' ? 'فصل' : 'مادة';
            
            titleList.push(`${itemTypeAr}: ${item.title}${parentInfo}`);
        }

        // 2. تجهيز البيانات للتخزين كـ JSON
        requestedData.push({
            id: item.id,
            type: item.type,
            title: item.title,     // اسم العنصر المطلوب
            price: price,
            parent_course: parentCourseName || 'Unknown' // حفظ اسم الكورس الأب هنا
        });
      }
      // ---------------------------------------------------------
      // نهاية التعديل
      // ---------------------------------------------------------

      const finalTitle = titleList.join('\n');
      
      // الحفظ في القاعدة
      const { error: dbError } = await supabase.from('subscription_requests').insert({
        user_id: user.id,
        user_name: user.first_name,
        user_username: user.username,
        phone: user.phone,
        
        course_title: finalTitle,
        total_price: totalPrice,
        
        user_note: userNote,
        payment_file_path: fileName,
        status: 'pending',
        requested_data: requestedData // يحتوي الآن على تفاصيل الأب
      });

      if (dbError) throw dbError;

      return res.status(200).json({ success: true, message: 'تم إرسال طلب الاشتراك بنجاح! سيتم مراجعته.' });

    } catch (error) {
      console.error("Server Error:", error);
      return res.status(500).json({ error: error.message });
    }
  });
};
