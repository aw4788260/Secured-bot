// pages/api/auth/check-subscription.js
import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ message: 'Missing userId' });
  }

  try {
    // --- [ ✅ التعديل هنا ] ---
    // الخطوة 1: جلب بيانات المستخدم (الاشتراك والاسم)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('is_subscribed, first_name') // <-- جلب الاسم
      .eq('id', userId)
      .single();

    if (userError && userError.code !== 'PGRST116') throw userError;

    // إذا لم يتم العثور على المستخدم
    if (!user) {
         return res.status(200).json({ isSubscribed: false, first_name: null });
    }
    
    const userName = user.first_name || "User"; // اسم احتياطي

    // إذا كان مشتركاً عاماً (صلاحية كاملة)، اسمح له بالدخول
    if (user && user.is_subscribed) {
      return res.status(200).json({ isSubscribed: true, first_name: userName });
    }

    // الخطوة 2: إذا لم يكن مشتركاً عاماً، تحقق من جدول الصلاحيات المحددة
    const { data: accessData, error: accessError } = await supabase
      .from('user_course_access')
      .select('course_id') 
      .eq('user_id', userId)
      .limit(1); 

    if (accessError) throw accessError;

    // إذا وجدنا أي صلاحية (طول المصفوفة أكبر من 0)، اسمح له بالدخول
    if (accessData && accessData.length > 0) {
      return res.status(200).json({ isSubscribed: true, first_name: userName });
    }

    // إذا لم ينجح أي من الشرطين
    return res.status(200).json({ isSubscribed: false, first_name: userName });

  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
