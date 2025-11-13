// pages/api/secure/get-pdf.js
import axios from 'axios';
import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  const { lessonId } = req.query;
  if (!lessonId) return res.status(400).json({ error: 'Missing lessonId' });

  try {
    const { data, error } = await supabase
      .from('videos')
      .select('storage_path, type')
      .eq('id', lessonId)
      .single();

    // [✅ تعديل بسيط] (نتأكد أنه PDF)
    if (error || !data || data.type !== 'pdf' || !data.storage_path) {
      throw new Error('PDF not found or access denied');
    }
    
    // (باقي الكود "مماثل تماماً" لكود الفيديو)
    const file_id = data.storage_path;
    const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!TOKEN) throw new Error('Server configuration error');

    const getFileUrl = `https://api.telegram.org/bot${TOKEN}/getFile?file_id=${file_id}`;
    const fileInfoResponse = await axios.get(getFileUrl);
    if (!fileInfoResponse.data.ok) throw new Error('Failed to get file info');

    const file_path = fileInfoResponse.data.result.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${TOKEN}/${file_path}`;

    res.redirect(307, downloadUrl);

  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};
