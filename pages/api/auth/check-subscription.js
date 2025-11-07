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
    // الخطوة 1: التحقق من صلاحيات الكورسات الكاملة
    const { data: courseAccess, error: courseError } = await supabase
      .from('user_course_access') // <-- الجدول الجديد
      .select('course_id')
      .eq('user_id', userId)
      .limit(1);

    if (courseError) throw courseError;

    // إذا وجدنا أي صلاحية كورس كامل، اسمح له بالدخول
    if (courseAccess && courseAccess.length > 0) {
      return res.status(200).json({ isSubscribed: true });
    }

    // الخطوة 2: التحقق من صلاحيات المواد المحددة
    const { data: subjectAccess, error: subjectError } = await supabase
      .from('user_subject_access') // <-- الجدول الثاني
      .select('subject_id')
      .eq('user_id', userId)
      .limit(1);

    if (subjectError) throw subjectError;

    // إذا وجدنا أي صلاحية مادة محددة، اسمح له بالدخول
    if (subjectAccess && subjectAccess.length > 0) {
      return res.status(200).json({ isSubscribed: true });
    }

    // إذا لم ينجح أي من الشرطين
    return res.status(200).json({ isSubscribed: false });

  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
