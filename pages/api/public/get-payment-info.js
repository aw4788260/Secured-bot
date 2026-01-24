import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  const { teacherId, courseId } = req.query;

  try {
    let targetTeacherId = teacherId;

    // 1. إذا تم تحديد كورس، نجلب معرف المدرس (teacher_id) أولاً من جدول الكورسات
    if (courseId && !targetTeacherId) {
        const { data: course, error: courseError } = await supabase
            .from('courses')
            .select('teacher_id')
            .eq('id', courseId)
            .single();
        
        if (courseError) {
            console.error("Error fetching course:", courseError);
        } else if (course) {
            targetTeacherId = course.teacher_id;
        }
    }

    // إعداد البنية الافتراضية للرد
    let paymentData = {
        cash_numbers: [],
        instapay_numbers: [],
        instapay_links: []
    };

    // إذا لم نجد مدرس، نعود بمصفوفات فارغة
    if (!targetTeacherId) {
        return res.status(200).json(paymentData);
    }

    // 2. نجلب بيانات الدفع من جدول المدرسين مباشرة باستخدام معرف المدرس
    const { data: teacher, error: teacherError } = await supabase
        .from('teachers')
        .select('payment_details')
        .eq('id', targetTeacherId)
        .single();
        
    if (teacherError) {
        console.error("Error fetching teacher:", teacherError);
        // في حال حدوث خطأ في جلب المدرس، سنكمل وسيعود الرد فارغاً بدلاً من ضرب خطأ 500
    }

    // 3. تنسيق البيانات (مع التعامل مع القيم الفارغة)
    const rawDetails = teacher?.payment_details;

    if (rawDetails) {
        paymentData = {
            cash_numbers: Array.isArray(rawDetails.cash_numbers) ? rawDetails.cash_numbers : [],
            instapay_numbers: Array.isArray(rawDetails.instapay_numbers) ? rawDetails.instapay_numbers : [],
            instapay_links: Array.isArray(rawDetails.instapay_links) ? rawDetails.instapay_links : []
        };
    }

    return res.status(200).json(paymentData);

  } catch (err) {
    console.error("Payment Info Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
