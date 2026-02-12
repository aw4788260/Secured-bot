import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper';

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // 1. التحقق من المستخدم
  const isAuthorized = await checkUserAccess(req);
  if (!isAuthorized) return res.status(401).json({ error: 'Unauthorized' });

  const userId = req.headers['x-user-id'];
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
          await supabase.from('user_course_access').insert({
            user_id: userId,
            course_id: item.id
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
          await supabase.from('user_subject_access').insert({
            user_id: userId,
            subject_id: item.id
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
