import { supabase } from '../../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    // 1. جلب حالة العجلة العامة (مفعلة أم لا)
    const { data: globalSettings } = await supabase
        .from('wheel_settings')
        .select('is_wheel_enabled')
        .eq('id', 1)
        .maybeSingle();

    // 2. جلب الجوائز المفعلة (الأسماء والأنواع فقط لترسم العجلة)
    const { data: prizes } = await supabase
        .from('wheel_prizes')
        .select('id, title, type, is_active')
        .eq('is_active', true)
        .order('id', { ascending: true });

    return res.status(200).json({
        isWheelEnabled: globalSettings ? globalSettings.is_wheel_enabled : true,
        prizes: prizes || []
    });

  } catch (error) {
    console.error('Public Wheel Error:', error);
    return res.status(500).json({ error: 'فشل جلب البيانات' });
  }
}
