// pages/api/secure/get-video-stream.js
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

    // (نتأكد أنه فيديو تليجرام)
    if (error || !data || data.type !== 'telegram-video' || !data.storage_path) {
      throw new Error('Video not found or access denied');
    }

    const file_id = data.storage_path;
    const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!TOKEN) throw new Error('Server configuration error');

    // (نفس منطق الصور: اطلب المسار)
    const getFileUrl = `https://api.telegram.org/bot${TOKEN}/getFile?file_id=${file_id}`;
    const fileInfoResponse = await axios.get(getFileUrl);
    if (!fileInfoResponse.data.ok) throw new Error('Failed to get file info');

    const file_path = fileInfoResponse.data.result.file_path;

    // (قم ببناء الرابط)
    const downloadUrl = `https://api.telegram.org/file/bot${TOKEN}/${file_path}`;

    // (أعد توجيه المستخدم إليه مباشرة)
    res.redirect(307, downloadUrl);

  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};
