import { supabase } from '../../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { studentName, studentPhone, fingerprint } = req.body;

  if (!studentName || !studentPhone || !fingerprint) {
      return res.status(400).json({ error: 'الاسم، رقم الهاتف، وبصمة الجهاز مطلوبة.' });
  }

  try {
      // 1. التحقق من البصمة في قاعدة البيانات
      const { data: existingSpin, error: spinCheckError } = await supabase
          .from('wheel_spins')
          .select('id, prize_id, wheel_prizes(title)')
          .eq('browser_fingerprint', fingerprint)
          .maybeSingle();

      if (spinCheckError) throw spinCheckError;

      // ✅ تعديل: إذا لم نجد سجلاً، السيرفر يرسل إشارة للفرونت إند ليحذف localStorage
      // هذا يضمن المزامنة الكاملة بين قاعدة البيانات والمتصفح
      if (existingSpin) {
          return res.status(403).json({ 
              error: 'لقد قمت بتجربة حظك مسبقاً!',
              previous_prize: existingSpin.wheel_prizes?.title,
              needs_clear: true // إشارة للفرونت إند لتنظيف localStorage
          });
      }

      // 2. سحب الجائزة من الصندوق (معالجة التزامن)
      let claimedPrizeId = null;
      let retries = 3;

      while (retries > 0 && !claimedPrizeId) {
          const { data: tickets } = await supabase.from('wheel_pool').select('id, prize_id').limit(1);

          if (!tickets || tickets.length === 0) {
              return res.status(400).json({ error: 'عذراً، لقد نفدت جميع الجوائز! حظ أوفر المرة القادمة.' });
          }

          const ticket = tickets[0];
          const { data: deletedTicket } = await supabase
              .from('wheel_pool')
              .delete()
              .eq('id', ticket.id)
              .select()
              .maybeSingle();

          if (deletedTicket) {
              claimedPrizeId = deletedTicket.prize_id;
          } else {
              retries--;
          }
      }

      if (!claimedPrizeId) {
          return res.status(500).json({ error: 'ضغط عالي على السيرفر، يرجى المحاولة بعد قليل.' });
      }

      // 3. جلب تفاصيل الجائزة
      const { data: prize, error: prizeError } = await supabase
          .from('wheel_prizes')
          .select('*')
          .eq('id', claimedPrizeId)
          .single();

      if (prizeError) throw prizeError;

      let generatedCouponCode = null;

      // 4. توليد الكوبون
      if (prize.type === 'coupon') {
          generatedCouponCode = `WIN-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
          const expiryDate = new Date(Date.now() + (prize.validity_days * 24 * 60 * 60 * 1000)).toISOString();

          await supabase.from('discount_codes').insert({
              code: generatedCouponCode,
              teacher_id: prize.teacher_id,
              discount_type: prize.discount_type,
              discount_value: prize.discount_value,
              expires_at: expiryDate,
              is_used: false
          });
      }

      // 5. تسجيل الفوز
      const { error: spinError } = await supabase.from('wheel_spins').insert({
          student_name: studentName,
          student_phone: studentPhone,
          browser_fingerprint: fingerprint,
          prize_id: prize.id,
          coupon_code: generatedCouponCode
      });

      if (spinError) {
          if (spinError.code === '23505') {
              return res.status(403).json({ error: 'تم تسجيل مشاركتك مسبقاً.', needs_clear: true });
          }
          throw spinError;
      }

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
