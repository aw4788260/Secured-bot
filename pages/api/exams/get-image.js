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
        // التحقق الأمني
        const hasAccess = await checkUserAccess(req, qData.exam_id, 'exam');
        if (!hasAccess) return res.status(403).json({ error: 'Access Denied' });
    }

    // --- [تحسين الكاش] ---
    // s-maxage: يخبر كلاود فلير (CDN) بتخزين الصورة لديه
    // max-age: يخبر متصفح المستخدم بتخزين الصورة لديه
    const cacheHeader = 'public, max-age=31536000, s-maxage=31536000, immutable';
    
    res.setHeader('Cache-Control', cacheHeader);
    res.setHeader('CDN-Cache-Control', cacheHeader); // قياسي للـ CDNs
    res.setHeader('Cloudflare-CDN-Cache-Control', cacheHeader); // مخصص لكلاود فلير

    // 2. محاولة جلب الصورة من التخزين المحلي أولاً (الأسرع)
    const localFilePath = path.join(process.cwd(), 'storage', 'exam_images', file_id);
    
    if (fs.existsSync(localFilePath)) {
        const stat = fs.statSync(localFilePath);
        res.setHeader('Content-Type', 'image/jpeg'); 
        res.setHeader('Content-Length', stat.size);
        
        const readStream = fs.createReadStream(localFilePath);
        readStream.pipe(res);
        return;
    }

    // 3. إذا لم تكن محلية، نجلبها من تيليجرام (للصور القديمة)
    const fileInfo = await axios.get(`https://api.telegram.org/bot${TOKEN}/getFile?file_id=${file_id}`);
    if (!fileInfo.data.ok) throw new Error('File not found');
    
    const filePath = fileInfo.data.result.file_path;
    const imageRes = await axios({
        method: 'GET',
        url: `https://api.telegram.org/file/bot${TOKEN}/${filePath}`,
        responseType: 'stream'
    });

    res.setHeader('Content-Type', 'image/jpeg'); 
    imageRes.data.pipe(res);

  } catch (err) {
    console.error(`${apiName} ERROR:`, err.message);
    // في حالة الخطأ نلغي الكاش حتى لا يتم تخزين صفحة الخطأ
    if (!res.headersSent) {
        res.setHeader('Cache-Control', 'no-store');
        res.status(404).json({ error: 'Image not found' });
    }
  }
};
