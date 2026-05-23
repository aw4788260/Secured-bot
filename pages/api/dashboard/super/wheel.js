import { supabase } from '../../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';

export default async function handler(req, res) {
  // 1. حماية المسار: تأكد أن من يطلب هذا الـ API هو السوبر أدمن فقط
  const authResult = await requireSuperAdmin(req, res);
  if (authResult.error) return; 

  // ==========================================================
  // 🟢 GET: جلب الجوائز والإحصائيات (مُعدل لحل مشكلة الـ Schema Cache)
  // ==========================================================
  if (req.method === 'GET') {
    try {
      // 1. جلب الجوائز (بدون الاعتماد على الربط المباشر لحل خطأ PGRST204)
      const { data: prizes, error: prizesError } = await supabase
        .from('wheel_prizes')
        .select('*')
        .order('id', { ascending: true });

      if (prizesError) throw prizesError;

      // 2. جلب المدرسين بشكل منفصل لدمج الأسماء يدوياً
      const { data: teachers, error: teachersError } = await supabase
        .from('teachers')
        .select('id, name');

      // 3. دمج البيانات (إضافة اسم المدرس لكل جائزة برمجياً)
      const enrichedPrizes = prizes ? prizes.map(prize => ({
          ...prize,
          teachers: teachers?.find(t => t.id === prize.teacher_id) || null
      })) : [];

      // حساب الإحصائيات
      const { count: poolCount } = await supabase.from('wheel_pool').select('id', { count: 'exact', head: true });
      const { count: spinsCount } = await supabase.from('wheel_spins').select('id', { count: 'exact', head: true });

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
  // 🟠 POST: تنفيذ الإجراءات
  // ==========================================================
  if (req.method === 'POST') {
    const { action, payload } = req.body;

    try {
      // 1. إضافة أو تعديل جائزة
      if (action === 'save_prize') {
         const prizeData = { ...payload };
         
         // إزالة الـ ID إذا كان غير موجود ليقوم Postgres بتوليده
         if (!prizeData.id || prizeData.id === '') delete prizeData.id;
         
         // تحويل القيم الفارغة للـ teacher_id إلى null
         if (prizeData.teacher_id === '' || prizeData.teacher_id === undefined || prizeData.teacher_id === null) {
             prizeData.teacher_id = null;
         } else {
             prizeData.teacher_id = parseInt(prizeData.teacher_id);
         }

         // تنظيف الأرقام
         prizeData.discount_value = parseFloat(prizeData.discount_value) || 0;
         prizeData.total_stock = parseInt(prizeData.total_stock) || 0;
         prizeData.validity_days = parseInt(prizeData.validity_days) || 0;
         
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

      // 3. تنشيط الحملة
      if (action === 'activate_campaign') {
         const { data: activePrizes } = await supabase
            .from('wheel_prizes')
            .select('id, total_stock')
            .eq('is_active', true);

         if (!activePrizes || activePrizes.length === 0) {
             return res.status(400).json({ error: 'لا توجد جوائز مفعلة لبدء الحملة.' });
         }

         await supabase.from('wheel_pool').delete().neq('id', 0);

         let ticketsPool = [];
         activePrizes.forEach(prize => {
             for (let i = 0; i < prize.total_stock; i++) {
                 ticketsPool.push({ prize_id: prize.id });
             }
         });

         for (let i = ticketsPool.length - 1; i > 0; i--) {
             const j = Math.floor(Math.random() * (i + 1));
             [ticketsPool[i], ticketsPool[j]] = [ticketsPool[j], ticketsPool[i]];
         }

         if (ticketsPool.length > 0) {
             const { error: insertError } = await supabase.from('wheel_pool').insert(ticketsPool);
             if (insertError) throw insertError;
         }

         return res.status(200).json({ success: true, message: `تم تفعيل الحملة! يتوفر الآن ${ticketsPool.length} جائزة للسحب.` });
      }

      // 4. تصفير السجل
      if (action === 'reset_spins') {
         await supabase.from('wheel_spins').delete().neq('id', 0);
         return res.status(200).json({ success: true, message: 'تم مسح سجل المشاركات القديم بنجاح.' });
      }

      return res.status(400).json({ error: 'إجراء غير معروف' });

    } catch (err) {
      console.error("Wheel Admin Error:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
