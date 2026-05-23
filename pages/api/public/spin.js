import { supabase } from '../../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { studentName, studentPhone, fingerprint } = req.body;

  // 1. التحقق من البيانات المطلوبة
  if (!studentName || !studentPhone || !fingerprint) {
      return res.status(400).json({ error: 'الاسم، رقم الهاتف، وبصمة الجهاز مطلوبة.' });
  }

  try {
      // =========================================================
      // 🛡️ 1. التحقق من البصمة (منع المشاركة المتكررة)
      // =========================================================
      const { data: existingSpin } = await supabase
          .from('wheel_spins')
          .select('id, prize_id, wheel_prizes(title)')
          .eq('browser_fingerprint', fingerprint)
          .maybeSingle();

      if (existingSpin) {
          return res.status(403).json({ 
              error: 'لقد قمت بتجربة حظك مسبقاً!',
              previous_prize: existingSpin.wheel_prizes?.title 
          });
      }

      // =========================================================
      // 🎲 2. سحب الجائزة من الصندوق (معالجة التزامن Concurrency)
      // =========================================================
      let claimedPrizeId = null;
      let retries = 3; // محاولة السحب 3 مرات في حال تزاحم الطلاب في نفس الثانية

      while (retries > 0 && !claimedPrizeId) {
          // أ. جلب أول تذكرة متاحة عشوائياً في الصندوق
          const { data: tickets } = await supabase
              .from('wheel_pool')
              .select('id, prize_id')
              .limit(1);

          if (!tickets || tickets.length === 0) {
              return res.status(400).json({ error: 'عذراً، لقد نفدت جميع الجوائز! حظ أوفر المرة القادمة.' });
          }

          const ticket = tickets[0];

          // ب. محاولة "حجز" التذكرة بحذفها
          // نستخدم .select() لنتأكد أن هذا الريكويست تحديداً هو من نجح في حذفها
          const { data: deletedTicket } = await supabase
              .from('wheel_pool')
              .delete()
              .eq('id', ticket.id)
              .select()
              .maybeSingle();

          if (deletedTicket) {
              claimedPrizeId = deletedTicket.prize_id; // نجحنا في قنص الجائزة!
          } else {
              retries--; // شخص آخر أخذها في نفس اللحظة، سنحاول مرة أخرى
          }
      }

      if (!claimedPrizeId) {
          return res.status(500).json({ error: 'ضغط عالي على السيرفر، يرجى المحاولة بعد قليل.' });
      }

      // =========================================================
      // 🎁 3. جلب تفاصيل الجائزة ومعالجتها
      // =========================================================
      const { data: prize } = await supabase
          .from('wheel_prizes')
          .select('*')
          .eq('id', claimedPrizeId)
          .single();

      let generatedCouponCode = null;

      // إذا كانت الجائزة "كوبون"، نقوم بإنشائه فوراً في جدول الكوبونات
      if (prize.type === 'coupon') {
          // توليد كود عشوائي (مثال: WIN-A7X9B)
          generatedCouponCode = `WIN-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
          
          // حساب تاريخ الانتهاء بناءً على validity_days
          const expiryDate = new Date(Date.now() + (prize.validity_days * 24 * 60 * 60 * 1000)).toISOString();

          // الإدخال في جدول الكوبونات الخاص بك
          await supabase.from('discount_codes').insert({
              code: generatedCouponCode,
              teacher_id: prize.teacher_id, // ربط الكوبون بالمدرس
              discount_type: prize.discount_type,
              discount_value: prize.discount_value,
              expires_at: expiryDate,
              is_used: false
          });
      }

      // =========================================================
      // 📝 4. تسجيل فوز الطالب في سجل العجلة (لحفظ النتيجة ومنعه من اللعب مجدداً)
      // =========================================================
      const { error: spinError } = await supabase.from('wheel_spins').insert({
          student_name: studentName,
          student_phone: studentPhone,
          browser_fingerprint: fingerprint,
          prize_id: prize.id,
          coupon_code: generatedCouponCode
      });

      // إذا حاول طالب اختراق النظام وإرسال نفس البصمة في نفس اللحظة، قاعدة البيانات سترفض بسبب الـ UNIQUE
      if (spinError) {
          if (spinError.code === '23505') { // رمز تكرار البيانات
              return res.status(403).json({ error: 'تم تسجيل مشاركتك مسبقاً.' });
          }
          console.error("Spin Save Error:", spinError);
      }

      // =========================================================
      // 🎉 5. إرسال النتيجة للفرونت إند لتدوير العجلة
      // =========================================================
      return res.status(200).json({
          success: true,
          prize: {
              id: prize.id,
              title: prize.title,
              type: prize.type,
              color: prize.color,
              coupon_code: generatedCouponCode,
              validity_days: prize.validity_days
          }
      });

  } catch (error) {
      console.error("Spin Logic Error:", error);
      return res.status(500).json({ error: 'حدث خطأ غير متوقع، يرجى المحاولة لاحقاً.' });
  }
}
