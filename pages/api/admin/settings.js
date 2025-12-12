import { supabase } from '../../../lib/supabaseClient';
import { parse } from 'cookie';

export default async (req, res) => {
  // التحقق من الأدمن
  const cookies = parse(req.headers.cookie || '');
  const sessionToken = cookies.admin_session;
  if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });

  const { data: adminUser } = await supabase.from('users').select('is_admin').eq('session_token', sessionToken).single();
  if (!adminUser || !adminUser.is_admin) return res.status(403).json({ error: 'Access Denied' });

  // حفظ الإعدادات
  if (req.method === 'POST') {
      const { vodafone, instapayNumber, instapayLink } = req.body;
      
      const updates = [
          { key: 'vodafone_cash_number', value: vodafone },
          { key: 'instapay_number', value: instapayNumber },
          { key: 'instapay_link', value: instapayLink }
      ];

      const { error } = await supabase.from('app_settings').upsert(updates);
      
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
  }
  
  // جلب الإعدادات (للأدمن)
  if (req.method === 'GET') {
      const { data } = await supabase.from('app_settings').select('*');
      const settings = {};
      data?.forEach(item => settings[item.key] = item.value);
      return res.status(200).json(settings);
  }
};
