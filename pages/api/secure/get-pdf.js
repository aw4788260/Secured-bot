import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  // 1. التحقق من الطلب
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method Not Allowed' });

  const { pdfId } = req.query;
  const userId = req.headers['x-user-id'];
  const deviceId = req.headers['x-device-id'];

  if (!pdfId || !userId || !deviceId) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    // 2. التحقق الأمني (الجهاز)
    const { data: device } = await supabase.from('devices').select('fingerprint').eq('user_id', userId).maybeSingle();
    if (!device || device.fingerprint !== deviceId) return res.status(403).json({ error: 'Unauthorized Device' });

    // 3. جلب بيانات الملف
    const { data: pdfDoc } = await supabase
      .from('pdfs')
      .select('id, title, file_path, chapter_id')
      .eq('id', pdfId)
      .single();

    if (!pdfDoc) return res.status(404).json({ error: 'File not found' });

    // 4. التحقق من الاشتراك (عبر الشابتر -> المادة)
    // نجلب المادة التابع لها هذا الملف
    const { data: chapter } = await supabase.from('chapters').select('subject_id').eq('id', pdfDoc.chapter_id).single();
    
    // هل يملك الطالب هذه المادة؟
    const { data: access } = await supabase
      .from('user_subject_access')
      .select('id')
      .eq('user_id', userId)
      .eq('subject_id', chapter.subject_id)
      .maybeSingle();

    // فحص بديل: هل يملك الكورس بالكامل؟ (يمكنك إضافته هنا مثلما فعلنا سابقاً)
    
    if (!access) {
      // تحقق إضافي للكورس الكامل (اختياري للأمان القصوى)
       const { data: subject } = await supabase.from('subjects').select('course_id').eq('id', chapter.subject_id).single();
       const { data: courseAccess } = await supabase.from('user_course_access').eq('user_id', userId).eq('course_id', subject.course_id).maybeSingle();
       
       if (!courseAccess) return res.status(403).json({ error: 'Access Denied' });
    }

    // 5. جلب الملف من Supabase Storage (أو أي مكان تخزين) وتمريره
    // ملاحظة: نفترض أن الملف مخزن في bucket اسمه 'course_pdfs'
    const { data, error } = await supabase.storage
      .from('course_pdfs') // اسم الـ Bucket
      .download(pdfDoc.file_path);

    if (error) throw error;

    // 6. إرسال الملف كـ Stream
    const buffer = Buffer.from(await data.arrayBuffer());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${pdfDoc.title}.pdf"`);
    res.send(buffer);

  } catch (err) {
    console.error("PDF Error:", err);
    return res.status(500).json({ error: 'Server Error fetching PDF' });
  }
};
