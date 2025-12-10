import { supabase } from '../../../lib/supabaseClient';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { parse } from 'cookie'; // [1] استيراد مكتبة تحليل الكوكيز

export const config = { api: { bodyParser: false } };

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // ---------------------------------------------------------
  // [2] بداية التحقق من الأدمن
  // ---------------------------------------------------------
  try {
    const cookies = parse(req.headers.cookie || '');
    const sessionToken = cookies.admin_session;

    // أ) التأكد من وجود التوكن
    if (!sessionToken) {
        return res.status(401).json({ error: 'Unauthorized: الرجاء تسجيل الدخول' });
    }

    // ب) التحقق من صحة التوكن في قاعدة البيانات وأن المستخدم أدمن
    const { data: adminUser, error: authError } = await supabase
        .from('users')
        .select('is_admin')
        .eq('session_token', sessionToken)
        .single();

    if (authError || !adminUser || !adminUser.is_admin) {
        return res.status(403).json({ error: 'Access Denied: ليس لديك صلاحية أدمن' });
    }
  } catch (err) {
      return res.status(500).json({ error: 'Auth check failed' });
  }
  // ---------------------------------------------------------
  // نهاية التحقق
  // ---------------------------------------------------------
  
  const form = formidable({
    keepExtensions: true,
    maxFileSize: 100 * 1024 * 1024, // 100MB
    filename: (name, ext, part) => `${Date.now()}_${part.originalFilename.replace(/\s/g, '_')}`
  });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'Upload parsing failed' });

    // تحديد نوع الملف والمجلد
    const type = Array.isArray(fields.type) ? fields.type[0] : fields.type; // 'pdf' or 'exam_image'
    const uploadedFile = files.file ? (Array.isArray(files.file) ? files.file[0] : files.file) : null;

    if (!uploadedFile) return res.status(400).json({ error: 'Missing file' });

    // تحديد مسار الحفظ بناءً على النوع
    let subFolder = 'pdfs';
    if (type === 'exam_image') subFolder = 'exam_images';

    const targetDir = path.join(process.cwd(), 'storage', subFolder);
    
    try {
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

        const oldPath = uploadedFile.filepath;
        const newPath = path.join(targetDir, path.basename(oldPath));

        // نقل الملف للمجلد الصحيح
        fs.renameSync(oldPath, newPath);
        const fileName = path.basename(newPath);

        // إذا كان PDF، نقوم بحفظه في قاعدة البيانات فوراً
        if (type === 'pdf') {
            const title = Array.isArray(fields.title) ? fields.title[0] : "";
            const chapterId = Array.isArray(fields.chapterId) ? fields.chapterId[0] : null;

            const { error: dbError } = await supabase.from('pdfs').insert({
                title: title || uploadedFile.originalFilename,
                file_path: fileName,
                chapter_id: parseInt(chapterId),
                sort_order: 0
            });
            
            if (dbError) throw dbError;
        }

        // نرجع اسم الملف لاستخدامه في الفرونت إند (خاصة لصور الامتحانات)
        return res.status(200).json({ success: true, fileName, type });

    } catch (e) {
        console.error("Upload Error:", e);
        return res.status(500).json({ error: e.message });
    }
  });
};
