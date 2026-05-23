import { supabase } from '../../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { studentName, studentPhone, fingerprint } = req.body;

  if (!studentName || !studentPhone || !fingerprint) {
      return res.status(400).json({ error: 'الاسم، رقم الهاتف، وبصمة الجهاز مطلوبة.' });
  }

  // 🛡️ جدار الحماية الأول: فلترة الأرقام الوهمية والعشوائية
  const isValidEgyptian = /^01[0125][0-9]{8}$/.test(studentPhone);
  const isSpamNumber = /^01[0125](\d)\1{7}$/.test(studentPhone); // يكتشف الأرقام المكررة مثل 01000000000

  if (!isValidEgyptian || isSpamNumber) {
      return res.status(400).json({ error: 'الرقم غير صالح! يرجى إدخال رقم مصري حقيقي (11 رقم) لتتمكن من استلام جائزتك.' });
  }

  // 🛡️ جدار الحماية الثاني: التقاط رقم شبكة الإنترنت (IP) للطالب
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';

  try {
      // التحقق من تفعيل العجلة عالمياً
      const { data: globalSettings } = await supabase
          .from('wheel_settings')
          .select('is_wheel_enabled')
          .eq('id', 1)
          .maybeSingle();

      if (globalSettings && !globalSettings.is_wheel_enabled) {
          return res.status(403).json({ error: 'عذراً، لقد تم إيقاف مسابقة عجلة الحظ من قِبل الإدارة حالياً.' });
      }

      // 🛡️ جدار الحماية الثالث: فحص شامل (للبصمة، أو رقم الهاتف، أو الـ IP) في نفس اللحظة
      const { data: existingSpins, error: spinCheckError } = await supabase
          .from('wheel_spins')
          .select('id, student_phone, browser_fingerprint, ip_address, wheel_prizes(title)')
          .or(`browser_fingerprint.eq.${fingerprint},student_phone.eq.${studentPhone},ip_address.eq.${clientIp}`);

      if (spinCheckError) throw spinCheckError;

      if (existingSpins && existingSpins.length > 0) {
          // فحص سبب كشف الطالب للرد بالرسالة المناسبة
          const blockedByPhone = existingSpins.some(spin => spin.student_phone === studentPhone);
          const blockedByFingerprint = existingSpins.some(spin => spin.browser_fingerprint === fingerprint);
          const ipSpinsCount = existingSpins.filter(spin => spin.ip_address === clientIp).length;

          if (blockedByPhone) {
              return res.status(403).json({ error: 'تم استخدام رقم الهاتف هذا مسبقاً في السحب!', needs_clear: false });
          }
          if (blockedByFingerprint) {
              return res.status(403).json({ error: 'لقد قمت بتجربة حظك مسبقاً من هذا الجهاز!', needs_clear: true });
          }
          if (ipSpinsCount >= 1) {
              // إذا فتح المتصفح المخفي حاول اللعب للمرة الثالثة بنفس الإنترنت سيتم صده هنا
              return res.status(403).json({ error: 'تم استنفاد الحد الأقصى للمحاولات المسموح بها من شبكة الإنترنت الخاصة بك!', needs_clear: false });
          }
      }

      // 🎲 سحب الجائزة من الصندوق
      let claimedPrizeId = null;
      let retries = 3;

      while (retries > 0 && !claimedPrizeId) {
          const { data: tickets } = await supabase.from('wheel_pool').select('id, prize_id').limit(1);

          if (!tickets || tickets.length === 0) {
              return res.status(400).json({ error: 'عذراً، لقد نفدت جميع الجوائز المتوفرة! حظ أوفر المرة القادمة.' });
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
          return res.status(500).json({ error: 'ضغط عالي على الخادم، يرجى إعادة المحاولة بعد قليل.' });
      }

      // 🎁 جلب تفاصيل الجائزة
      const { data: prize, error: prizeError } = await supabase
          .from('wheel_prizes')
          .select('*')
          .eq('id', claimedPrizeId)
          .single();

      if (prizeError) throw prizeError;

      // تقليل المخزون (Stock)
      const nextStock = Math.max(0, (prize.total_stock - 1));
      await supabase
          .from('wheel_prizes')
          .update({ total_stock: nextStock })
          .eq('id', claimedPrizeId);

      let generatedCouponCode = null;

      // 🎟️ توليد الكوبون
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

      // 📝 حفظ الفوز مع تسجيل الـ IP الجديد
      const { error: spinError } = await supabase.from('wheel_spins').insert({
          student_name: studentName,
          student_phone: studentPhone,
          browser_fingerprint: fingerprint,
          ip_address: clientIp, // <-- تم إضافته لضرب التصفح المخفي
          prize_id: prize.id,
          coupon_code: generatedCouponCode
      });

      if (spinError) {
          if (spinError.code === '23505') {
              return res.status(403).json({ error: 'تم تسجيل مشاركتك مسبقاً.', needs_clear: false });
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
      return res.status(500).json({ error: 'حدث خطأ غير متوقع بالخادم، يرجى المحاولة لاحقاً.' });
  }
}
