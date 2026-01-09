import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  const { teacherId, courseId } = req.query;

  try {
    let paymentSettings = {
        vodafone_cash_number: '',
        instapay_number: '',
        instapay_link: ''
    };

    // أ) إذا تم تحديد كورس، نجلب مدرس الكورس
    if (courseId) {
        const { data: course } = await supabase
            .from('courses')
            .select('teachers(vodafone_cash_number, instapay_number, instapay_link)')
            .eq('id', courseId)
            .single();
        
        if (course?.teachers) {
            paymentSettings = course.teachers;
        }
    } 
    // ب) إذا تم تحديد مدرس مباشرة
    else if (teacherId) {
        const { data: teacher } = await supabase
            .from('teachers')
            .select('vodafone_cash_number, instapay_number, instapay_link')
            .eq('id', teacherId)
            .single();
            
        if (teacher) {
            paymentSettings = teacher;
        }
    }
    // ج) إذا لم يتم التحديد (عام)، يمكن جلب الإعدادات العامة كاحتياطي (اختياري)
    else {
        const { data } = await supabase
          .from('app_settings')
          .select('*')
          .in('key', ['vodafone_cash_number', 'instapay_number', 'instapay_link']);
          
        data?.forEach(item => {
            paymentSettings[item.key] = item.value;
        });
    }

    return res.status(200).json(paymentSettings);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
