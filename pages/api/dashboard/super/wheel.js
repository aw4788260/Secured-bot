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
      // جلب قائمة الجوائز
      const { data: prizes, error: prizesError } = await supabase
        .from('wheel_prizes')
        .select('*, teachers(name)')
        .order('id', { ascending: true });

      if (prizesError) throw prizesError;

      // حساب التذاكر المتبقية في الصندوق
      const { count: poolCount } = await supabase
        .from('wheel_pool')
        .select('id', { count: 'exact', head: true });

      // حساب عدد الفائزين حتى الآن
      const { count: spinsCount } = await supabase
        .from('wheel_spins')
        .select('id', { count: 'exact', head: true });

      return res.status(200).json({ 
          prizes: prizes || [], 
          poolCount: poolCount || 0,
          spinsCount: spinsCount || 0
      });
    } catch (err) {
      return res.status(500).json({ error: 'فشل جلب بيانات عجلة الحظ' });
    }
  }

  // ==========================================================
  // 🟠 POST: تنفيذ الإجراءات (إضافة، تنشيط الحملة، تصفير السجل)
  // ==========================================================
  if (req.method === 'POST') {
    const { action, payload } = req.body;

    try {
      // 1. إضافة أو تعديل جائزة
      // 1. إضافة أو تعديل جائزة
      if (action === 'save_prize') {
         // تأكد من حذف الـ id إذا كان فارغاً لضمان توليده تلقائياً من القاعدة
         const prizeData = { ...payload };
         if (!prizeData.id) delete prizeData.id; 

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
         // أ. جلب الجوائز المفعلة فقط
         const { data: activePrizes } = await supabase
            .from('wheel_prizes')
            .select('id, total_stock')
            .eq('is_active', true);

         if (!activePrizes || activePrizes.length === 0) {
             return res.status(400).json({ error: 'لا توجد جوائز مفعلة لبدء الحملة.' });
         }

         // ب. مسح الصندوق القديم بالكامل
         await supabase.from('wheel_pool').delete().neq('id', 0); // neq(0) لحذف كل شيء بأمان

         // ج. تجهيز التذاكر
         let ticketsPool = [];
         activePrizes.forEach(prize => {
             for (let i = 0; i < prize.total_stock; i++) {
                 ticketsPool.push({ prize_id: prize.id });
             }
         });

         // د. خلط التذاكر عشوائياً (Fisher-Yates Shuffle)
         for (let i = ticketsPool.length - 1; i > 0; i--) {
             const j = Math.floor(Math.random() * (i + 1));
             [ticketsPool[i], ticketsPool[j]] = [ticketsPool[j], ticketsPool[i]];
         }

         // هـ. إدخال التذاكر في الصندوق
         if (ticketsPool.length > 0) {
             const { error: insertError } = await supabase.from('wheel_pool').insert(ticketsPool);
             if (insertError) throw insertError;
         }

         return res.status(200).json({ success: true, message: `تم تفعيل الحملة! يتوفر الآن ${ticketsPool.length} جائزة للسحب.` });
      }

      // 4. تصفير سجل المشاركات (للسماح للطلاب باللعب من جديد)
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
