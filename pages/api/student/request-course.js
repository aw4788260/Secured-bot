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
      let userNote = getValue('user_note') || ''; // تم التعديل إلى let لتمكين الإضافة عليها
      const appliedCode = getValue('discount_code'); // استقبال كود الخصم (إن وُجد)
      const receiptFile = getFile('receiptFile');
      
      if (!selectedItemsStr) return res.status(400).json({ error: 'لا توجد عناصر مختارة' });
      if (!receiptFile) return res.status(400).json({ error: 'صورة الإيصال مطلوبة' });

      const selectedItems = JSON.parse(selectedItemsStr);
      if (selectedItems.length === 0) return res.status(400).json({ error: 'السلة فارغة' });

      // =========================================================
      // 🛡️ 1. التحقق من عدم وجود طلبات مكررة قيد الانتظار (Pending)
      // =========================================================
      const selectedItemIds = selectedItems.map(item => item.id.toString());
      
      const { data: pendingRequests } = await supabase
        .from('subscription_requests')
        .select('requested_data')
        .eq('user_id', user.id)
        .eq('status', 'pending');

      if (pendingRequests && pendingRequests.length > 0) {
        let isDuplicate = false;
        
        // البحث داخل بيانات الطلبات المعلقة عما إذا كان أي منها يحتوي على عناصر السلة الحالية
        for (const reqData of pendingRequests) {
          const items = reqData.requested_data || [];
          for (const item of items) {
            if (selectedItemIds.includes(item.id.toString())) {
              isDuplicate = true;
              break;
            }
          }
          if (isDuplicate) break;
        }

        if (isDuplicate) {
          // ⚠️ نحذف صورة الإيصال المرفوعة لتوفير مساحة السيرفر لأن الطلب مرفوض
          try { fs.unlinkSync(receiptFile.filepath); } catch (e) {}
          return res.status(400).json({ error: 'لديك طلب قيد المراجعة بالفعل يحتوي على هذه العناصر.' });
        }
      }
      // =========================================================

      const fileName = path.basename(receiptFile.filepath);

      // المتغيرات النهائية
      let originalTotalPrice = 0; // السعر الأصلي
      let finalTotalPrice = null; // ✅ السعر الفعلي يبدأ بـ null
      let titleList = [];
      const requestedData = [];
      let detectedTeacherId = null; 
      let discountCodeId = null;  // لحفظ الـ ID الخاص بالكود

      // ---------------------------------------------------------
      // حلقة التكرار لدعم العمليات غير المتزامنة
      // ---------------------------------------------------------
      for (const [index, item] of selectedItems.entries()) {
          const price = parseInt(item.price) || 0;
          originalTotalPrice += price; // جمع السعر الأصلي
          
          let parentCourseName = null;
          let formattedTitle = '';

          // أ) إذا كان العنصر كورس
          if (item.type === 'course') {
              formattedTitle = `📦 كورس شامل: ${item.title}`;
              parentCourseName = item.title;
              
              if (index === 0 && !detectedTeacherId) {
                  const { data: courseData } = await supabase.from('courses').select('teacher_id').eq('id', item.id).single();
                  if (courseData) detectedTeacherId = courseData.teacher_id;
              }
          } 
          // ب) إذا كان العنصر مادة
          else if (item.type === 'subject') {
              try {
                  const { data: subjectData } = await supabase.from('subjects').select('course_id, courses(title, teacher_id)').eq('id', item.id).single();
                  if (subjectData && subjectData.courses) {
                      parentCourseName = subjectData.courses.title;
                      if (index === 0 && !detectedTeacherId) {
                          detectedTeacherId = subjectData.courses.teacher_id;
                      }
                  }
              } catch (fetchErr) {
                  console.error('Error fetching parent info:', fetchErr);
              }

              formattedTitle = `📚 مادة: ${item.title}`;
              if (parentCourseName) {
                  formattedTitle += `\n   ⬅️ تابع لكورس: ${parentCourseName}`;
              }
          } 
          // ج) أي نوع آخر
          else {
              formattedTitle = `🔖 عنصر: ${item.title}`;
          }

          titleList.push(formattedTitle);

          requestedData.push({
              id: item.id,
              type: item.type,
              title: item.title,
              price: price,
              parent_course: parentCourseName || 'Unknown'
          });
      }

      // =========================================================
      // 🎁 2. معالجة كود الخصم والتأكد من صحته قبل الحفظ
      // =========================================================
      if (appliedCode && appliedCode.trim() !== '') {
         const { data: discountData } = await supabase
            .from('discount_codes')
            .select('*')
            .eq('code', appliedCode.trim().toUpperCase())
            .eq('teacher_id', detectedTeacherId) // تأكيد أن الكود يخص مدرس المادة
            .eq('is_used', false)
            .single();

         if (!discountData) {
            // الكود غير صالح أو تم استخدامه، يجب إيقاف العملية وحذف الصورة المرفوعة
            try { fs.unlinkSync(receiptFile.filepath); } catch (e) {}
            return res.status(400).json({ error: 'كود الخصم المدخل غير صحيح أو تم استخدامه مسبقاً.' });
         }

         // ✅ التحقق النهائي من الصلاحية أثناء طلب الاشتراك
         if (discountData.expires_at) {
             const now = new Date();
             const expiryDate = new Date(discountData.expires_at);
             if (now > expiryDate) {
                 try { fs.unlinkSync(receiptFile.filepath); } catch (e) {}
                 return res.status(400).json({ error: 'عذراً، كود الخصم المدخل منتهي الصلاحية.' });
             }
         }

         discountCodeId = discountData.id;

         // 🔴 التعديل الجديد: إضافة الجملة داخل الملاحظة
         const usedCouponText = `(تم استخدام الكوبون: ${appliedCode.trim().toUpperCase()})`;
         userNote = userNote.trim() !== '' ? `${userNote}\n${usedCouponText}` : usedCouponText;

         // ✅ حساب السعر النهائي وتحديثه فقط في حالة وجود كود خصم
         if (discountData.discount_type === 'percentage') {
            finalTotalPrice = originalTotalPrice - (originalTotalPrice * (discountData.discount_value / 100));
         } else if (discountData.discount_type === 'fixed') {
            finalTotalPrice = originalTotalPrice - discountData.discount_value;
         }
         
         if (finalTotalPrice !== null && finalTotalPrice < 0) {
             finalTotalPrice = 0;
         }
      }
      // =========================================================

      // إضافة فاصل واضح بين العناصر في النص النهائي
      const finalTitle = titleList.join('\n──────────────────────\n');
      
      // 3. الحفظ في القاعدة
      const { error: dbError } = await supabase.from('subscription_requests').insert({
        user_id: user.id,
        user_name: user.first_name,
        user_username: user.username,
        phone: user.phone,
        
        course_title: finalTitle,
        total_price: originalTotalPrice,       // 👈 السعر الأصلي
        actual_paid_price: finalTotalPrice,    // 👈 null إذا لم يكن هناك خصم، أو قيمة الخصم
        discount_code_id: discountCodeId,      // 👈 ربط الطلب بالكوبون المستخدم
        
        user_note: userNote,                   // 👈 الملاحظة هنا ستحتوي على الجملة الجديدة بجانب كلام الطالب
        payment_file_path: fileName,
        status: 'pending',
        requested_data: requestedData,
        
        teacher_id: detectedTeacherId
      });

      if (dbError) {
         try { fs.unlinkSync(receiptFile.filepath); } catch (e) {}
         throw dbError;
      }

      // 4. حرق الكود (تحديث حالته لمستخدَم) بعد التأكد من حفظ الطلب بنجاح
      if (discountCodeId) {
         await supabase.from('discount_codes').update({ is_used: true }).eq('id', discountCodeId);
      }

      return res.status(200).json({ success: true, message: 'تم إرسال طلب الاشتراك بنجاح! سيتم مراجعته.' });

    } catch (error) {
      console.error("Server Error:", error);
      return res.status(500).json({ error: error.message });
    }
  });
};
