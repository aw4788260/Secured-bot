import { supabase } from '../../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';

export default async function handler(req, res) {
  // 1. حماية المسار: تأكد أن من يطلب هذا الـ API هو السوبر أدمن فقط
  const authResult = await requireSuperAdmin(req, res);
  if (authResult.error) return; 

  // ==========================================================
  // 🟢 GET: جلب الجوائز، الإحصائيات، جدول الفائزين، والحالة العامة
  // ==========================================================
  if (req.method === 'GET') {
    try {
      const { data: prizes, error: prizesError } = await supabase
        .from('wheel_prizes')
        .select('*')
        .order('id', { ascending: true });

      if (prizesError) throw prizesError;

      const { data: teachers } = await supabase.from('teachers').select('id, name');

      const enrichedPrizes = prizes ? prizes.map(prize => ({
          ...prize,
          teachers: teachers?.find(t => t.id === prize.teacher_id) || null
      })) : [];

      const { data: winners, error: winnersError } = await supabase
        .from('wheel_spins')
        .select('*, wheel_prizes(title, type)')
        .order('id', { ascending: false }); 

      const { data: globalSettings } = await supabase
        .from('wheel_settings')
        .select('is_wheel_enabled')
        .eq('id', 1)
        .maybeSingle();

      const { count: poolCount } = await supabase.from('wheel_pool').select('id', { count: 'exact', head: true });
      const { count: spinsCount } = await supabase.from('wheel_spins').select('id', { count: 'exact', head: true });

      return res.status(200).json({ 
          prizes: enrichedPrizes, 
          winners: winners || [],
          isWheelEnabled: globalSettings ? globalSettings.is_wheel_enabled : true,
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

    // 🎯 دالة مساعدة: تقوم بمسح الصندوق القديم وإعادة الخلط التلقائي بناءً على الجوائز المفعلة حالياً
    const autoReshuffle = async () => {
        const { data: activePrizes } = await supabase
            .from('wheel_prizes')
            .select('id, total_stock')
            .eq('is_active', true);

        // مسح التذاكر القديمة بالكامل
        await supabase.from('wheel_pool').delete().neq('id', 0);

        if (!activePrizes || activePrizes.length === 0) return; // إذا لم تكن هناك جوائز، يترك الصندوق فارغاً

        let ticketsPool = [];
        activePrizes.forEach(prize => {
            for (let i = 0; i < prize.total_stock; i++) {
                ticketsPool.push({ prize_id: prize.id });
            }
        });

        // خلط عشوائي متقدم (Fisher-Yates)
        for (let i = ticketsPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [ticketsPool[i], ticketsPool[j]] = [ticketsPool[j], ticketsPool[i]];
        }

        // إدخال التذاكر الجديدة للصندوق
        if (ticketsPool.length > 0) {
            await supabase.from('wheel_pool').insert(ticketsPool);
        }
    };

    try {
      // الإجراء: تغيير حالة تفعيل العجلة بالكامل
      if (action === 'toggle_wheel_status') {
         const { error } = await supabase
            .from('wheel_settings')
            .upsert({ id: 1, is_wheel_enabled: payload.enabled });
            
         if (error) throw error;
         return res.status(200).json({ success: true, message: payload.enabled ? 'تم تفعيل عجلة الحظ للطلاب بنجاح 🟢' : 'تم إيقاف وتعطيل عجلة الحظ عن الطلاب بالكامل 🔴' });
      }

      // 1. إضافة أو تعديل جائزة (وتطبيق الخلط التلقائي)
      if (action === 'save_prize') {
         const prizeData = { ...payload };
         if ('teachers' in prizeData) delete prizeData.teachers;
         if (!prizeData.id || prizeData.id === '') delete prizeData.id;
         
         if (prizeData.teacher_id === '' || prizeData.teacher_id === undefined || prizeData.teacher_id === null) {
             prizeData.teacher_id = null;
         } else {
             prizeData.teacher_id = parseInt(prizeData.teacher_id);
         }

         prizeData.discount_value = parseFloat(prizeData.discount_value) || 0;
         prizeData.total_stock = parseInt(prizeData.total_stock) || 0;
         prizeData.validity_days = parseInt(prizeData.validity_days) || 0;
         
         if (prizeData.type !== 'coupon') prizeData.discount_type = null;

         const { error } = await supabase.from('wheel_prizes').upsert(prizeData);
         if (error) throw error;

         // 🎯 استدعاء الخلط التلقائي بعد الحفظ مباشرة
         await autoReshuffle();

         return res.status(200).json({ success: true, message: 'تم حفظ الجائزة وإعادة خلط الصندوق تلقائياً 🎲' });
      }

      // 2. حذف جائزة (وتطبيق الخلط التلقائي)
      if (action === 'delete_prize') {
         const { error } = await supabase.from('wheel_prizes').delete().eq('id', payload.id);
         if (error) throw error;

         // 🎯 استدعاء الخلط التلقائي بعد الحذف مباشرة
         await autoReshuffle();

         return res.status(200).json({ success: true, message: 'تم الحذف وإعادة تحديث الصندوق تلقائياً 🗑️' });
      }

      // 3. تنشيط الحملة (الخلط اليدوي)
      if (action === 'activate_campaign') {
         // 🎯 أصبح بإمكاننا استخدام نفس الدالة هنا اختصاراً وتأكيداً
         await autoReshuffle();
         return res.status(200).json({ success: true, message: 'تم تفعيل الحملة وخلط التذاكر بنجاح! 🚀' });
      }

      // 4. تصفير سجل المشاركات
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
