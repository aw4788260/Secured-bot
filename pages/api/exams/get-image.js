import axios from 'axios';
import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper';

export default async (req, res) => {
  const apiName = '[API: get-image]';
  const { file_id } = req.query;
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

  console.log(`${apiName} 🚀 Request for Image: ${file_id}`);

  if (!file_id) return res.status(400).json({ error: 'Missing file_id' });

  try {
    // 1. ربط الصورة بالامتحان
    const { data: qData } = await supabase.from('questions').select('exam_id').eq('image_file_id', file_id).maybeSingle();
    if (!qData) {
        console.error(`${apiName} ❌ Image not linked to any exam.`);
        return res.status(404).json({ error: 'Image not linked' });
    }

    // 2. التحقق الأمني
    console.log(`${apiName} 🔒 Checking access to Exam: ${qData.exam_id}`);
    const hasAccess = await checkUserAccess(req, qData.exam_id, 'exam');
    if (!hasAccess) {
        console.warn(`${apiName} ⛔ Access Denied.`);
        return res.status(403).json({ error: 'Access Denied' });
    }

    // 3. بروكسي الصورة
    console.log(`${apiName} 📡 Fetching from Telegram...`);
    const fileInfo = await axios.get(`https://api.telegram.org/bot${TOKEN}/getFile?file_id=${file_id}`);
    if (!fileInfo.data.ok) throw new Error('Telegram API Error');
    
    const filePath = fileInfo.data.result.file_path;
    const imageRes = await axios({
        method: 'GET',
        url: `https://api.telegram.org/file/bot${TOKEN}/${filePath}`,
        responseType: 'stream'
    });

    console.log(`${apiName} ✅ Image retrieved. Streaming...`);
    res.setHeader('Content-Type', 'image/jpeg'); 
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    
    imageRes.data.pipe(res);

  } catch (err) {
    console.error(`${apiName} 🔥 ERROR:`, err.message);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
};
