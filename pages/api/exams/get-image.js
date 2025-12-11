import axios from 'axios';
import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper';
import fs from 'fs';
import path from 'path';

export default async (req, res) => {
  const apiName = '[API: get-image]';
  const { file_id } = req.query;
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

  if (!file_id) return res.status(400).json({ error: 'Missing file_id' });

  try {
    // 1. ربط الصورة بالامتحان للتحقق الأمني
    const { data: qData } = await supabase.from('questions').select('exam_id').eq('image_file_id', file_id).maybeSingle();
    
    if (qData) {
        // التحقق الأمني إذا كانت الصورة مرتبطة بسؤال
        const hasAccess = await checkUserAccess(req, qData.exam_id, 'exam');
        if (!hasAccess) return res.status(403).json({ error: 'Access Denied' });
    }

    // 2. محاولة جلب الصورة من التخزين المحلي أولاً
    const localFilePath = path.join(process.cwd(), 'storage', 'exam_images', file_id);
    if (fs.existsSync(localFilePath)) {
        const stat = fs.statSync(localFilePath);
        res.setHeader('Content-Type', 'image/jpeg'); // أو اكتشاف النوع ديناميكياً
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        const readStream = fs.createReadStream(localFilePath);
        readStream.pipe(res);
        return;
    }

    // 3. إذا لم تكن محلية، نحاول جلبها من تيليجرام (للصور القديمة)
    const fileInfo = await axios.get(`https://api.telegram.org/bot${TOKEN}/getFile?file_id=${file_id}`);
    if (!fileInfo.data.ok) throw new Error('File not found locally or on Telegram');
    
    const filePath = fileInfo.data.result.file_path;
    const imageRes = await axios({
        method: 'GET',
        url: `https://api.telegram.org/file/bot${TOKEN}/${filePath}`,
        responseType: 'stream'
    });

    res.setHeader('Content-Type', 'image/jpeg'); 
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    imageRes.data.pipe(res);

  } catch (err) {
    console.error(`${apiName} ERROR:`, err.message);
    res.status(404).json({ error: 'Image not found' });
  }
};
