import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';
import { supabase } from '../../../../lib/supabaseClient';
import { createBunnyVideo, uploadBunnyVideoContent, deleteBunnyVideo } from '../../../../lib/bunnyStream';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

// ===================================================================
// 📤 رفع فيديو جديد إلى Bunny Stream من لوحة تحكم المعلم
// ===================================================================
// ✅ هذا الـ API يقوم فقط بـ:
//   1) التحقق من صلاحية المعلم وملكيته للفصل (chapter) المطلوب الإضافة إليه
//   2) إنشاء كائن فيديو في مكتبة Bunny Stream
//   3) رفع محتوى الفيديو الفعلي (Binary) إلى Bunny
//   4) الرد فوراً بـ bunny_video_id بمجرد اكتمال استقبال الملف على سيرفرات Bunny
// ❌ لا ينتظر هذا الـ API انتهاء تحويل الفيديو لجودات متعددة (Encoding/Transcoding)
//    تلك العملية تتم في الخلفية على Bunny، ومتابعتها تكون عبر video-status.js
// ===================================================================

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

// نخزن الملف مؤقتاً على القرص (وليس في الذاكرة) لأن فيديوهات الكورسات
// يمكن أن تكون كبيرة الحجم (عدة جيجابايت) فلا نريد إنهاك ذاكرة السيرفر
const tmpUploadDir = path.join(process.cwd(), 'storage', 'tmp_video_uploads');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(tmpUploadDir)) {
      fs.mkdirSync(tmpUploadDir, { recursive: true });
    }
    cb(null, tmpUploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.mp4';
    const uniqueName = `bunny_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 * 1024 }, // حد أقصى 5 جيجابايت للفيديو الواحد
});

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

// 🛡️ التحقق من أن المعلم يملك الكورس الذي يتبعه هذا الفصل (chapter)
async function verifyChapterOwnership(chapterId, teacherId) {
  if (!chapterId) return false;
  const { data: chapter } = await supabase
    .from('chapters')
    .select('subjects ( courses ( teacher_id ) )')
    .eq('id', chapterId)
    .single();

  const courseTeacherId = chapter?.subjects?.courses?.teacher_id;
  return courseTeacherId && String(courseTeacherId) === String(teacherId);
}

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. ✅ التحقق من صلاحية المعلم/الأدمن (نفس النمط المستخدم في باقي الـ APIs)
  const { user, error } = await requireTeacherOrAdmin(req, res);
  if (error) {
    return; // الرد تم إرساله بالفعل داخل الدالة المساعدة
  }

  // 2. استقبال الملف من الفورم
  try {
    await runMiddleware(req, res, upload.single('file'));
  } catch (multerErr) {
    console.error('❌ [Bunny Upload] Multer Error:', multerErr.message);
    return res.status(400).json({ error: `فشل استقبال الملف: ${multerErr.message}` });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'لم يتم إرفاق أي ملف فيديو' });
  }

  const tempFilePath = req.file.path;
  const cleanupTempFile = () => {
    try {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    } catch (e) {
      console.error('⚠️ [Bunny Upload] Failed to cleanup temp file:', e.message);
    }
  };

  try {
    const chapterId = req.body.chapterId;
    const title = req.body.title || req.file.originalname;

    // 3. ✅ التحقق من ملكية الفصل (إلا إذا كان سوبر أدمن)
    if (user.role !== 'super_admin') {
      const isOwner = await verifyChapterOwnership(chapterId, user.teacherId);
      if (!isOwner) {
        cleanupTempFile();
        return res.status(403).json({ error: 'غير مصرح لك بالإضافة في هذا الفصل.' });
      }
    } else if (!chapterId) {
      cleanupTempFile();
      return res.status(400).json({ error: 'معرف الفصل (chapterId) مطلوب.' });
    }

    // 4. إنشاء كائن الفيديو في مكتبة Bunny Stream
    let bunnyVideoId;
    try {
      bunnyVideoId = await createBunnyVideo(title);
      if (!bunnyVideoId) throw new Error('لم يتم استلام Video ID من Bunny Stream');
    } catch (createErr) {
      cleanupTempFile();
      console.error('❌ [Bunny Upload] Create Video Failed:', createErr.message);
      return res.status(502).json({ error: 'فشل إنشاء الفيديو على Bunny Stream' });
    }

    // 5. رفع محتوى الفيديو الفعلي إلى Bunny (Stream من القرص مباشرة، بدون تحميله في الذاكرة)
    try {
      const fileStream = fs.createReadStream(tempFilePath);
      const fileSize = req.file.size;
      await uploadBunnyVideoContent(bunnyVideoId, fileStream, fileSize);
    } catch (uploadErr) {
      console.error('❌ [Bunny Upload] Content Upload Failed:', uploadErr.message);
      // تنظيف الفيديو الفاشل من Bunny حتى لا يتراكم كائنات فيديو فاضية بلا محتوى
      await deleteBunnyVideo(bunnyVideoId);
      cleanupTempFile();
      return res.status(502).json({ error: 'فشل رفع الفيديو إلى Bunny Stream' });
    }

    // 6. ✅ تم استقبال الفيديو بالكامل على Bunny - نرد فوراً هنا
    // (لا ننتظر اكتمال المعالجة/التحويل لجودات متعددة، هذا يحدث في الخلفية)
    cleanupTempFile();

    console.log(`✅ [Bunny Upload] Video uploaded successfully. bunny_video_id=${bunnyVideoId}`);

    return res.status(200).json({
      success: true,
      bunny_video_id: bunnyVideoId,
      title,
    });
  } catch (err) {
    cleanupTempFile();
    console.error('❌ [CRITICAL BUNNY UPLOAD ERROR]:', err);
    return res.status(500).json({ error: `فشل الرفع: ${err.message}` });
  }
};
