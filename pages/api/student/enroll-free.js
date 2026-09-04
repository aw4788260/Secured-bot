import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper';
import { buildGrantTimestamps, isExemptFromExpiry } from '../../../lib/accessExpiryHelper';

// 🔒 كلمة السر الخاصة بالتفعيل المجاني
// ⚠️ ملاحظة: يجب أن تكون هذه الكلمة مطابقة تماماً لما سترسله من تطبيق Flutter
const FREE_MODE_SECRET = "Medaad_Free_Activation_2026_Secure";

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // 1. التحقق من المستخدم (Auth Check)
  const isAuthorized = await checkUserAccess(req);
  if (!isAuthorized) return res.status(401).json({ error: 'Unauthorized' });

  const userId = req.headers['x-user-id'];
  
  // ✅ استقبال كلمة السر من الهيدر
  const incomingSecret = req.headers['x-free-secret'];

  // ✅ التحقق من تطابق كلمة السر
  if (incomingSecret !== FREE_MODE_SECRET) {
      console.log(`[Security Warning] Invalid Free Mode Secret attempt by User: ${userId}`);
      return res.status(403).json({ error: 'Forbidden: Invalid Activation Secret' });
  }

  const { items } = req.body; // items = [{id, type: 'course'|'subject'}]

  try {
    // 2. تحقق أمني: هل الوضع المجاني مفعل في السيرفر؟
    const { data: settings } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'free_mode')
      .single();

    if (!settings || settings.value !== 'true') {
      return res.status(403).json({ error: 'Free mode is not active' });
    }

    // 🎓 المدرسون/المشرفون يحصلون دائماً على وصول مدى الحياة، بغض النظر عن
    // مدة الوصول المحددة على الكورس/المادة.
    const { data: actingUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    const exemptFromExpiry = isExemptFromExpiry(actingUser?.role);

    // 3. التفعيل المباشر
    for (const item of items) {
      if (item.type === 'course') {
        // التحقق من عدم التكرار
        const { data: exist } = await supabase
          .from('user_course_access')
          .select('id')
          .eq('user_id', userId)
          .eq('course_id', item.id)
          .single();

        if (!exist) {
          // ⏳ حساب تاريخ انتهاء الصلاحية بناءً على مدة الكورس عند لحظة المنح
          const { granted_at, expires_at } = await buildGrantTimestamps(item.id, null);
          await supabase.from('user_course_access').insert({
            user_id: userId,
            course_id: item.id,
            granted_at,
            expires_at: exemptFromExpiry ? null : expires_at
          });
        }
      } else if (item.type === 'subject') {
         const { data: exist } = await supabase
          .from('user_subject_access')
          .select('id')
          .eq('user_id', userId)
          .eq('subject_id', item.id)
          .single();

        if (!exist) {
          const { granted_at, expires_at } = await buildGrantTimestamps(null, item.id);
          await supabase.from('user_subject_access').insert({
            user_id: userId,
            subject_id: item.id,
            granted_at,
            expires_at: exemptFromExpiry ? null : expires_at
          });
        }
      }
    }

    return res.status(200).json({ success: true, message: 'Enrolled successfully' });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server Error' });
  }
};
