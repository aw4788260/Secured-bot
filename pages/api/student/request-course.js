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
      // حلقة التكرار (for...of) لدعم العمليات غير المتزامنة (await)
      // ---------------------------------------------------------
      for (const item of selectedItems) {
          const price = parseInt(item.price) || 0;
          totalPrice += price;
          
          let parentCourseName = null;
          let formattedTitle = '';

          // أ) إذا كان العنصر كورس
          if (item.type === 'course') {
              formattedTitle = `📦 كورس شامل: ${item.title}`;
              parentCourseName = item.title;
          } 
          // ب) إذا كان العنصر مادة
          else if (item.type === 'subject') {
              try {
                  // جلب رقم الكورس الأب للمادة
                  const { data: subjectData } = await supabase
                      .from('subjects')
                      .select('course_id')
                      .eq('id', item.id)
                      .single();

                  if (subjectData && subjectData.course_id) {
                      // جلب اسم الكورس الأب
                      const { data: courseData } = await supabase
                          .from('courses')
                          .select('title')
                          .eq('id', subjectData.course_id)
                          .single();
                      
                      if (courseData) {
                          parentCourseName = courseData.title;
                      }
                  }
              } catch (fetchErr) {
                  console.error('Error fetching parent info:', fetchErr);
              }

              // تنسيق النص للمادة: المادة في سطر والكورس في سطر
              formattedTitle = `📚 مادة: ${item.title}`;
              if (parentCourseName) {
                  formattedTitle += `\n   ⬅️ تابع لكورس: ${parentCourseName}`;
              }
          } 
          // ج) أي نوع آخر (احتياطي فقط)
          else {
              formattedTitle = `🔖 عنصر: ${item.title}`;
          }

          titleList.push(formattedTitle);

          requestedData.push({
              id: item.id,
              type: item.type,
              title: item.title,
              price: price,
              parent_course: parentCourseName || 'Unknown' // تسجيل اسم الكورس الأب في البيانات الخام
          });
      }

      // إضافة فاصل واضح بين العناصر في النص النهائي
      const finalTitle = titleList.join('\n──────────────────────\n');
      
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
        requested_data: requestedData
      });

      if (dbError) throw dbError;

      return res.status(200).json({ success: true, message: 'تم إرسال طلب الاشتراك بنجاح! سيتم مراجعته.' });

    } catch (error) {
      console.error("Server Error:", error);
      return res.status(500).json({ error: error.message });
    }
  });
};
