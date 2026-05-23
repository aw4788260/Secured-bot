import { supabase } from '../../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';

export default async function handler(req, res) {
  // 1. حماية المسار: تأكد أن من يطلب هذا الـ API هو السوبر أدمن فقط
  const authResult = await requireSuperAdmin(req, res);
  if (authResult.error) return; 

  // ==========================================================
  // 🟢 GET: جلب الجوائز والإحصائيات
  // ==========================================================
  if (req.method === 'GET') {
    try {
      // 1. جلب الجوائز بشكل مسطح متوافق تماماً مع بنية الجدول لمنع خطأ PGRST204
      const { data: prizes, error: prizesError } = await supabase
        .from('wheel_prizes')
        .select('id, title, type, discount_value, discount_type, validity_days, total_stock, color, teacher_id, is_active, created_at')
        .order('id', { ascending: true });

      if (prizesError) throw prizesError;

      // 2. جلب المدرسين بشكل منفصل لربطهم برمجياً وتخطي كاش البوستجريس المتضارب
      const { data: teachers, error: teachersError } = await supabase
        .from('teachers')
        .select('id, name');

      // 3. دمج البيانات برمجياً لتوفر كائن متوافق مع الفرونت إند (p.teachers?.name)
      const enrichedPrizes = prizes ? prizes.map(prize => ({
          ...prize,
          teachers: teachers?.find(t => t.id === prize.teacher_id) ? {
              name: teachers.find(t => t.id === prize.teacher_id).name
          } : null
      })) : [];

      // 4. حساب التذاكر المتبقية في الصندوق
      const { count: poolCount } = await supabase
        .from('wheel_pool')
        .select('id', { count: 'exact', head: true });

      // 5. حساب عدد الفائزين حتى الآن
      const { count: spinsCount } = await supabase
        .from('wheel_spins')
        .select('id', { count: 'exact', head: true });

      return res.status(200).json({ 
          prizes: enrichedPrizes, 
          poolCount: poolCount || 0,
          spinsCount: spinsCount || 0
      });
    } catch (err) {
      console.error("Wheel Get Error:", err);
      return res.status(500).json({ error: 'فشل جلب بيانات عجلة الحظ' });
    }
  }

  // ==========================================================
  // 🟠 POST: تنفيذ الإجراءات (إضافة، تعديل، تنشيط، تصفير)
  // ==========================================================
  if (req.method === 'POST') {
    const { action, payload } = req.body;

    try {
      // 1. إضافة أو تعديل جائزة
      if (action === 'save_prize') {
         const prizeData = { ...payload };
         
         // إزالة حقل الكائن الوهمي الراجع من الفرونت إند قبل الإدخال في قاعدة البيانات لمنع أخطاء البنية
         if ('teachers' in prizeData) {
             delete prizeData.teachers;
         }

         // إذا كان الـ ID فارغاً أو نصاً فارغاً نقوم بحذفه ليعمل الترقيم التلقائي للمفتاح الأساسي للجدول
         if (!prizeData.id || prizeData.id === '') {
             delete prizeData.id;
         } else {
             prizeData.id = parseInt(prizeData.id);
         }
         
         // معالجة القيمة الفارغة لـ teacher_id وتحويلها لـ null متوافق مع نوع bigint في البوستجريس
         if (prizeData.teacher_id === '' || prizeData.teacher_id === undefined || prizeData.teacher_id === null) {
             prizeData.teacher_id = null;
         } else {
             prizeData.teacher_id = parseInt(prizeData.teacher_id);
         }

         // تنظيف البيانات الرقمية لضمان عدم تمرير نصوص فارغة توافقاً مع قيود التحقق للجدول
         prizeData.discount_value = parseFloat(prizeData.discount_value) || 0;
         prizeData.total_stock = parseInt(prizeData.total_stock) || 0;
         prizeData.validity_days = parseInt(prizeData.validity_days) || 0;
         
         // في حال لم تكن الجائزة كوبون، يجب مسح حقل نوع الخصم ليتوافق مع قيد التحقق الخاص بالجدول
         if (prizeData.type !== 'coupon') {
             prizeData.discount_type = null;
         }

         const { error } = await supabase.from('wheel_prizes').upsert(prizeData);
         if (error) throw error;
         return res.status(200).json({ success: true, message: 'تم حفظ الجائزة بنجاح' });
      }

      // 2. حذف جائزة
      if (action === 'delete_prize') {
         const { error } = await supabase.from('wheel_prizes').delete().eq('id', payload.id);
         if (error) throw error;
         return res.status(200).json({ success: true, message: 'تم الحذف بنجاح' });
      }

      // 3. 🚀 تنشيط الحملة (خلط الصندوق Pre-shuffled Pool)
      if (action === 'activate_campaign') {
         const { data: activePrizes } = await supabase
            .from('wheel_prizes')
            .select('id, total_stock')
            .eq('is_active', true);

         if (!activePrizes || activePrizes.length === 0) {
             return res.status(400).json({ error: 'لا توجد جوائز مفعلة لبدء الحملة.' });
         }

         // مسح كامل تذاكر الصندوق القديمة بأمان
         await supabase.from('wheel_pool').delete().neq('id', 0);

         // تجهيز التذاكر بناءً على المخزون (total_stock)
         let ticketsPool = [];
         activePrizes.forEach(prize => {
             for (let i = 0; i < prize.total_stock; i++) {
                 ticketsPool.push({ prize_id: prize.id });
             }
         });

         // خلط التذاكر بطريقة Fisher-Yates العشوائية الكاملة
         for (let i = ticketsPool.length - 1; i > 0; i--) {
             const j = Math.floor(Math.random() * (i + 1));
             [ticketsPool[i], ticketsPool[j]] = [ticketsPool[j], ticketsPool[i]];
         }

         // ضخ التذاكر المخلوطة بداخل جدول الصندوق
         if (ticketsPool.length > 0) {
             const { error: insertError } = await supabase.from('wheel_pool').insert(ticketsPool);
             if (insertError) throw insertError;
         }

         return res.status(200).json({ success: true, message: `تم تفعيل الحملة! يتوفر الآن ${ticketsPool.length} جائزة جاهزة في الصندوق للطلاب.` });
      }

      // 4. تصفير سجل المشاركات (للسماح للطلاب بإعادة اللعب مرة أخرى)
      if (action === 'reset_spins') {
         await supabase.from('wheel_spins').delete().neq('id', 0);
         return res.status(200).json({ success: true, message: 'تم مسح سجل المشاركات القديم بنجاح، العجلة متاحة للجميع الآن.' });
      }

      return res.status(400).json({ error: 'إجراء غير معروف' });

    } catch (err) {
      console.error("Wheel Admin Error:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
