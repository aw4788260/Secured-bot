import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('*')
      .in('key', ['vodafone_cash_number', 'instapay_number', 'instapay_link']);
      
    const settings = {
        vodafone_cash_number: '',
        instapay_number: '',
        instapay_link: ''
    };
    
    data?.forEach(item => {
        settings[item.key] = item.value;
    });

    return res.status(200).json(settings);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
