import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  const { teacherId, courseId, subjectId } = req.query;

  try {
    // القيمة الافتراضية
    let paymentData = {
        cash_numbers: [],
        instapay_numbers: [],
        instapay_links: []
    };

    let rawDetails = null;

    // 1. ✅ إذا تم تحديد مادة (Subject)
    // نبحث عن المادة -> ومنها للكورس -> ومنه للمدرس -> ومنه لتفاصيل الدفع
    if (subjectId) {
        const { data: subject } = await supabase
            .from('subjects')
            .select(`
                courses (
                    teachers ( payment_details )
                )
            `)
            .eq('id', subjectId)
            .single();

        // استخراج البيانات من الهيكل المتداخل
        if (subject?.courses?.teachers?.payment_details) {
            rawDetails = subject.courses.teachers.payment_details;
        }
    }
    // 2. ✅ إذا تم تحديد كورس (Course)
    // نبحث عن الكورس -> ومنه للمدرس -> ومنه لتفاصيل الدفع
    else if (courseId) {
        const { data: course } = await supabase
            .from('courses')
            .select('teachers ( payment_details )')
            .eq('id', courseId)
            .single();
        
        if (course?.teachers?.payment_details) {
            rawDetails = course.teachers.payment_details;
        }
    } 
    // 3. ✅ إذا تم تحديد مدرس مباشرة (Teacher)
    else if (teacherId) {
        const { data: teacher } = await supabase
            .from('teachers')
            .select('payment_details')
            .eq('id', teacherId)
            .single();
            
        if (teacher?.payment_details) {
            rawDetails = teacher.payment_details;
        }
    }

    // تنسيق البيانات للتأكد من أنها مصفوفات دائمًا لتجنب الأخطاء في التطبيق
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
